/* TubeScope for YouTube — content script (MV3, no permissions needed).
   Adds a floating "Analyze with TubeScope" button on watch + channel pages. */
'use strict';
const BASE = 'https://0050piyush.github.io/tubescope';
const BTN_ID = 'tubescope-fab';

function videoId() {
  const u = new URL(location.href);
  if (u.pathname === '/watch') return u.searchParams.get('v');
  const m = u.pathname.match(/^\/(shorts|live|embed)\/([\w-]{11})/);
  return m ? m[2] : null;
}
function channelRef() {
  const u = new URL(location.href);
  let m = u.pathname.match(/^\/channel\/(UC[\w-]{22})/);
  if (m) return m[1];
  m = u.pathname.match(/^\/@([\w.\-]+)/);
  if (m) return '@' + m[1];
  m = u.pathname.match(/^\/(c|user)\/([\w.\-]+)/);
  if (m) return m[2];
  return null;
}
function ensureBtn() {
  const vid = videoId(), ch = !vid && channelRef();
  let btn = document.getElementById(BTN_ID);
  if (!vid && !ch) { if (btn) btn.remove(); return; }
  const url = vid ? BASE + '/video.html?v=' + vid : BASE + '/channel.html?c=' + encodeURIComponent(ch);
  const label = vid ? 'Analyze video' : 'Audit channel';
  if (!btn) {
    btn = document.createElement('a');
    btn.id = BTN_ID;
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:7px">' +
      '<span style="width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#ff3b30,#ff7a45);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:11px">TS</span>' +
      '<span class="ts-label">' + label + '</span></span>';
    btn.setAttribute('style', 'position:fixed;right:18px;bottom:18px;z-index:9999;background:#0e0e11;color:#f4f4f6;border:1px solid #2a2a32;border-radius:14px;padding:11px 16px;font:600 13px/1.2 -apple-system,Segoe UI,Roboto,sans-serif;text-decoration:none;box-shadow:0 8px 30px rgba(0,0,0,.55);cursor:pointer');
    btn.onmouseenter = () => btn.style.borderColor = '#ff3b30';
    btn.onmouseleave = () => btn.style.borderColor = '#2a2a32';
    document.documentElement.appendChild(btn);
  }
  btn.href = url;
  const lab = btn.querySelector('.ts-label');
  if (lab && lab.textContent !== label) lab.textContent = label;
}

// YouTube is an SPA: re-check on navigation + DOM changes (throttled)
let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => { scheduled = false; try { ensureBtn(); } catch (e) {} }, 400);
}
document.addEventListener('yt-navigate-finish', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
schedule();
