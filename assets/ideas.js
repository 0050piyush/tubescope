/* AI daily ideas */
'use strict';
TS.initNav('ideas');
const out = document.getElementById('out');
if (!TS.hasKey()) document.getElementById('gate').innerHTML = TS.gateHtml();

document.getElementById('f').addEventListener('submit', e => { e.preventDefault(); run(false); });
document.getElementById('again').addEventListener('click', () => run(true));

async function run(force) {
  const raw = document.getElementById('q').value.trim();
  const niche = document.getElementById('niche').value.trim();
  if (!raw && !niche) { TS.toast('Enter a channel or a niche.'); return; }
  out.innerHTML = TS.loadingHtml('Studying what works, then brainstorming…');
  try {
    let ctx = { niche: niche || 'general YouTube', channelTitle: '', subs: 0, top: [], tags: [] };
    if (raw) {
      const id = await TS.resolveChannelId(TS.parseChannelInput(raw));
      const ch = await TS.getChannel(id);
      ctx.channelTitle = ch.snippet.title;
      ctx.subs = +ch.statistics.subscriberCount || 0;
      const items = await TS.getUploadsPlaylistItems(ch.contentDetails.relatedPlaylists.uploads, 30);
      const vids = await TS.getVideosByIds(items.map(i => i.contentDetails.videoId));
      const top = [...vids].sort((a, b) => (+b.statistics.viewCount) - (+a.statistics.viewCount)).slice(0, 10);
      ctx.top = top.map(v => ({ t: v.snippet.title, v: +v.statistics.viewCount }));
      const tf = {};
      vids.forEach(v => (v.snippet.tags || []).forEach(t => tf[t.toLowerCase()] = (tf[t.toLowerCase()] || 0) + 1));
      ctx.tags = Object.entries(tf).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
      if (!niche && ctx.tags.length) ctx.niche = ctx.tags.slice(0, 3).join(', ');
    }
    const cacheKey = 'tubescope_ideas_' + (ctx.channelTitle || ctx.niche) + '_' + new Date().toISOString().slice(0, 10) + (force ? '_r' + Date.now() : '');
    let ideas = readCache(cacheKey);
    if (!ideas) {
      try { ideas = await aiIdeas(ctx); }
      catch (e) { ideas = templateIdeas(ctx); }
      writeCache(cacheKey, ideas);
    }
    renderIdeas(ctx, ideas);
  } catch (e) { out.innerHTML = TS.apiErrorHtml(e); }
}

function buildPrompt(ctx) {
  const tops = ctx.top.map((x, i) => (i + 1) + '. "' + x.t + '" (' + TS.fmtNum(x.v) + ' views)').join('\n');
  return 'You are a YouTube growth strategist. ' +
    (ctx.channelTitle ? 'Channel: "' + ctx.channelTitle + '" (' + TS.fmtNum(ctx.subs) + ' subscribers).\n' : '') +
    'Niche/topics: ' + ctx.niche + '.\n' +
    (tops ? 'Their best-performing videos:\n' + tops + '\n' : '') +
    (ctx.tags.length ? 'Top tags they rank for: ' + ctx.tags.join(', ') + '.\n' : '') +
    'Generate 10 fresh, specific video ideas tailored to this channel/niche. Mix formats: tutorials, challenges, comparisons, listicles, "I tried", myth-busting. ' +
    'Each idea must be concrete (a real title, not a vague topic). Avoid repeating their existing hits; riff on what works.\n' +
    'Return ONLY a raw JSON array, no markdown, no commentary: [{"title":"...","hook":"one-line opening hook","why":"why this can work, referencing their data"}]';
}

async function llm(prompt) {
  const ep = (localStorage.getItem('tubescope_llm_ep') || '').trim();
  const key = (localStorage.getItem('tubescope_llm_key') || '').trim();
  const model = (localStorage.getItem('tubescope_llm_model') || '').trim() || 'gpt-4o-mini';
  if (ep && key) {
    const r = await fetch(ep.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model, temperature: 0.85, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) throw new Error('custom LLM error ' + r.status);
    const j = await r.json();
    const txt = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!txt) throw new Error('empty LLM reply');
    return txt;
  }
  // Free, keyless fallback: Pollinations text API
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch('https://text.pollinations.ai/' + encodeURIComponent(prompt), { signal: ctl.signal });
    if (!r.ok) throw new Error('free AI unavailable (' + r.status + ')');
    return await r.text();
  } finally { clearTimeout(timer); }
}

async function aiIdeas(ctx) {
  const txt = await llm(buildPrompt(ctx));
  const m = txt.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('unparseable AI reply');
  const arr = JSON.parse(m[0]);
  if (!Array.isArray(arr) || !arr.length || !arr[0].title) throw new Error('bad AI shape');
  return arr.slice(0, 10).map(x => ({ title: String(x.title).slice(0, 140), hook: String(x.hook || '').slice(0, 220), why: String(x.why || '').slice(0, 220) }));
}

function templateIdeas(ctx) {
  const n = ctx.niche.split(',')[0].trim() || 'your niche';
  const T = [
    ['I tried ' + n + ' for 30 days — here\u2019s what happened', 'Day 1 vs day 30 split screen', 'Challenge arcs hold retention to the end'],
    ['7 ' + n + ' mistakes beginners always make', '"Mistake #4 cost me…', 'Listicle + stakes = high CTR'],
    [n + ' vs the expensive alternative: honest comparison', 'Side-by-side test', 'Comparisons convert searchers'],
    ['The truth about ' + n + ' nobody tells beginners', 'Start with the myth', 'Curiosity gap drives clicks'],
    ['How I\u2019d start ' + n + ' in 2026 (full roadmap)', '"Step 1 takes 10 minutes"', 'Search-friendly evergreen'],
    ['$0 vs $1,000 ' + n + ' setup', 'Reveal the expensive one last', 'Price contrast is clicky'],
    ['I asked 10 experts about ' + n + ' — they disagreed', 'Best quote as cold open', 'Authority + conflict'],
    ['Stop doing ' + n + ' like this (do this instead)', 'Show the wrong way first', 'Pattern interrupt'],
    [n + ' in 10 minutes: the only guide you need', 'Promise + timer on screen', 'Time-boxed tutorials rank'],
    ['What ' + (ctx.top[0] ? '"' + ctx.top[0].t.slice(0, 40) + '…" got wrong' : 'everyone gets wrong about ' + n), 'Reference the hit, then twist', 'Riffs on proven winners']
  ];
  return T.map(t => ({ title: t[0], hook: t[1], why: t[2] + ' (template fallback — AI was unreachable)' }));
}

function readCache(k) { try { const c = JSON.parse(localStorage.getItem(k) || 'null'); return c && c.exp > Date.now() ? c.ideas : null; } catch (e) { return null; } }
function writeCache(k, ideas) { try { localStorage.setItem(k, JSON.stringify({ exp: Date.now() + 20 * 3600e3, ideas })); } catch (e) {} }

function renderIdeas(ctx, ideas) {
  out.innerHTML = '<p class="small dim mb">' + ideas.length + ' ideas for <b class="muted">' + TS.esc(ctx.channelTitle || ctx.niche) + '</b> · generated ' + new Date().toLocaleDateString() + '</p>' +
    ideas.map((x, i) =>
      '<div class="ideacard"><div class="in"><span>' + (i + 1) + '</span></div><div><div class="it">' + TS.esc(x.title) + '</div>' +
      (x.hook ? '<div class="ih">Hook: ' + TS.esc(x.hook) + '</div>' : '') +
      (x.why ? '<div class="iw">' + TS.esc(x.why) + '</div>' : '') +
      '<div class="ia"><button class="btn ghost sm" data-cp="' + TS.esc(x.title) + '">Copy title</button> ' +
      '<a class="btn ghost sm" href="keywords.html?q=' + encodeURIComponent(x.title) + '">Research it</a></div></div></div>'
    ).join('');
  out.querySelectorAll('[data-cp]').forEach(b => b.addEventListener('click', () => {
    navigator.clipboard.writeText(b.dataset.cp).then(() => TS.toast('Title copied.'));
  }));
}
