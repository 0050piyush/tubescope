/* video analyzer */
'use strict';
TS.initNav('video');
const out = document.getElementById('out');
if (!TS.hasKey()) document.getElementById('gate').innerHTML = TS.gateHtml();

document.getElementById('f').addEventListener('submit', e => {
  e.preventDefault();
  const id = TS.parseVideoId(document.getElementById('q').value);
  if (!id) { TS.toast('Could not find a video ID in that input.'); return; }
  history.replaceState(null, '', 'video.html?v=' + id);
  run(id);
});

async function run(id) {
  out.innerHTML = TS.loadingHtml('Analyzing video…');
  try {
    const v = await TS.getVideo(id);
    const sn = v.snippet, st = v.statistics, cd = v.contentDetails;
    const seo = TS.videoSeoScore(v);
    const views = +st.viewCount || 0, likes = +st.likeCount || 0, comments = +st.commentCount || 0;
    const ageDays = Math.max(1, (Date.now() - new Date(sn.publishedAt).getTime()) / 864e5);
    const vpd = views / ageDays;
    const category = TS.catName(v);
    let chCountry = '', chSubs = 0, chId = sn.channelId;
    try {
      const ch = await TS.getChannel(sn.channelId);
      chCountry = ch.snippet.country || ''; chSubs = +ch.statistics.subscriberCount || 0;
    } catch (e) { /* channel fetch optional */ }
    const [rLo, rHi] = TS.revenueRange(views, category, chCountry);
    const dur = TS.parseDuration(cd.duration);
    const tags = sn.tags || [];
    const desc = sn.description || '';
    const hashCount = ((sn.title + ' ' + desc).match(/#[\w]+/g) || []).length;

    let html = '<div class="vid-head">' +
      '<a href="https://www.youtube.com/watch?v=' + id + '" target="_blank" rel="noopener"><img class="thumb" src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg" alt="thumbnail" loading="lazy"></a>' +
      '<div class="meta"><h1>' + TS.esc(sn.title) + '</h1>' +
      '<a class="chanline" href="channel.html?c=' + chId + '"><span class="nm">' + TS.esc(sn.channelTitle) + '</span>' +
      (chSubs ? '<span class="sb">' + TS.fmtNum(chSubs) + ' subscribers</span>' : '') + '</a>' +
      '<div class="pub">Published ' + TS.fmtDate(sn.publishedAt) + ' (' + TS.timeAgo(sn.publishedAt) + ') · ' + TS.esc(category) + ' · ' + TS.fmtDuration(dur) + (TS.isShort(v) ? ' · <span class="badge r">Short</span>' : '') + '</div>' +
      '</div></div>';

    html += '<div class="stats">' +
      stat('Views', TS.fmtNum(views), TS.fmtNum(vpd) + ' / day') +
      stat('Likes', TS.fmtNum(likes), views ? (likes / views * 100).toFixed(2) + '% like ratio' : '') +
      stat('Comments', TS.fmtNum(comments), views ? (comments / views * 100).toFixed(2) + '% comment rate' : '') +
      stat('Tags', tags.length, hashCount + ' hashtag(s)') +
      stat('Description', TS.fmtNum(desc.length) + ' chars', desc.length >= 300 ? 'Detailed' : 'Thin — expand it') +
      '</div>';

    html += '<div class="panels">' +
      '<div class="card"><h3>SEO Score</h3><div class="ringwrap">' + TS.ring(seo.score, 'seo') +
      '<div class="small muted">' + seoVerdict(seo.score) + '</div></div>' + TS.checksHtml(seo.checks) + '</div>' +
      '<div class="card money"><h3>Estimated ad revenue</h3><div class="amt">' + TS.fmtMoney(rLo) + ' – ' + TS.fmtMoney(rHi) + '</div>' +
      '<div class="rng">Lifetime gross from ~' + TS.fmtNum(views) + ' views · ' + TS.esc(category) + (chCountry ? ' · audience ' + TS.esc(chCountry) : '') + '</div>' +
      '<p class="note">Heuristic estimate: niche CPM model × 55% monetized-playback share. Actual revenue depends on audience geography, season, ad inventory and the channel\u2019s real monetization status. Not official data.</p>' +
      '<div class="mt"><button class="btn ghost sm" id="capBtn">Check captions (50 units)</button> <span class="small dim" id="capOut"></span></div></div>' +
      '</div>';

    if (tags.length) {
      html += '<div class="card mb"><h3>Tags (' + tags.length + ')</h3><div class="tags">' +
        tags.map((t, i) => '<span class="tag' + (i < 3 ? ' hot' : '') + '">' + TS.esc(t) + '</span>').join('') + '</div>' +
        '<p class="note">First tags carry the most weight. ' + (tags.length > 15 ? 'YouTube largely ignores tags beyond ~15.' : 'Aim for 5\u201315 highly relevant tags.') + '</p></div>';
    }
    html += '<div class="card"><h3>Description preview</h3><p class="small muted" style="white-space:pre-wrap;max-height:220px;overflow:auto">' +
      TS.esc(desc.slice(0, 1200)) + (desc.length > 1200 ? '\n…' : '') + '</p></div>';

    out.innerHTML = html;

    const capBtn = document.getElementById('capBtn');
    capBtn.addEventListener('click', async () => {
      capBtn.disabled = true; document.getElementById('capOut').textContent = 'checking…';
      try {
        const d = await TS.api('captions', { part: 'snippet', videoId: id }, 50);
        const n = (d.items || []).length;
        document.getElementById('capOut').innerHTML = n ? '<span class="badge g">' + n + ' caption track(s) found</span>' : '<span class="badge a">No captions found</span>';
      } catch (e) { document.getElementById('capOut').textContent = 'could not check'; }
      capBtn.disabled = false;
    });
  } catch (e) { out.innerHTML = TS.apiErrorHtml(e); }
}
function stat(k, v, d) { return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div></div>'; }
function seoVerdict(s) {
  if (s >= 80) return 'Excellent — this video is well optimized. Minor tweaks only.';
  if (s >= 60) return 'Good foundation. Fix the flagged items to squeeze more search & suggested traffic.';
  if (s >= 40) return 'Needs work — the checklist below is your fix-list before publishing the next one.';
  return 'Poor optimization. Treat the checklist as a pre-publish template.';
}
const q0 = TS.qs('v');
if (q0) { document.getElementById('q').value = q0; run(TS.parseVideoId(q0) || q0); }
