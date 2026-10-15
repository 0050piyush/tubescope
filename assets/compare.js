/* competitor compare */
'use strict';
TS.initNav('compare');
const out = document.getElementById('out');
if (!TS.hasKey()) document.getElementById('gate').innerHTML = TS.gateHtml();

document.getElementById('f').addEventListener('submit', e => {
  e.preventDefault();
  const a = document.getElementById('qa').value.trim(), b = document.getElementById('qb').value.trim();
  if (!a || !b) { TS.toast('Enter both channels.'); return; }
  history.replaceState(null, '', 'compare.html?a=' + encodeURIComponent(a) + '&b=' + encodeURIComponent(b));
  run(a, b);
});

async function fetchSide(raw) {
  const id = await TS.resolveChannelId(TS.parseChannelInput(raw));
  const ch = await TS.getChannel(id);
  const uploadsId = ch.contentDetails.relatedPlaylists.uploads;
  const items = await TS.getUploadsPlaylistItems(uploadsId, 30);
  const vids = await TS.getVideosByIds(items.map(i => i.contentDetails.videoId));
  const a = TS.analyzeUploads(vids);
  const health = TS.channelHealthScore(ch, a);
  const mon = TS.monetizationVerdict(ch, a);
  const country = ch.snippet.country || '';
  const cat = vids.length ? topCat(vids) : 'Entertainment';
  const monthlyViews = a && a.monthlyViews > 0 ? a.monthlyViews : (+ch.statistics.viewCount || 0) / Math.max(30, (Date.now() - new Date(ch.snippet.publishedAt).getTime()) / 864e5) * 30;
  const [eLo, eHi] = TS.revenueRange(monthlyViews, cat, country);
  return { ch, a, health, mon, monthlyViews, eLo, eHi, cat };
}

async function run(ra, rb) {
  out.innerHTML = TS.loadingHtml('Fetching both channels…');
  try {
    const [A, B] = await Promise.all([fetchSide(ra), fetchSide(rb)]);
    const rows = [
      ['Subscribers', v => TS.fmtInt(v.ch.statistics.subscriberCount), (x, y) => x > y, x => +x.ch.statistics.subscriberCount],
      ['Total views', v => TS.fmtNum(v.ch.statistics.viewCount), (x, y) => x > y, x => +x.ch.statistics.viewCount],
      ['Videos', v => TS.fmtInt(v.ch.statistics.videoCount), (x, y) => x > y, x => +x.ch.statistics.videoCount],
      ['Uploads / month', v => v.a ? v.a.perMonth.toFixed(1) : '—', (x, y) => x > y, x => x.a ? x.a.perMonth : 0],
      ['Avg views / video', v => v.a ? TS.fmtNum(v.a.avg) : '—', (x, y) => x > y, x => x.a ? x.a.avg : 0],
      ['Engagement rate', v => v.a ? v.a.engRate.toFixed(1) + '%' : '—', (x, y) => x > y, x => x.a ? x.a.engRate : 0],
      ['Monthly views (est.)', v => TS.fmtNum(v.monthlyViews), (x, y) => x > y, x => x.monthlyViews],
      ['Monthly earnings (est.)', v => TS.fmtMoney(v.eLo) + ' – ' + TS.fmtMoney(v.eHi), (x, y) => x > y, x => x.eLo],
      ['Monetization', v => '<span class="badge ' + v.mon.cls + '">' + v.mon.verdict + '</span>', (x, y) => x > y, x => x.mon.score],
      ['Health score', v => v.health.score + '/100', (x, y) => x > y, x => x.health.score],
      ['Last upload', v => v.a ? (v.a.daysSinceUpload === 0 ? 'today' : v.a.daysSinceUpload + 'd ago') : '—', (x, y) => x < y, x => x.a ? x.a.daysSinceUpload : 1e9]
    ];
    let wins = [0, 0];
    const body = rows.map(r => {
      const av = r[3](A), bv = r[3](B);
      let wa = false, wb = false;
      if (av !== bv && r[2](av, bv)) { wa = true; wins[0]++; } else if (av !== bv) { wb = true; wins[1]++; }
      return '<tr><td class="muted">' + r[0] + '</td><td class="' + (wa ? '' : '') + '">' + (wa ? '<b>' : '') + r[1](A) + (wa ? '</b> <span class="badge g">wins</span>' : '') + '</td>' +
        '<td>' + (wb ? '<b>' : '') + r[1](B) + (wb ? '</b> <span class="badge g">wins</span>' : '') + '</td></tr>';
    }).join('');
    const av = (A.ch.snippet.thumbnails.medium || {}).url || '', bv = (B.ch.snippet.thumbnails.medium || {}).url || '';
    out.innerHTML =
      '<div class="tblwrap"><table class="tbl"><tr><th>Metric</th>' +
      '<th><span style="display:flex;align-items:center;gap:8px">' + (av ? '<img src="' + av + '" style="width:30px;height:30px;border-radius:50%">' : '') + TS.esc(A.ch.snippet.title) + '</span></th>' +
      '<th><span style="display:flex;align-items:center;gap:8px">' + (bv ? '<img src="' + bv + '" style="width:30px;height:30px;border-radius:50%">' : '') + TS.esc(B.ch.snippet.title) + '</span></th></tr>' +
      body + '</table></div>' +
      '<div class="card mt"><h3>Verdict</h3><p>' +
      (wins[0] === wins[1] ? 'Dead even — ' + wins[0] + ' categories each. The differentiator is probably content quality, which numbers can\u2019t see.' :
        '<b>' + TS.esc(wins[0] > wins[1] ? A.ch.snippet.title : B.ch.snippet.title) + '</b> leads ' + Math.max(...wins) + '–' + Math.min(...wins) + ' on measurable fundamentals.') +
      '</p><p class="note">Copy what the winner does better: upload cadence, packaging (titles/thumbnails) and topic selection. Then run a <a href="channel.html?c=' + encodeURIComponent(wins[0] >= wins[1] ? ra : rb) + '" style="text-decoration:underline">full audit</a> for the fix-list.</p></div>';
  } catch (e) { out.innerHTML = TS.apiErrorHtml(e); }
}
function topCat(vids) {
  const f = {};
  vids.forEach(v => { const c = TS.catName(v); f[c] = (f[c] || 0) + 1; });
  return Object.entries(f).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Entertainment';
}
const qa = TS.qs('a'), qb = TS.qs('b');
if (qa && qb) { document.getElementById('qa').value = qa; document.getElementById('qb').value = qb; run(qa, qb); }
else if (qa) { document.getElementById('qa').value = qa; }
