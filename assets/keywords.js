/* keyword research: autocomplete ideas + competition scoring */
'use strict';
TS.initNav('keywords');
const out = document.getElementById('out');
if (!TS.hasKey()) document.getElementById('gate').innerHTML = TS.gateHtml();

document.getElementById('f').addEventListener('submit', e => {
  e.preventDefault();
  const q = document.getElementById('q').value.trim();
  if (!q) return;
  history.replaceState(null, '', 'keywords.html?q=' + encodeURIComponent(q));
  run(q);
});

async function run(seed) {
  out.innerHTML = TS.loadingHtml('Gathering keyword ideas…');
  try {
    let ideas = await ytSuggest(seed);
    let src = 'YouTube autocomplete';
    if (!ideas.length) {
      ideas = await fallbackIdeas(seed);
      src = 'top-ranking video titles (autocomplete blocked)';
    }
    ideas = [...new Set([seed, ...ideas])].slice(0, 12);
    renderIdeas(seed, ideas, src);
  } catch (e) { out.innerHTML = TS.apiErrorHtml(e); }
}

function renderIdeas(seed, ideas, src) {
  let html = '<p class="small dim mb">Seed: <b class="muted">' + TS.esc(seed) + '</b> · ' + ideas.length + ' ideas · source: ' + TS.esc(src) + '</p>';
  html += '<div class="tblwrap"><table class="tbl"><tr><th>Keyword idea</th><th class="num">Opportunity</th><th></th></tr>' +
    ideas.map((k, i) => '<tr><td><b>' + TS.esc(k) + '</b></td>' +
      '<td class="num"><span class="dim" id="op' + i + '">—</span></td>' +
      '<td style="white-space:nowrap"><button class="btn ghost sm" data-k="' + TS.esc(k) + '" data-i="' + i + '">Score it</button></td></tr>').join('') +
    '</table></div><div id="detail" class="mt"></div>';
  html += '<p class="note">Scoring one keyword costs ~100 API units (YouTube charges heavily for search). Score your top 2–3 picks only.</p>';
  out.innerHTML = html;
  out.querySelectorAll('button[data-k]').forEach(b => b.addEventListener('click', () => scoreKeyword(b.dataset.k, +b.dataset.i, b)));
}

async function scoreKeyword(k, i, btn) {
  btn.disabled = true; btn.textContent = 'Scoring…';
  const detail = document.getElementById('detail');
  try {
    const d = await TS.api('search', { part: 'snippet', q: k, type: 'video', maxResults: 5, order: 'relevance' }, 100);
    const total = d.pageInfo ? +d.pageInfo.totalResults || 0 : 0;
    const items = d.items || [];
    // competition: fewer competing videos = higher opportunity
    const log = Math.log10(total + 1);
    const compScore = Math.max(0, Math.min(100, 100 - log * 13));
    const words = k.trim().split(/\s+/).length;
    const tailBonus = words >= 4 ? 18 : words === 3 ? 10 : words === 2 ? 4 : 0;
    const score = Math.round(Math.min(100, compScore * 0.75 + tailBonus));
    const cls = score >= 70 ? 'g' : score >= 45 ? 'a' : 'r';
    const compLabel = total > 5e6 ? 'Very high' : total > 1e6 ? 'High' : total > 200000 ? 'Medium' : 'Low';
    document.getElementById('op' + i).innerHTML = '<span class="badge ' + cls + '">' + score + '/100</span>';
    detail.innerHTML = '<div class="card"><h3>"' + TS.esc(k) + '" — opportunity ' + score + '/100</h3>' +
      TS.barsHtml([
        ['Competition', compScore, compLabel + ' (' + TS.fmtNum(total) + ' videos)'],
        ['Long-tail bonus', tailBonus, words + ' words']
      ]) +
      '<h3 class="mt">Currently ranking top 5</h3><div class="tblwrap"><table class="tbl"><tr><th>Video</th><th class="num">Published</th></tr>' +
      items.map(v => '<tr><td><a class="t" href="video.html?v=' + v.id.videoId + '"><img src="' + v.snippet.thumbnails.medium.url + '" loading="lazy" alt=""><span class="tt">' + TS.esc(v.snippet.title) + '<br><span class="dim">' + TS.esc(v.snippet.channelTitle) + '</span></span></a></td><td class="num">' + TS.timeAgo(v.snippet.publishedAt) + '</td></tr>').join('') +
      '</table></div><p class="note">Opportunity is heuristic: lower competition + longer-tail phrasing scores higher. ' +
      'If the top results are small channels, that keyword is genuinely winnable.</p></div>';
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) { detail.innerHTML = TS.apiErrorHtml(e); }
  btn.disabled = false; btn.textContent = 'Score it';
}

/* YouTube autocomplete (unofficial, free, no key). CORS-blocked in most browsers → proxy fallback. */
async function ytSuggest(q) {
  const target = 'https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=' + encodeURIComponent(q);
  const tries = [target, 'https://api.allorigins.win/raw?url=' + encodeURIComponent(target)];
  for (const u of tries) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const j = await r.json();
      if (Array.isArray(j) && Array.isArray(j[1])) return j[1].map(x => x[0]).filter(Boolean);
    } catch (e) { /* try next */ }
  }
  return [];
}
/* fallback: derive ideas from words in top-ranking titles */
async function fallbackIdeas(seed) {
  try {
    const d = await TS.api('search', { part: 'snippet', q: seed, type: 'video', maxResults: 10, order: 'relevance' }, 100);
    const phrases = new Set();
    (d.items || []).forEach(v => {
      const t = v.snippet.title.toLowerCase().replace(/[|–—:]/g, ' ').split(/\s+/);
      for (let n = 3; n <= 5; n++)
        for (let i = 0; i + n <= t.length; i++) {
          const p = t.slice(i, i + n).join(' ');
          if (p.includes(seed.toLowerCase().split(' ')[0]) && p.length > seed.length + 3) phrases.add(p);
        }
    });
    return [...phrases].slice(0, 10);
  } catch (e) { return []; }
}
const q0 = TS.qs('q');
if (q0) { document.getElementById('q').value = q0; run(q0); }
