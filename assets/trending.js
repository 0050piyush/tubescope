/* trending explorer */
'use strict';
TS.initNav('trending');
const out = document.getElementById('out');
if (!TS.hasKey()) document.getElementById('gate').innerHTML = TS.gateHtml();

const REGIONS = [['US', 'United States'], ['GB', 'United Kingdom'], ['DE', 'Germany'], ['IN', 'India'], ['CA', 'Canada'], ['AU', 'Australia'], ['FR', 'France'], ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['BR', 'Brazil'], ['MX', 'Mexico'], ['JP', 'Japan'], ['KR', 'South Korea'], ['AE', 'UAE'], ['SA', 'Saudi Arabia'], ['ZA', 'South Africa'], ['NG', 'Nigeria'], ['PH', 'Philippines'], ['ID', 'Indonesia'], ['TR', 'Turkey'], ['PL', 'Poland'], ['SE', 'Sweden'], ['CH', 'Switzerland']];
const regionSel = document.getElementById('region');
regionSel.innerHTML = REGIONS.map(r => '<option value="' + r[0] + '">' + r[1] + '</option>').join('');
const catSel = document.getElementById('cat');

async function loadCats() {
  try {
    const d = await TS.api('videoCategories', { part: 'snippet', regionCode: regionSel.value || 'US' }, 1);
    const cats = (d.items || []).filter(c => c.snippet.assignable).sort((a, b) => a.snippet.title.localeCompare(b.snippet.title));
    catSel.innerHTML = '<option value="">All categories</option>' + cats.map(c => '<option value="' + c.id + '">' + TS.esc(c.snippet.title) + '</option>').join('');
  } catch (e) { /* keep static fallback below */ }
  if (catSel.options.length <= 1) {
    catSel.innerHTML = '<option value="">All categories</option>' + Object.entries(TS.CATEGORIES).map(([id, n]) => '<option value="' + id + '">' + n + '</option>').join('');
  }
}
document.getElementById('go').addEventListener('click', run);
regionSel.addEventListener('change', loadCats);

async function run() {
  out.innerHTML = TS.loadingHtml('Loading trending videos…');
  try {
    const params = { part: 'snippet,statistics,contentDetails', chart: 'mostPopular', regionCode: regionSel.value, maxResults: 24 };
    if (catSel.value) params.videoCategoryId = catSel.value;
    const d = await TS.api('videos', params);
    const items = d.items || [];
    if (!items.length) { out.innerHTML = '<p class="muted">No trending videos returned for this combination.</p>'; return; }
    out.innerHTML = '<p class="small dim mb">Trending in ' + TS.esc(regionSel.selectedOptions[0].text) +
      (catSel.value ? ' · ' + TS.esc(catSel.selectedOptions[0].text) : '') + ' · click any video for its full scorecard</p>' +
      '<div class="vgrid">' + items.map(v =>
        '<a class="vcard" href="video.html?v=' + v.id + '"><img src="' + v.snippet.thumbnails.medium.url + '" loading="lazy" alt="">' +
        '<div class="vb"><div class="vt">' + TS.esc(v.snippet.title) + '</div>' +
        '<div class="vm">' + TS.esc(v.snippet.channelTitle) + ' · ' + TS.fmtNum(v.statistics.viewCount) + ' views · ' + TS.timeAgo(v.snippet.publishedAt) + '</div></div></a>'
      ).join('') + '</div>';
  } catch (e) { out.innerHTML = TS.apiErrorHtml(e); }
}
loadCats().then(run);
