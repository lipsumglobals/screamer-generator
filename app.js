const $ = (id) => document.getElementById(id);

const VIDEO = 'https://github.com/lipsumglobals/screamer-generator/raw/refs/heads/main/video.mp4';
const DESKTOP_WIDTH = 1920;
const ICON = (host) => `https://icons.duckduckgo.com/ip3/${host}.ico`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function normalize(raw) {
  let v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    return u.hostname.includes('.') ? u : null;
  } catch {
    return null;
  }
}

function pageMode(url) {
  const host = url.hostname.replace(/\.$/, '');
  const matches = (domain) => host === domain || host.endsWith('.' + domain);
  // YouTube allows its player URLs to be framed, not its regular site pages.
  // https://developers.google.com/youtube/player_parameters#Manual_IFrame_Embeds
  const youtubePlayer = (matches('youtube.com') || matches('youtube-nocookie.com'))
    && (url.pathname === '/embed' || url.pathname.startsWith('/embed/'));
  if (youtubePlayer) return 'iframe';
  return ['github.com', 'youtube.com', 'youtu.be', 'youtube-nocookie.com'].some(matches)
    ? 'snapshot' : 'iframe';
}

// The screenshot service renders the target outside an iframe.
// https://www.thum.io/documentation/api/url
function screenshotUrl(url) {
  return `https://image.thum.io/get/width/1920/crop/1200/noanimate/?url=${encodeURIComponent(url)}`;
}

function loadSnapshot(image, status, url) {
  image.hidden = true;
  status.hidden = true;
  status.textContent = '';
  image.onload = () => {
    image.hidden = false;
    status.hidden = true;
  };
  image.onerror = () => {
    image.hidden = true;
    status.hidden = false;
    status.textContent = 'Не удалось загрузить снимок страницы. Попробуй создать файл позже.';
  };
  image.src = url;
}

// Keep the desktop layout sharp while fitting the full frame into the window.
// Phones use their actual viewport so the page stays readable.
function viewportLayout(width, height, resolution = 1920, mobile = false) {
  const pageWidth = mobile || !resolution ? width : Math.max(width, resolution);
  const scale = width / pageWidth;
  return { width: pageWidth, height: Math.ceil(height / scale), scale };
}

/* ---------- генерируемый файл ---------- */
function build(c) {
  const snapshot = pageMode(new URL(c.url)) === 'snapshot' ? screenshotUrl(c.url) : null;
  const cfg = JSON.stringify({ url: c.url, video: VIDEO, resolution: c.resolution || DESKTOP_WIDTH, snapshot }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.title)}</title>
<link rel="icon" href="${esc(c.icon)}">
<link rel="apple-touch-icon" href="${esc(c.icon)}">
<style>
*{box-sizing:border-box}
[hidden]{display:none!important}
html,body{height:100%;margin:0;overflow:hidden;background:#fff}
#site{position:fixed;top:0;left:0;width:100%;height:100%;border:0;background:#fff;pointer-events:none;transform-origin:top left}
#snapshot{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center}
#snapshot-status{position:fixed;inset:0;display:grid;place-items:center;padding:24px;text-align:center;font:14px/1.6 system-ui,sans-serif;color:#72766d;background:#f7f8f3}
#scare{position:fixed;inset:0;z-index:2147483647;display:none;background:#000}
#scare.on{display:block}
#scare video{width:100%;height:100%;object-fit:cover;display:block}
#catch{position:fixed;inset:0;z-index:9;cursor:pointer;-webkit-tap-highlight-color:transparent}
</style>
</head>
<body>
<iframe id="site" title="Сайт" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
${snapshot ? '<img id="snapshot" alt="Снимок страницы" hidden><div id="snapshot-status" role="status" hidden></div>' : ''}
<div id="scare"><video id="v" loop playsinline preload="auto" muted></video></div>
<div id="catch"></div>
<script>
var cfg=${cfg};
var site=document.getElementById('site'),scare=document.getElementById('scare'),v=document.getElementById('v'),cat=document.getElementById('catch'),on=false;
${viewportLayout.toString()}
function resizeSite(){
  var layout=viewportLayout(innerWidth,innerHeight,cfg.resolution,innerWidth<768);
  site.style.width=layout.width+'px';
  site.style.height=layout.height+'px';
  site.style.transform='scale('+layout.scale+')';
}
resizeSite();
addEventListener('resize',resizeSite);
${snapshot ? `${loadSnapshot.toString()}
site.style.display='none';
loadSnapshot(document.getElementById('snapshot'),document.getElementById('snapshot-status'),cfg.snapshot);` : 'site.src=cfg.url;'}
v.src=cfg.video;
/* назад не уводит */
try{history.pushState({s:1},'','#');addEventListener('popstate',function(){history.pushState({s:1},'','#')})}catch(e){}
/* правый клик и F12 не мешают */
document.addEventListener('contextmenu',function(e){e.preventDefault()});
function full(){
  if(document.fullscreenElement)return;
  var d=document.documentElement;
  try{
    var p=(d.requestFullscreen||d.webkitRequestFullscreen||d.mozRequestFullScreen||d.msRequestFullscreen||function(){}).call(d);
    if(p&&p.catch)p.catch(function(){});
  }catch(_){}
}
function fire(e){
  if(e)e.preventDefault();
  if(on)full();
  if(on)return;
  on=true;
  full();
  try{v.currentTime=0}catch(_){}
  v.muted=false;
  scare.classList.add('on');
  var p=v.play();
  if(p&&p.catch)p.catch(function(){v.muted=true;v.play().catch(function(){})});
}
/* первый клик в любом месте = запуск */
cat.addEventListener('pointerdown',fire,true);
function escapeAll(){
  on=false;
  scare.classList.remove('on');
  try{v.pause();v.currentTime=0}catch(_){}
  try{document.exitFullscreen&&document.exitFullscreen().catch(function(){})}catch(_){}
}
/* Двойной Esc не останавливает видео. Выход из fullscreen обрабатывает браузер. */
cat.addEventListener('dblclick',escapeAll,true);
scare.addEventListener('dblclick',escapeAll,true);
</script>
</body>
</html>`;
}

/* ---------- UI ---------- */

function save(html) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = 'index.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 6000);
}

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  $('msg').textContent = '';
  $('msg').removeAttribute('data-status');
  $('url').removeAttribute('aria-invalid');
  const u = normalize($('url').value);
  if (!u) {
    $('msg').textContent = 'Вставь ссылку на сайт, например example.com';
    $('url').setAttribute('aria-invalid', 'true');
    $('url').focus();
    return;
  }

  $('go').disabled = true;
  try {
    save(build({ url: u.href, title: u.host, icon: ICON(u.hostname), resolution: DESKTOP_WIDTH }));
    $('msg').setAttribute('data-status', 'success');
    $('msg').textContent = 'Готово. index.html скачан.';
  } catch {
    $('msg').textContent = 'Не удалось создать файл. Попробуй ещё раз.';
  } finally {
    $('go').disabled = false;
  }
});
