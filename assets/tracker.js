/* competitor tracker: watchlist + snapshot history + velocity alerts */
'use strict';
TS.initNav('tracker');
const out = document.getElementById('out');
if (!TS.hasKey()) document.getElementById('gate').innerHTML = TS.gateHtml();
const LS = 'tubescope_watchlist_v1';

const get = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } };
const set = l => { try { localStorage.setItem(LS, JSON.stringify(l)); } catch (e) {} };

document.getElementById('f').addEventListener('submit', async e => {
  e.preventDefault();
  const raw = document.getElementById('q').value.trim();
  if (!raw) return;
  out.innerHTML = TS.loadingHtml('Adding channel…');
  try {
    const id = await TS.resolveChannelId(TS.parseChannelInput(raw));
    const list = get();
    if (list.some(c => c.id === id)) { render(); TS.toast('Already tracked.'); return; }
    if (list.length >= 25) { render(); TS.toast('Watchlist is full (25 channels).'); return; }
    const ch = await TS.getChannel(id);
    list.push({
      id, title: ch.snippet.title,
      thumb: (ch.snippet.thumbnails.medium || {}).url || '',
      added: Date.now(), snaps: [], lastUpload: null, lastVideo: null
    });
    set(list);
    document.getElementById('q').value = '';
    await refreshOne(list[list.length - 1]);
    set(list); render();
  } catch (err) { out.innerHTML = TS.apiErrorHtml(err); }
});
document.getElementById('refresh').addEventListener('click', async () => {
  const list = get();
  if (!list.length) { TS.toast('Add a channel first.'); return; }
  out.innerHTML = TS.loadingHtml('Refreshing ' + list.length + ' channels…');
  for (const c of list) { try { await refreshOne(c); } catch (e) { /* keep old snapshot */ } }
  set(list); render(); TS.toast('Watchlist refreshed.');
});

async function refreshOne(c) {
  const ch = await TS.getChannel(c.id);
  const st = ch.statistics;
  c.title = ch.snippet.title;
  c.thumb = (ch.snippet.thumbnails.medium || {}).url || c.thumb;
  c.snaps.push({ t: Date.now(), subs: +st.subscriberCount || 0, views: +st.viewCount || 0, videos: +st.videoCount || 0 });
  if (c.snaps.length > 90) c.snaps = c.snaps.slice(-90);
  try {
    const pl = await TS.api('playlistItems', { part: 'snippet,contentDetails', playlistId: ch.contentDetails.relatedPlaylists.uploads, maxResults: 1 });
    const it = pl.items && pl.items[0];
    if (it) {
      const pub = new Date(it.contentDetails.videoPublishedAt || it.snippet.publishedAt).getTime();
      if (!c.lastUpload || pub > c.lastUpload) {
        c.newVideo = true;
        c.lastVideo = { id: it.contentDetails.videoId, title: it.snippet.title };
      }
      c.lastUpload = pub;
    }
  } catch (e) { /* upload check optional */ }
}

function velocity(c) {
  const s = c.snaps;
  if (s.length < 2) return null;
  const a = s[0], b = s[s.length - 1];
  const days = Math.max(0.5, (b.t - a.t) / 864e5);
  return { subsDay: (b.subs - a.subs) / days, viewsDay: (b.views - a.views) / days, days };
}

function spark(snaps, key) {
  if (snaps.length < 2) return '<span class="dim small">—</span>';
  const vals = snaps.map(s => s[key]);
  const min = Math.min(...vals), max = Math.max(...vals), rng = Math.max(1, max - min);
  const pts = vals.map((v, i) => (i / (vals.length - 1) * 96 + 2).toFixed(1) + ',' + (28 - (v - min) / rng * 24).toFixed(1)).join(' ');
  return '<svg class="spark" viewBox="0 0 100 32"><polyline points="' + pts + '" fill="none" stroke="#ff3b30" stroke-width="2"/></svg>';
}

function render() {
  const list = get();
  if (!list.length) {
    out.innerHTML = '<div class="card"><h3>Your watchlist is empty</h3><p class="muted small">Track competitors, niche leaders, or your own channel. Each refresh snapshots subscribers, views and uploads — come back daily to build growth history.</p></div>';
    return;
  }
  const vels = list.map(c => ({ c, v: velocity(c) })).filter(x => x.v && x.v.subsDay > 0);
  const medSubs = vels.length ? vels.map(x => x.v.subsDay).sort((a, b) => a - b)[Math.floor(vels.length / 2)] : 0;
  out.innerHTML = '<div class="tblwrap"><table class="tbl"><tr><th>Channel</th><th class="num">Subs</th><th class="num">Subs/day</th><th class="num">Views/day</th><th>Trend</th><th>Latest upload</th><th></th></tr>' +
    list.map(c => {
      const v = velocity(c);
      const surging = v && medSubs > 0 && v.subsDay > medSubs * 2 && v.days >= 1;
      const fresh = c.lastUpload && (Date.now() - c.lastUpload) < 864e5;
      return '<tr><td><span class="t" style="min-width:180px">' + (c.thumb ? '<img src="' + c.thumb + '" style="width:34px;height:34px;border-radius:50%" alt="">' : '') +
        '<span class="tt"><a href="channel.html?c=' + c.id + '">' + TS.esc(c.title) + '</a><br>' +
        (surging ? '<span class="badge g">surging</span> ' : '') + (c.newVideo ? '<span class="badge a">new video</span>' : '') + '</span></span></td>' +
        '<td class="num">' + TS.fmtNum(last(c).subs) + '</td>' +
        '<td class="num">' + (v ? (v.subsDay >= 0 ? '+' : '') + TS.fmtNum(v.subsDay) : '—') + '</td>' +
        '<td class="num">' + (v ? '+' + TS.fmtNum(v.viewsDay) : '—') + '</td>' +
        '<td>' + spark(c.snaps, 'subs') + '</td>' +
        '<td class="small ' + (fresh ? '' : 'dim') + '">' + (c.lastUpload ? (fresh ? '<b>NEW:</b> ' : '') + TS.timeAgo(c.lastUpload) + (c.lastVideo ? '<br><a href="video.html?v=' + c.lastVideo.id + '" style="text-decoration:underline">' + TS.esc(c.lastVideo.title.slice(0, 42)) + '…</a>' : '') : '—') + '</td>' +
        '<td><button class="btn ghost sm" data-rm="' + c.id + '">Remove</button></td></tr>';
    }).join('') + '</table></div>' +
    '<p class="note">Velocity is measured across your snapshot history (' + list.reduce((n, c) => n + c.snaps.length, 0) + ' snapshots). "Surging" = growing 2× faster than the watchlist median.</p>';
  out.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
    set(get().filter(c => c.id !== b.dataset.rm)); render();
  }));
  // clear "new video" flags after viewing
  const l2 = get(); l2.forEach(c => c.newVideo = false); set(l2);
}
function last(c) { return c.snaps[c.snaps.length - 1] || { subs: 0, views: 0, videos: 0 }; }
render();
