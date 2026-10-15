/* channel analyzer */
'use strict';
TS.initNav('channel');
const out = document.getElementById('out');
if (!TS.hasKey()) document.getElementById('gate').innerHTML = TS.gateHtml();

document.getElementById('f').addEventListener('submit', e => {
  e.preventDefault();
  const raw = document.getElementById('q').value.trim();
  if (!raw) return;
  history.replaceState(null, '', 'channel.html?c=' + encodeURIComponent(raw));
  run(raw);
});

async function run(raw) {
  out.innerHTML = TS.loadingHtml('Auditing channel…');
  try {
    const parsed = TS.parseChannelInput(raw);
    const id = await TS.resolveChannelId(parsed);
    const ch = await TS.getChannel(id);
    const sn = ch.snippet, st = ch.statistics;
    const uploadsId = ch.contentDetails.relatedPlaylists.uploads;

    out.innerHTML = TS.loadingHtml('Analyzing recent uploads…');
    const items = await TS.getUploadsPlaylistItems(uploadsId, 50);
    const vids = await TS.getVideosByIds(items.map(i => i.contentDetails.videoId));
    const a = TS.analyzeUploads(vids);
    const health = TS.channelHealthScore(ch, a);
    const mon = TS.monetizationVerdict(ch, a);

    // earnings
    const country = sn.country || '';
    const mainCat = topCategory(vids);
    let monthlyViews = a && a.monthlyViews > 0 ? a.monthlyViews : 0;
    let monthlyNote;
    if (monthlyViews > 0) { monthlyNote = 'from ' + a.monthlyCount + ' video(s) published in the last 30 days'; }
    else {
      const ageDays = Math.max(30, (Date.now() - new Date(sn.publishedAt).getTime()) / 864e5);
      monthlyViews = (+st.viewCount || 0) / ageDays * 30;
      monthlyNote = 'estimated from lifetime views ÷ channel age (no uploads in last 30 days)';
    }
    const [eLo, eHi] = TS.revenueRange(monthlyViews, mainCat, country);
    const [tLo, tHi] = TS.revenueRange(+st.viewCount || 0, mainCat, country);

    const subs = +st.subscriberCount || 0;
    const avatar = (sn.thumbnails && sn.thumbnails.medium && sn.thumbnails.medium.url) || '';

    let html = '<div class="vid-head">' +
      (avatar ? '<img class="avatar" style="width:72px;height:72px" src="' + avatar + '" alt="">' : '') +
      '<div class="meta"><h1>' + TS.esc(sn.title) + ' <span class="badge ' + mon.cls + '">' + mon.verdict + '</span></h1>' +
      '<div class="pub">' + TS.esc(sn.customUrl ? '@' + sn.customUrl.replace('@', '') : '') + (country ? ' · ' + TS.esc(country) : '') +
      ' · Joined ' + TS.fmtDate(sn.publishedAt) + ' · <a href="https://www.youtube.com/channel/' + id + '" target="_blank" rel="noopener" style="text-decoration:underline">Open on YouTube</a> ' +
      '· <a href="compare.html?a=' + encodeURIComponent(raw) + '" style="text-decoration:underline">Compare</a></div></div></div>';

    html += '<div class="stats">' +
      stat('Subscribers', TS.fmtNum(subs), '') +
      stat('Total views', TS.fmtNum(st.viewCount), '') +
      stat('Videos', TS.fmtInt(st.videoCount), a ? a.perMonth.toFixed(1) + ' uploads / month' : '') +
      stat('Avg views / video', a ? TS.fmtNum(a.avg) : '—', a ? 'median ' + TS.fmtNum(a.median) : '') +
      stat('Last upload', a ? (a.daysSinceUpload === 0 ? 'today' : a.daysSinceUpload + 'd ago') : '—', a ? Math.round(a.shortsPct * 100) + '% Shorts (last 50)' : '') +
      '</div>';

    html += '<div class="panels">' +
      '<div class="card money"><h3>Estimated monthly earnings</h3><div class="amt">' + TS.fmtMoney(eLo) + ' – ' + TS.fmtMoney(eHi) + '</div>' +
      '<div class="rng">from ~' + TS.fmtNum(monthlyViews) + ' monthly views · ' + TS.esc(mainCat) + (country ? ' · ' + TS.esc(country) : '') + '</div>' +
      '<div class="small dim mt">' + monthlyNote + '</div>' +
      '<p class="note">Heuristic range from niche CPM × 55% monetized-playback share. Excludes memberships, sponsors, affiliates and Shorts-bonus differences. Real revenue varies widely.</p></div>' +
      '<div class="card"><h3>Monetization check</h3><div class="mb"><span class="badge ' + mon.cls + '">' + mon.verdict + '</span></div>' +
      TS.checksHtml(mon.reasons) +
      '<p class="note">YouTube hides real monetization status. This verdict scores public YPP criteria (subs, activity, kids-status, channel type). Confidence: ' + mon.score + '/100.</p></div>' +
      '</div>';

    html += '<div class="panels">' +
      '<div class="card"><h3>Channel health score</h3><div class="ringwrap">' + TS.ring(health.score, 'health') +
      '<div class="small muted">' + healthVerdict(health.score) + '</div></div>' + TS.checksHtml(health.checks) + '</div>' +
      '<div class="card"><h3>Lifetime estimated revenue</h3><div class="amt" style="font-size:26px">' + TS.fmtMoney(tLo) + ' – ' + TS.fmtMoney(tHi) + '</div>' +
      '<div class="rng">from ' + TS.fmtNum(st.viewCount) + ' lifetime views</div>' +
      '<h3 class="mt">Upload rhythm (last 50)</h3>' + (a ? TS.barsHtml([
        ['Uploads / month', a.perMonth, a.perMonth.toFixed(1) + '/mo'],
        ['Avg views', a.avg, TS.fmtNum(a.avg)],
        ['Engagement', a.engRate, a.engRate.toFixed(1) + '%'],
        ['Shorts share', a.shortsPct * 100, Math.round(a.shortsPct * 100) + '%']
      ], 100) : '<p class="muted small">No public videos found.</p>') +
      '<p class="note">Best upload weekday (last 50): <b>' + (a ? weekdayName(topIdx(a.byDay)) : '—') + '</b>. Posting when your audience is online compounds the first-hour velocity signal.</p></div>' +
      '</div>';

    if (a && a.top.length) {
      html += '<h3 class="mt">Top videos (last 50 uploads)</h3><div class="tblwrap"><table class="tbl"><tr><th>Video</th><th class="num">Views</th><th class="num">Likes</th><th class="num">Comments</th><th class="num">Age</th></tr>' +
        a.top.map(v => '<tr><td><a class="t" href="video.html?v=' + v.id + '"><img src="https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg" loading="lazy" alt=""><span class="tt">' + TS.esc(v.snippet.title) + '</span></a></td>' +
          '<td class="num">' + TS.fmtNum(v.statistics.viewCount) + '</td><td class="num">' + TS.fmtNum(v.statistics.likeCount) + '</td>' +
          '<td class="num">' + TS.fmtNum(v.statistics.commentCount) + '</td><td class="num">' + TS.timeAgo(v.snippet.publishedAt) + '</td></tr>').join('') +
        '</table></div>';
    }
    if (a && a.topTags.length) {
      html += '<div class="card mb"><h3>Top tags this channel ranks for</h3><div class="tags">' +
        a.topTags.map(t => '<a class="tag" href="keywords.html?q=' + encodeURIComponent(t[0]) + '">' + TS.esc(t[0]) + ' ×' + t[1] + '</a>').join('') +
        '</div><p class="note">Click a tag to research it as a keyword.</p></div>';
      html += '<div class="card"><h3>Content ideas from what works here</h3>' + ideasHtml(a.topTags.slice(0, 5), mainCat) + '</div>';
    }
    html += '<p class="note">Audit cost: ~4 API units. Data is public via the YouTube Data API v3.</p>';
    out.innerHTML = html;
  } catch (e) { out.innerHTML = TS.apiErrorHtml(e); }
}

function stat(k, v, d) { return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (d ? '<div class="d">' + d + '</div>' : '') + '</div>'; }
function healthVerdict(s) {
  if (s >= 80) return 'Strong channel fundamentals. Keep the cadence.';
  if (s >= 60) return 'Solid, with clear gaps — the checklist is the growth roadmap.';
  if (s >= 40) return 'Shaky foundations. Fix metadata + consistency first.';
  return 'Needs a rebuild of basics: description, links, cadence.';
}
function topCategory(vids) {
  const f = {};
  vids.forEach(v => { const c = TS.catName(v); f[c] = (f[c] || 0) + 1; });
  return Object.entries(f).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Entertainment';
}
function topIdx(arr) { return arr.indexOf(Math.max(...arr)); }
function weekdayName(i) { return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]; }
function ideasHtml(tags, cat) {
  const t = tags.map(x => x[0]);
  const templates = [
    ['I tried ' + (t[0] || cat) + ' for 30 days — here\u2019s what happened', 'Challenge format drives retention'],
    [(t[0] || cat) + ' vs ' + (t[1] || 'the alternative') + ': which is actually better?', 'Comparison titles earn high CTR'],
    ['7 ' + (t[1] || cat) + ' mistakes beginners always make', 'Listicle + "mistakes" angle'],
    ['The truth about ' + (t[2] || t[0] || cat) + ' nobody tells you', 'Curiosity gap'],
    ['How I\u2019d start ' + (t[0] || cat) + ' in 2026 (step by step)', 'Search-friendly tutorial']
  ];
  return templates.map(x => '<div class="idea">' + TS.esc(x[0]) + '<div class="why">' + TS.esc(x[1]) + ' · built from this channel\u2019s top tags</div></div>').join('');
}
const q0 = TS.qs('c');
if (q0) { document.getElementById('q').value = q0; run(q0); }
