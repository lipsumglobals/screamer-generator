// The supplied five-wave fragment shader, recolored in green.
const SHADER_VERTEX = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const SHADER_FRAGMENT = `
#ifdef GL_ES
precision mediump float;
#endif

uniform float time;
uniform vec2 mouse;
uniform vec2 resolution;

void main(void) {
  vec2 uPos = gl_FragCoord.xy / resolution.xy;
  uPos.x -= 1.0;
  uPos.y -= 0.5;

  vec3 color = vec3(0.0);
  for (float i = 0.0; i < 5.0; ++i) {
    float t = time * 0.9;
    uPos.y += sin(uPos.x * i + t + i / 2.0) * 0.1;
    // Keep the original glow without division by zero at a wave's center.
    float fTemp = 0.01 / max(abs(uPos.y), 0.001);
    color += vec3(fTemp * 0.10, fTemp * (10.0 - i) / 10.0, pow(fTemp, 1.5) * 0.025);
  }

  color = vec3(1.0) - exp(-color * 0.65);
  gl_FragColor = vec4(color, 1.0);
}`;

function shaderSize(width, height, pixelRatio = 1, coarse = false) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const scale = Math.min(Math.max(1, pixelRatio), 1.5, Math.sqrt((coarse ? 300000 : 600000) / (w * h)));
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) };
}

function createShaderBackground(canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: false, stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) return () => {};

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  let program = null;
  let buffer = null;
  let timeUniform;
  let resolutionUniform;
  let frame = 0;
  let elapsed = 0;
  let previous = null;
  let ready = false;
  let disposed = false;

  // Compile/link checks follow the WebGL tutorial:
  // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message || 'Shader compilation failed');
    }
    return shader;
  }

  function releaseResources() {
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    buffer = null;
    program = null;
    ready = false;
  }

  function initialize() {
    const shaders = [];
    try {
      shaders.push(compile(gl.VERTEX_SHADER, SHADER_VERTEX));
      shaders.push(compile(gl.FRAGMENT_SHADER, SHADER_FRAGMENT));
      program = gl.createProgram();
      shaders.forEach(shader => gl.attachShader(program, shader));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader linking failed');
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      timeUniform = gl.getUniformLocation(program, 'time');
      resolutionUniform = gl.getUniformLocation(program, 'resolution');
      ready = true;
      resize();
      return true;
    } catch (error) {
      releaseResources();
      canvas.classList.remove('is-ready');
      console.warn('Background shader unavailable:', error.message);
      return false;
    } finally {
      shaders.forEach(shader => gl.deleteShader(shader));
    }
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = null;
  }

  function draw() {
    gl.uniform1f(timeUniform, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add('is-ready');
  }

  function resize() {
    if (!ready || disposed) return;
    const size = shaderSize(canvas.clientWidth, canvas.clientHeight, devicePixelRatio || 1, coarse.matches);
    canvas.width = size.width;
    canvas.height = size.height;
    gl.viewport(0, 0, size.width, size.height);
    gl.uniform2f(resolutionUniform, size.width, size.height);
  }

  function render(now) {
    frame = 0;
    if (disposed || document.hidden || motion.matches || !ready) return;
    if (previous === null || now - previous >= 1000 / 30) {
      if (previous !== null) elapsed += Math.min(now - previous, 100) / 1000;
      previous = now;
      draw();
    }
    frame = requestAnimationFrame(render);
  }

  function sync() {
    stop();
    if (disposed || document.hidden || !ready) return;
    draw();
    if (!motion.matches) frame = requestAnimationFrame(render);
  }

  function onResize() { resize(); sync(); }
  function onLoss(event) {
    event.preventDefault();
    stop();
    ready = false;
    canvas.classList.remove('is-ready');
  }
  function onRestore() {
    if (disposed) return;
    releaseResources();
    if (initialize()) sync();
  }

  if (!initialize()) return () => {};
  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  coarse.addEventListener('change', onResize);
  canvas.addEventListener('webglcontextlost', onLoss);
  canvas.addEventListener('webglcontextrestored', onRestore);
  sync();

  return () => {
    disposed = true;
    stop();
    removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', sync);
    motion.removeEventListener('change', sync);
    coarse.removeEventListener('change', onResize);
    canvas.removeEventListener('webglcontextlost', onLoss);
    canvas.removeEventListener('webglcontextrestored', onRestore);
    releaseResources();
  };
}

const shaderCanvas = document.getElementById('shader');
if (shaderCanvas) createShaderBackground(shaderCanvas);
