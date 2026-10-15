/* trend radar: niche velocity scan */
'use strict';
TS.initNav('trends');
const out = document.getElementById('out');
if (!TS.hasKey()) document.getElementById('gate').innerHTML = TS.gateHtml();

const REGIONS = [['US', 'United States'], ['GB', 'United Kingdom'], ['DE', 'Germany'], ['IN', 'India'], ['CA', 'Canada'], ['AU', 'Australia'], ['FR', 'France'], ['BR', 'Brazil'], ['JP', 'Japan'], ['AE', 'UAE']];
document.getElementById('region').innerHTML = REGIONS.map(r => '<option value="' + r[0] + '">' + r[1] + '</option>').join('');

document.getElementById('f').addEventListener('submit', e => { e.preventDefault(); run(); });

async function run() {
  const q = document.getElementById('q').value.trim();
  if (!q) { TS.toast('Enter a niche keyword.'); return; }
  const days = +document.getElementById('days').value;
  const region = document.getElementById('region').value;
  out.innerHTML = TS.loadingHtml('Scanning "' + q + '" for rising videos…');
  try {
    const after = new Date(Date.now() - days * 864e5).toISOString();
    const s = await TS.api('search', { part: 'snippet', q, type: 'video', order: 'viewCount', publishedAfter: after, maxResults: 25, regionCode: region }, 100);
    const ids = (s.items || []).map(v => v.id.videoId).filter(Boolean);
    if (!ids.length) { out.innerHTML = '<p class="muted">No videos found in this window. Try a broader keyword or longer window.</p>'; return; }
    const vids = await TS.getVideosByIds(ids);
    const rows = vids.map(v => {
      const ageDays = Math.max(0.25, (Date.now() - new Date(v.snippet.publishedAt).getTime()) / 864e5);
      return { v, vpd: (+v.statistics.viewCount || 0) / ageDays, ageDays };
    }).filter(r => r.vpd > 0).sort((a, b) => b.vpd - a.vpd);
    if (!rows.length) { out.innerHTML = '<p class="muted">No measurable velocity yet.</p>'; return; }
    const med = rows[Math.floor(rows.length / 2)].vpd;
    const rising = rows.filter(r => r.vpd >= med * 3);
    const phrases = risingPhrases(rising.map(r => r.v));

    let html = '<div class="stats">' +
      '<div class="stat"><div class="k">Videos scanned</div><div class="v">' + rows.length + '</div><div class="d">last ' + days + ' days</div></div>' +
      '<div class="stat"><div class="k">Rising now</div><div class="v">' + rising.length + '</div><div class="d">3×+ median velocity</div></div>' +
      '<div class="stat"><div class="k">Median velocity</div><div class="v">' + TS.fmtNum(med) + '</div><div class="d">views / day</div></div></div>';

    if (rising.length) {
      html += '<h3 class="mt">Rising videos — cover these angles now</h3><div class="vgrid">' +
        rising.slice(0, 12).map(r =>
          '<a class="vcard" href="video.html?v=' + r.v.id + '"><img src="' + r.v.snippet.thumbnails.medium.url + '" loading="lazy" alt="">' +
          '<div class="vb"><div class="vt">' + TS.esc(r.v.snippet.title) + '</div>' +
          '<div class="vm"><span class="badge g">' + TS.fmtNum(r.vpd) + ' views/day</span> · ' + TS.esc(r.v.snippet.channelTitle) + ' · ' + Math.round(r.ageDays) + 'd old</div></div></a>'
        ).join('') + '</div>';
    } else {
      html += '<div class="card mt"><h3>No clear breakouts</h3><p class="muted small">Nothing is outpacing the niche median 3× right now. The top-velocity videos are still worth studying:</p></div>' +
        '<div class="vgrid">' + rows.slice(0, 6).map(r =>
          '<a class="vcard" href="video.html?v=' + r.v.id + '"><img src="' + r.v.snippet.thumbnails.medium.url + '" loading="lazy" alt="">' +
          '<div class="vb"><div class="vt">' + TS.esc(r.v.snippet.title) + '</div><div class="vm">' + TS.fmtNum(r.vpd) + ' views/day · ' + TS.esc(r.v.snippet.channelTitle) + '</div></div></a>'
        ).join('') + '</div>';
    }
    if (phrases.length) {
      html += '<div class="card mt"><h3>Breakout phrases in rising titles</h3><div class="tags">' +
        phrases.map(p => '<a class="tag hot" href="keywords.html?q=' + encodeURIComponent(p[0]) + '">' + TS.esc(p[0]) + ' ×' + p[1] + '</a>').join('') +
        '</div><p class="note">Words repeating across rising titles signal the angle that\u2019s working. Click to research as a keyword.</p></div>';
    }
    html += '<p class="note">Velocity = views ÷ age in days. "Rising" = 3× the niche median. Scan cost ~101 units.</p>';
    out.innerHTML = html;
  } catch (e) { out.innerHTML = TS.apiErrorHtml(e); }
}

function risingPhrases(vids) {
  const stop = new Set(('the,a,an,and,or,for,to,in,on,of,with,vs,how,why,what,when,my,i,you,your,this,that,its,it,is,are,be,at,by,from,as,into,out,up,new,best,top,ever,real,full,official,video,2026,2025,shorts').split(','));
  const f = {};
  vids.forEach(v => {
    v.snippet.title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
      .forEach(w => { if (w.length > 3 && !stop.has(w) && !/^\d+$/.test(w)) f[w] = (f[w] || 0) + 1; });
  });
  return Object.entries(f).filter(x => x[1] > 1).sort((a, b) => b[1] - a[1]).slice(0, 12);
}
