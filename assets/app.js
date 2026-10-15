/* TubeScope core engine: YouTube Data API v3 client + estimation models.
   Data: YouTube Data API v3 (free tier, user's own key).
   Estimates: TubeScope Estimates Engine v1 (client-side, heuristic). */
'use strict';
const TS = (() => {
  const LS_KEY = 'tubescope_yt_key', LS_Q = 'tubescope_quota_v1';
  const todayStr = () => new Date().toISOString().slice(0, 10);

  /* ---------- API key + quota ---------- */
  const getKey = () => (localStorage.getItem(LS_KEY) || '').trim();
  const setKey = k => localStorage.setItem(LS_KEY, (k || '').trim());
  const hasKey = () => getKey().length > 10;

  function quota() {
    try { const q = JSON.parse(localStorage.getItem(LS_Q) || '{}'); if (q.d === todayStr()) return q; } catch (e) {}
    return { d: todayStr(), units: 0, calls: 0 };
  }
  function addQuota(n) {
    const q = quota(); q.units += n; q.calls++;
    try { localStorage.setItem(LS_Q, JSON.stringify(q)); } catch (e) {}
    renderQuota();
  }
  function renderQuota() {
    const el = document.getElementById('quota');
    if (!el) return;
    const q = quota();
    el.innerHTML = 'API quota today: <b>' + q.units.toLocaleString() + '</b> / 10,000';
    el.title = q.calls + ' API calls today. Free YouTube Data API v3 quota resets midnight Pacific.';
  }

  /* cost table: https://developers.google.com/youtube/v3/determine_quota_cost */
  async function api(path, params, cost) {
    cost = cost || 1;
    const key = getKey();
    if (!key) throw { noKey: true };
    const url = 'https://www.googleapis.com/youtube/v3/' + path + '?' +
      new URLSearchParams(Object.assign({}, params, { key })).toString();
    let res, data;
    try { res = await fetch(url); }
    catch (e) { throw { net: true, message: 'Network error reaching Google APIs. Check your connection.' }; }
    addQuota(cost);
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      const reason = (data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason) || '';
      throw { status: res.status, reason, message: (data.error && data.error.message) || ('HTTP ' + res.status) };
    }
    return data;
  }

  function apiErrorHtml(e, context) {
    if (e.noKey) return gateHtml();
    let msg = 'Something went wrong.';
    if (e.net) msg = e.message;
    else if (e.reason === 'quotaExceeded' || e.reason === 'dailyLimitExceeded')
      msg = '<b>Daily API quota exhausted.</b> The free YouTube API allows ~10,000 units/day. Quota resets at midnight Pacific Time. ' +
            'Tip: each video analysis costs ~1 unit, each keyword competition check ~100 units.';
    else if (e.reason === 'keyInvalid' || e.status === 400)
      msg = '<b>Invalid API key.</b> Double-check the key in <a href="settings.html" style="text-decoration:underline">Settings</a>.';
    else if (e.status === 403)
      msg = '<b>Access denied (403).</b> Make sure the <b>YouTube Data API v3</b> is enabled for your key in Google Cloud Console. ' + esc(e.message);
    else if (e.status === 404) msg = '<b>Not found.</b> ' + esc(context || 'Check the URL or ID and try again.');
    else msg = '<b>API error' + (e.status ? ' ' + e.status : '') + '.</b> ' + esc(e.message || '');
    return '<div class="err">' + msg + '</div>';
  }

  function gateHtml() {
    return '<div class="gate"><div class="tx"><h3>Connect your free YouTube API key</h3>' +
      '<p>TubeScope reads public YouTube data through the official YouTube Data API v3. ' +
      'The key is free, takes 2 minutes to create, and is stored only in your browser.</p></div>' +
      '<a class="btn" href="settings.html">Set up API key</a></div>';
  }

  /* ---------- parsing ---------- */
  function parseVideoId(input) {
    if (!input) return null;
    input = input.trim();
    if (/^[\w-]{11}$/.test(input)) return input;
    const m = input.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|live\/|embed\/|v\/)|youtu\.be\/|music\.youtube\.com\/watch\?[^#]*v=)([\w-]{11})/);
    return m ? m[1] : null;
  }
  function parseChannelInput(input) {
    if (!input) return null;
    input = input.trim();
    let m;
    if ((m = input.match(/youtube\.com\/channel\/(UC[\w-]{22})/))) return { kind: 'id', value: m[1] };
    if (/^UC[\w-]{22}$/.test(input)) return { kind: 'id', value: input };
    if ((m = input.match(/youtube\.com\/@([\w.\-]+)/))) return { kind: 'handle', value: m[1] };
    if (input.charAt(0) === '@' && /^@[\w.\-]+$/.test(input)) return { kind: 'handle', value: input.slice(1) };
    if ((m = input.match(/youtube\.com\/user\/([\w.\-]+)/))) return { kind: 'user', value: m[1] };
    if ((m = input.match(/youtube\.com\/(?:c\/)?([\w.\-]+)/))) return { kind: 'handle', value: m[1] };
    if (/^[\w.\-]+$/.test(input)) return { kind: 'handle', value: input };
    return null;
  }
  async function resolveChannelId(parsed) {
    if (!parsed) throw { status: 404, message: 'Could not understand that channel input.' };
    if (parsed.kind === 'id') return parsed.value;
    if (parsed.kind === 'handle') {
      const d = await api('channels', { part: 'id', forHandle: parsed.value.replace(/^@/, '') });
      if (d.items && d.items.length) return d.items[0].id;
      throw { status: 404, message: 'No channel found for @' + parsed.value + '. Try the full channel URL.' };
    }
    if (parsed.kind === 'user') {
      const d = await api('channels', { part: 'id', forUsername: parsed.value });
      if (d.items && d.items.length) return d.items[0].id;
      throw { status: 404, message: 'No channel found for user ' + parsed.value + '.' };
    }
    throw { status: 404, message: 'Custom /c/ URLs can\u2019t be resolved by the API \u2014 please use the @handle or /channel/ URL.' };
  }
  async function getVideo(id) {
    const d = await api('videos', { part: 'snippet,statistics,contentDetails,status,topicDetails', id });
    if (!d.items || !d.items.length) throw { status: 404, message: 'Video not found. It may be private, deleted, or the ID is wrong.' };
    return d.items[0];
  }
  async function getChannel(id) {
    const d = await api('channels', { part: 'snippet,statistics,contentDetails,brandingSettings,topicDetails,status', id });
    if (!d.items || !d.items.length) throw { status: 404, message: 'Channel not found.' };
    return d.items[0];
  }
  async function getUploadsPlaylistItems(playlistId, max) {
    max = max || 50;
    const items = [];
    let pageToken = '';
    while (items.length < max) {
      const d = await api('playlistItems', {
        part: 'snippet,contentDetails', playlistId,
        maxResults: Math.min(50, max - items.length), pageToken
      });
      (d.items || []).forEach(it => items.push(it));
      if (!d.nextPageToken || items.length >= max) break;
      pageToken = d.nextPageToken;
    }
    return items;
  }
  async function getVideosByIds(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 50) {
      const d = await api('videos', { part: 'snippet,statistics,contentDetails', id: ids.slice(i, i + 50).join(',') });
      out.push(...(d.items || []));
    }
    return out;
  }

  /* ---------- formatting ---------- */
  function fmtNum(n) {
    n = +n || 0;
    if (n >= 1e9) return trim1(n / 1e9) + 'B';
    if (n >= 1e6) return trim1(n / 1e6) + 'M';
    if (n >= 1e3) return trim1(n / 1e3) + 'K';
    return String(Math.round(n));
  }
  function trim1(x) { return (Math.round(x * 10) / 10).toString(); }
  function fmtInt(n) { return (+n || 0).toLocaleString('en-US'); }
  function fmtMoney(usd) {
    if (usd >= 1e6) return '$' + trim1(usd / 1e6) + 'M';
    if (usd >= 1e3) return '$' + trim1(usd / 1e3) + 'K';
    return '$' + Math.round(usd).toLocaleString('en-US');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function timeAgo(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 3600) return Math.max(1, Math.floor(s / 60)) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hours ago';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' days ago';
    if (s < 86400 * 365) return Math.floor(s / (86400 * 30)) + ' months ago';
    return (s / (86400 * 365)).toFixed(1) + ' years ago';
  }
  function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  function parseDuration(iso) {
    const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  }
  function fmtDuration(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  }
  function isShort(v) { return parseDuration(v.contentDetails && v.contentDetails.duration) <= 61; }

  /* ---------- categories & CPM model (TubeScope Estimates Engine v1) ---------- */
  const CATEGORIES = { 1: 'Film & Animation', 2: 'Autos & Vehicles', 10: 'Music', 15: 'Pets & Animals', 17: 'Sports', 19: 'Travel & Events', 20: 'Gaming', 22: 'People & Blogs', 23: 'Comedy', 24: 'Entertainment', 25: 'News & Politics', 26: 'Howto & Style', 27: 'Education', 28: 'Science & Technology', 29: 'Nonprofits & Activism' };
  const CPM = { /* [low, high] USD per 1000 monetized playbacks, niche baseline */
    'Film & Animation': [3, 8], 'Autos & Vehicles': [6, 14], 'Music': [1.5, 4], 'Pets & Animals': [3, 7],
    'Sports': [3, 7], 'Travel & Events': [5, 12], 'Gaming': [2.5, 6], 'People & Blogs': [3, 8],
    'Comedy': [2, 5], 'Entertainment': [2, 5], 'News & Politics': [3, 8], 'Howto & Style': [6, 15],
    'Education': [6, 15], 'Science & Technology': [8, 20], 'Nonprofits & Activism': [3, 7]
  };
  const COUNTRY_MULT = { /* audience purchasing-power multiplier */
    US: 1.3, GB: 1.2, CA: 1.15, AU: 1.15, DE: 1.05, IE: 1.15, NL: 1.1, SE: 1.1, NO: 1.1, DK: 1.1, FI: 1.05, CH: 1.1,
    FR: 1.0, BE: 1.0, AT: 1.0, IT: 0.9, ES: 0.9, PT: 0.85, GR: 0.8, PL: 0.75, CZ: 0.75, HU: 0.7, RO: 0.65,
    AE: 0.95, SA: 0.75, QA: 0.9, KW: 0.85, IL: 0.9, JP: 0.95, KR: 0.9, SG: 0.95, HK: 0.9, TW: 0.85,
    IN: 0.4, PK: 0.35, BD: 0.3, LK: 0.35, NP: 0.3, PH: 0.4, ID: 0.4, MY: 0.5, TH: 0.5, VN: 0.35,
    BR: 0.5, MX: 0.5, AR: 0.45, CL: 0.55, CO: 0.45, PE: 0.45, NG: 0.3, ZA: 0.5, EG: 0.3, KE: 0.3, GH: 0.3, TR: 0.5, RU: 0.4, UA: 0.4
  };
  const MONETIZED_SHARE = 0.55; /* ~55% of views typically serve ads */
  function catName(v) { return CATEGORIES[(v.snippet && v.snippet.categoryId)] || 'Entertainment'; }
  function cpmRange(category, country) {
    const base = CPM[category] || CPM['Entertainment'];
    const mult = COUNTRY_MULT[(country || '').toUpperCase()] || 0.7;
    return [base[0] * mult, base[1] * mult];
  }
  function revenueRange(views, category, country) {
    const [lo, hi] = cpmRange(category, country);
    const f = (views / 1000) * MONETIZED_SHARE;
    return [f * lo, f * hi];
  }

  /* ---------- monetization likelihood (heuristic; YouTube hides real status) ---------- */
  function monetizationVerdict(ch, recent) {
    const s = ch.statistics || {}, sn = ch.snippet || {}, st = ch.status || {};
    const subs = +s.subscriberCount || 0, vids = +s.videoCount || 0;
    const reasons = [];
    let score = 0, hardFail = false;
    if (/topic/i.test(sn.title || '') && /auto-generated/i.test(sn.description || '')) {
      hardFail = true;
      reasons.push(['fail', 'Auto-generated Topic channel \u2014 these are not creator channels in the Partner Program.']);
    }
    if (st.madeForKids) { hardFail = true; reasons.push(['fail', 'Channel is marked "made for kids" \u2014 no personalized ads.']); }
    if (subs >= 1000) { score += 40; reasons.push(['pass', fmtNum(subs) + ' subscribers \u2014 clears the 1,000-sub YPP threshold.']); }
    else if (subs >= 500) { score += 18; reasons.push(['warn', fmtNum(subs) + ' subscribers \u2014 meets the 500-sub Shorts/fan-funding tier, needs 1,000 for full ad revenue.']); }
    else { reasons.push(['fail', 'Only ' + fmtNum(subs) + ' subscribers \u2014 needs 1,000 for the YouTube Partner Program.']); }
    if (vids >= 5) { score += 10; reasons.push(['pass', fmtInt(vids) + ' public videos shows an established catalog.']); }
    else reasons.push(['warn', 'Only ' + vids + ' public video(s) \u2014 thin catalog.']);
    if (recent && recent.daysSinceUpload != null) {
      if (recent.daysSinceUpload <= 90) { score += 20; reasons.push(['pass', 'Active \u2014 last upload ' + recent.daysSinceUpload + ' day(s) ago.']); }
      else { score -= 10; reasons.push(['warn', 'Inactive \u2014 last upload ' + recent.daysSinceUpload + ' days ago.']); }
    }
    const totalViews = +s.viewCount || 0;
    if (totalViews > 500000) { score += 15; reasons.push(['pass', fmtNum(totalViews) + ' lifetime views suggests watch-time requirements are plausibly met.']); }
    else reasons.push(['warn', 'Watch-time requirement (4,000 hrs / 10M Shorts views) can\u2019t be verified externally.']);
    let verdict, cls;
    if (hardFail) { verdict = 'Probably not monetized'; cls = 'r'; }
    else if (score >= 60) { verdict = 'Likely monetized'; cls = 'g'; }
    else if (score >= 30) { verdict = 'Possibly monetized'; cls = 'a'; }
    else { verdict = 'Probably not monetized'; cls = 'r'; }
    return { verdict, cls, score: Math.max(0, Math.min(100, score)), reasons };
  }

  /* ---------- video SEO score (vidIQ-style checklist) ---------- */
  function videoSeoScore(v) {
    const sn = v.snippet || {}, st = v.statistics || {};
    const checks = [];
    const title = sn.title || '', desc = sn.description || '', tags = sn.tags || [];
    const views = +st.viewCount || 0, likes = +st.likeCount || 0, comments = +st.commentCount || 0;
    const add = (label, state, detail, w) => checks.push({ label, state, detail, w });
    if (title.length >= 30 && title.length <= 70) add('Title length is optimal (30\u201370 chars)', 'pass', title.length + ' characters', 12);
    else if (title.length > 0) add('Title length could be better', 'warn', title.length + ' characters \u2014 aim for 30\u201370', 12);
    else add('Missing title', 'fail', '', 12);
    const caps = (title.match(/[A-Z]/g) || []).length;
    if (title.length > 15 && caps / title.length > 0.6) add('Title is ALL CAPS', 'warn', 'Hurts click-through for most niches', 6);
    else add('Title casing looks natural', 'pass', '', 6);
    if (desc.length >= 300) add('Description is detailed', 'pass', fmtInt(desc.length) + ' characters', 12);
    else if (desc.length >= 150) add('Description is decent', 'warn', fmtInt(desc.length) + ' chars \u2014 300+ is ideal', 12);
    else add('Description is too thin', 'fail', fmtInt(desc.length) + ' chars \u2014 add keywords & links', 12);
    if (/https?:\/\//.test(desc)) add('Description contains links', 'pass', 'Drives off-platform actions', 6);
    else add('No links in description', 'warn', 'Add socials / offers / affiliates', 6);
    if (tags.length >= 3 && tags.length <= 20) add('Healthy tag count', 'pass', tags.length + ' tags', 10);
    else if (tags.length > 20) add('Too many tags', 'warn', tags.length + ' tags \u2014 YouTube ignores the excess', 10);
    else add('Few or no tags', 'fail', tags.length + ' tags \u2014 add 5\u201315 relevant ones', 10);
    const hashCount = ((title + ' ' + desc).match(/#[\w]+/g) || []).length;
    if (hashCount >= 1 && hashCount <= 5) add('Hashtags in use', 'pass', hashCount + ' found', 5);
    else if (hashCount > 5) add('Too many hashtags', 'warn', hashCount + ' \u2014 only first 3 show above the title', 5);
    else add('No hashtags', 'warn', '1\u20133 hashtags can aid discovery', 5);
    if (st.commentCount !== undefined) add('Comments are enabled', 'pass', fmtNum(comments) + ' comments', 6);
    else add('Comments disabled or hidden', 'warn', 'Loses engagement signals', 6);
    if (views > 100) {
      const lr = likes / views;
      if (lr >= 0.03) add('Strong like ratio', 'pass', (lr * 100).toFixed(1) + '% of viewers liked', 12);
      else if (lr >= 0.01) add('Average like ratio', 'warn', (lr * 100).toFixed(1) + '% \u2014 3%+ is strong', 12);
      else add('Low like ratio', 'fail', (lr * 100).toFixed(2) + '% \u2014 improve hook/CTA', 12);
      const cr = comments / views;
      if (cr >= 0.002) add('Healthy comment rate', 'pass', (cr * 100).toFixed(2) + '% comment rate', 6);
      else add('Low comment rate', 'warn', 'Ask a question in the video', 6);
    } else { add('Not enough views to judge engagement', 'na', '', 18); }
    const live = v.contentDetails && v.contentDetails.duration;
    if (parseDuration(live) > 0) add('Watch-time eligible format', 'pass', fmtDuration(parseDuration(live)) + ' runtime', 5);
    let score = 0, total = 0;
    checks.forEach(c => { total += c.w; if (c.state === 'pass') score += c.w; else if (c.state === 'warn') score += c.w * 0.5; });
    return { score: Math.round(score / total * 100), checks };
  }

  /* ---------- channel stats from uploads ---------- */
  function analyzeUploads(videos) {
    if (!videos.length) return null;
    const now = Date.now();
    const withStats = videos.filter(v => v.statistics);
    const views = withStats.map(v => +v.statistics.viewCount || 0).sort((a, b) => a - b);
    const avg = views.reduce((a, b) => a + b, 0) / Math.max(1, views.length);
    const median = views[Math.floor(views.length / 2)] || 0;
    const dates = videos.map(v => new Date(v.snippet.publishedAt).getTime()).sort((a, b) => a - b);
    const spanDays = Math.max(1, (dates[dates.length - 1] - dates[0]) / 864e5);
    const perMonth = videos.length / spanDays * 30.44;
    const daysSinceUpload = Math.round((now - dates[dates.length - 1]) / 864e5);
    const cutoff = now - 30 * 864e5;
    let mViews = 0, mCount = 0;
    withStats.forEach(v => { if (new Date(v.snippet.publishedAt).getTime() >= cutoff) { mViews += +v.statistics.viewCount || 0; mCount++; } });
    const shorts = videos.filter(isShort).length;
    const likes = withStats.map(v => +v.statistics.likeCount || 0);
    const avgLikes = likes.reduce((a, b) => a + b, 0) / Math.max(1, likes.length);
    const engRate = avg > 0 ? (avgLikes / avg * 100) : 0;
    const top = [...withStats].sort((a, b) => (+b.statistics.viewCount) - (+a.statistics.viewCount)).slice(0, 10);
    const tagFreq = {};
    withStats.forEach(v => (v.snippet.tags || []).forEach(t => { tagFreq[t.toLowerCase()] = (tagFreq[t.toLowerCase()] || 0) + 1; }));
    const topTags = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const byDay = [0, 0, 0, 0, 0, 0, 0], byHour = new Array(24).fill(0);
    videos.forEach(v => { const d = new Date(v.snippet.publishedAt); byDay[d.getUTCDay()]++; byHour[d.getUTCHours()]++; });
    return { avg, median, perMonth, daysSinceUpload, monthlyViews: mViews, monthlyCount: mCount, shorts, shortsPct: shorts / videos.length, engRate, top, topTags, byDay, byHour, count: videos.length };
  }

  function channelHealthScore(ch, a) {
    const checks = [];
    const add = (l, s, d, w) => checks.push({ label: l, state: s, detail: d, w });
    const desc = (ch.snippet.description || '');
    if (desc.length >= 200) add('Channel description is complete', 'pass', fmtInt(desc.length) + ' chars', 15);
    else if (desc.length >= 50) add('Channel description is thin', 'warn', 'Expand with keywords + links', 15);
    else add('Channel description missing', 'fail', 'Hurts search discovery', 15);
    const links = (ch.brandingSettings && ch.brandingSettings.channel && ch.brandingSettings.channel.featuredChannelsUrls) || [];
    if (links.length) add('External links added', 'pass', links.length + ' link(s)', 10); else add('No external links', 'warn', 'Add website/socials', 10);
    if (a) {
      if (a.perMonth >= 4) add('Consistent upload schedule', 'pass', a.perMonth.toFixed(1) + ' uploads/month', 20);
      else if (a.perMonth >= 1) add('Uploads could be more frequent', 'warn', a.perMonth.toFixed(1) + '/month', 20);
      else add('Uploads are rare', 'fail', a.perMonth.toFixed(1) + '/month', 20);
      if (a.engRate >= 2) add('Strong audience engagement', 'pass', a.engRate.toFixed(1) + '% like rate', 15);
      else if (a.engRate >= 0.8) add('Average engagement', 'warn', a.engRate.toFixed(1) + '% like rate', 15);
      else add('Low engagement', 'fail', a.engRate.toFixed(1) + '% like rate', 15);
      if (a.median > 0 && a.avg / a.median < 5) add('Views are consistent', 'pass', 'No wild outliers', 10);
      else add('Views are hit-driven', 'warn', 'A few outliers carry the channel', 10);
    } else { add('Not enough public videos to judge consistency', 'na', '', 45); }
    const topics = (ch.topicDetails && ch.topicDetails.topicCategories) || [];
    if (topics.length) add('Topic categories set', 'pass', topics.length + ' categor(ies)', 10); else add('No topic categories', 'warn', '', 10);
    if ((ch.snippet.customUrl || ch.snippet.handle)) add('Custom handle claimed', 'pass', esc(ch.snippet.customUrl || ''), 10);
    else add('No custom handle', 'warn', 'Claim youtube.com/@yourname', 10);
    let score = 0, total = 0;
    checks.forEach(c => { total += c.w; if (c.state === 'pass') score += c.w; else if (c.state === 'warn') score += c.w * 0.5; });
    return { score: Math.round(score / total * 100), checks };
  }

  /* ---------- UI helpers ---------- */
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  function loadingHtml(text) {
    return '<div class="loading"><div class="spin"></div><div>' + esc(text || 'Fetching data\u2026') + '</div></div>';
  }
  function ring(score, label) {
    const c = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ff3b30';
    const r = 46, circ = 2 * Math.PI * r, off = circ * (1 - score / 100);
    return '<div class="ring"><svg width="110" height="110"><circle cx="55" cy="55" r="' + r + '" fill="none" stroke="#1f1f26" stroke-width="10"/>' +
      '<circle cx="55" cy="55" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
      '</svg><div class="num"><b>' + score + '</b><span>' + esc(label || 'score') + '</span></div></div>';
  }
  function checksHtml(checks) {
    return '<ul class="checks">' + checks.map(c =>
      '<li><span class="dot ' + c.state + '"></span><div><div>' + esc(c.label) + '</div>' +
      (c.detail ? '<div class="dim small">' + c.detail + '</div>' : '') + '</div></li>').join('') + '</ul>';
  }
  function barsHtml(rows, maxVal) {
    maxVal = maxVal || Math.max(...rows.map(r => r[1]), 1);
    return '<div class="bars">' + rows.map(r =>
      '<div class="barrow"><div class="bl">' + esc(r[0]) + '</div><div class="bartrack"><div class="barfill" style="width:' + Math.max(2, r[1] / maxVal * 100).toFixed(1) + '%"></div></div><div class="bv">' + esc(r[2] || fmtNum(r[1])) + '</div></div>').join('') + '</div>';
  }
  function initNav(active) {
    document.querySelectorAll('nav.main a').forEach(a => { if (a.dataset.p === active) a.classList.add('on'); });
    renderQuota();
  }
  function qs(name) { return new URLSearchParams(location.search).get(name); }

  return {
    getKey, setKey, hasKey, quota, api, apiErrorHtml, gateHtml,
    parseVideoId, parseChannelInput, resolveChannelId, getVideo, getChannel,
    getUploadsPlaylistItems, getVideosByIds,
    fmtNum, fmtInt, fmtMoney, esc, timeAgo, fmtDate, parseDuration, fmtDuration, isShort,
    CATEGORIES, catName, cpmRange, revenueRange,
    monetizationVerdict, videoSeoScore, analyzeUploads, channelHealthScore,
    toast, loadingHtml, ring, checksHtml, barsHtml, initNav, qs
  };
})();
