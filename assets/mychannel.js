/* my channel: private analytics via Google OAuth (read-only) */
'use strict';
TS.initNav('mychannel');
const setupEl = document.getElementById('setup'), out = document.getElementById('out');
const LS_CID = 'tubescope_oauth_client';
let token = null, tokenExp = 0, tokenClient = null;

const SCOPES = 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly';

function renderSetup() {
  const cid = localStorage.getItem(LS_CID) || '';
  if (!token) {
    setupEl.innerHTML =
      '<div class="card"><h3>Connect your YouTube channel</h3>' +
      '<p class="small muted">One-time setup in Google Cloud Console (same project as your API key):</p>' +
      '<div class="steps">' +
      '<div class="step"><p><b>Enable APIs:</b> YouTube Data API v3 <i>and</i> <b>YouTube Analytics API</b> in the API Library.</p></div>' +
      '<div class="step"><p><b>OAuth consent screen:</b> APIs &amp; Services → OAuth consent screen → External → fill app name/email → add scopes <code class="inline">youtube.readonly</code> and <code class="inline">yt-analytics.readonly</code> → add your Google account as a <b>test user</b>.</p></div>' +
      '<div class="step"><p><b>Create OAuth client ID:</b> Credentials → Create Credentials → OAuth client ID → <b>Web application</b> → Authorized JavaScript origins: add <code class="inline">https://0050piyush.github.io</code></p></div>' +
      '</div>' +
      '<div class="field"><label>OAuth client ID</label><div class="inrow"><input class="in" id="cid" placeholder="…apps.googleusercontent.com" style="flex:1;min-width:240px" value="' + TS.esc(cid) + '" autocomplete="off" spellcheck="false"><button class="btn sm" id="savecid">Save</button></div></div>' +
      '<button class="btn" id="connect" ' + (cid ? '' : 'disabled') + '>Connect with Google</button> ' +
      '<span class="small dim">read-only access · token stays in this tab</span></div>';
    document.getElementById('savecid').addEventListener('click', () => {
      localStorage.setItem(LS_CID, document.getElementById('cid').value.trim());
      renderSetup(); TS.toast('Client ID saved.');
    });
    document.getElementById('connect').addEventListener('click', connect);
  } else {
    setupEl.innerHTML = '<div class="inrow"><span class="badge g">Connected</span><button class="btn ghost sm" id="disc">Disconnect</button></div>';
    document.getElementById('disc').addEventListener('click', () => {
      if (token) { try { google.accounts.oauth2.revoke(token); } catch (e) {} }
      token = null; setupEl.innerHTML = ''; out.innerHTML = ''; renderSetup();
    });
  }
}

function connect() {
  const cid = localStorage.getItem(LS_CID) || '';
  if (!cid) { TS.toast('Save your OAuth client ID first.'); return; }
  if (typeof google === 'undefined' || !google.accounts) { TS.toast('Google sign-in script still loading — try again in a few seconds.'); return; }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: cid, scope: SCOPES,
    callback: resp => {
      if (resp.error) { out.innerHTML = '<div class="err"><b>Sign-in failed.</b> ' + TS.esc(resp.error) + ' — check the client ID, test-user setup and authorized origin.</div>'; return; }
      token = resp.access_token;
      tokenExp = Date.now() + (+resp.expires_in || 3600) * 1000;
      renderSetup(); load();
    }
  });
  tokenClient.requestAccessToken({ prompt: '' });
}

async function gapi(path, params) {
  if (!token || Date.now() > tokenExp - 60000) throw { auth: true };
  const url = path + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw { status: r.status, message: (j.error && j.error.message) || 'API error' };
  return j;
}
const yta = p => gapi('https://youtubeanalytics.googleapis.com/v2/reports', p);

function isoDaysAgo(n) { return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }

async function load() {
  out.innerHTML = TS.loadingHtml('Loading your private analytics…');
  try {
    const me = await gapi('https://www.googleapis.com/youtube/v3/channels', { part: 'snippet,statistics', mine: 'true' });
    const ch = me.items[0];
    const start = isoDaysAgo(28), end = isoDaysAgo(0);
    const daily = await yta({ ids: 'channel==MINE', startDate: start, endDate: end, metrics: 'views,watchTimeMinutes,subscribersGained', dimensions: 'day', sort: 'day' });
    const traffic = await yta({ ids: 'channel==MINE', startDate: start, endDate: end, metrics: 'views', dimensions: 'insightTrafficSourceType', sort: '-views', maxResults: 10 });
    const topv = await yta({ ids: 'channel==MINE', startDate: start, endDate: end, metrics: 'views,watchTimeMinutes', dimensions: 'video', sort: '-views', maxResults: 10 });

    const rows = daily.rows || [];
    const tViews = rows.reduce((a, r) => a + r[1], 0);
    const tWatchHrs = rows.reduce((a, r) => a + r[2], 0) / 60;
    const tSubs = rows.reduce((a, r) => a + r[3], 0);
    const avd = tViews ? (rows.reduce((a, r) => a + r[2], 0) * 60 / tViews) : 0;

    let html = '<div class="vid-head"><div class="meta"><h1>' + TS.esc(ch.snippet.title) + ' <span class="badge g">your channel</span></h1>' +
      '<div class="pub">Last 28 days · private analytics via YouTube Analytics API</div></div></div>';
    html += '<div class="stats">' +
      stat('Views (28d)', TS.fmtNum(tViews), '') +
      stat('Watch time', TS.fmtNum(Math.round(tWatchHrs)) + ' hrs', '') +
      stat('Subscribers', (tSubs >= 0 ? '+' : '') + TS.fmtNum(tSubs), 'net gained') +
      stat('Avg view duration', fmtSec(avd), '') +
      '</div>';
    html += '<div class="panels"><div class="card"><h3>Daily views</h3>' +
      TS.barsHtml(rows.slice(-14).map(r => [r[0].slice(5), r[1], TS.fmtNum(r[1])])) + '</div>' +
      '<div class="card"><h3>Traffic sources</h3>' +
      TS.barsHtml((traffic.rows || []).map(r => [prettySource(r[0]), r[1], Math.round(r[1] / Math.max(1, tViews) * 100) + '%'])) +
      '<p class="note">Where your views came from in the last 28 days.</p></div></div>';

    const vids = (topv.rows || []).map(r => r[0]);
    let titles = {};
    if (vids.length) {
      const d = await gapi('https://www.googleapis.com/youtube/v3/videos', { part: 'snippet', id: vids.join(',') });
      (d.items || []).forEach(v => titles[v.id] = v.snippet.title);
    }
    html += '<h3 class="mt">Top videos (28 days)</h3><div class="tblwrap"><table class="tbl"><tr><th>Video</th><th class="num">Views</th><th class="num">Watch hrs</th></tr>' +
      (topv.rows || []).map(r => '<tr><td><a class="t" href="video.html?v=' + r[0] + '"><img src="https://i.ytimg.com/vi/' + r[0] + '/mqdefault.jpg" loading="lazy" alt=""><span class="tt">' + TS.esc(titles[r[0]] || r[0]) + '</span></a></td>' +
        '<td class="num">' + TS.fmtNum(r[1]) + '</td><td class="num">' + TS.fmtNum(Math.round(r[2] / 60)) + '</td></tr>').join('') +
      '</table></div><p class="note">vidIQ shows this same private data in its dashboard — now you have it free. Quota: Analytics API has its own generous quota, separate from Data API.</p>';
    out.innerHTML = html;
  } catch (e) {
    out.innerHTML = e.auth
      ? '<div class="err"><b>Session expired.</b> Please connect again.</div>'
      : '<div class="err"><b>Could not load analytics.</b> ' + TS.esc(e.message || '') + '<br><span class="small">Common causes: YouTube Analytics API not enabled, consent-screen scopes missing, or your Google account isn\u2019t added as a test user.</span></div>';
  }
}
function stat(k, v, d) { return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (d ? '<div class="d">' + d + '</div>' : '') + '</div>'; }
function fmtSec(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function prettySource(s) {
  return { SEARCH: 'YouTube search', SUGGESTED: 'Suggested videos', BROWSE: 'Browse / home', CHANNEL: 'Channel pages', PLAYLIST: 'Playlists', EXT_URL: 'External', SUBSCRIBER: 'Subscribers feed', NOTIFICATION: 'Notifications', HASHTAGS: 'Hashtags', SHORTS: 'Shorts feed', LIVE: 'Live' }[s] || s;
}
renderSetup();
