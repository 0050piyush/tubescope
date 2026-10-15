/* settings */
'use strict';
TS.initNav('settings');
const keyInput = document.getElementById('key'), status = document.getElementById('keyStatus');
keyInput.value = TS.getKey();

function paint() {
  const q = TS.quota();
  document.getElementById('qUse').textContent = q.units.toLocaleString() + ' (' + q.calls + ' calls)';
  status.innerHTML = TS.hasKey()
    ? '<span class="badge g">Key saved</span> <span class="dim">stored only in this browser</span>'
    : '<span class="badge a">No key saved yet</span> <span class="dim">follow the steps below</span>';
}
document.getElementById('save').addEventListener('click', () => {
  TS.setKey(keyInput.value);
  paint();
  TS.toast(TS.hasKey() ? 'API key saved.' : 'Key cleared.');
});
document.getElementById('clear').addEventListener('click', () => { TS.setKey(''); keyInput.value = ''; paint(); });
document.getElementById('toggle').addEventListener('click', e => {
  const show = keyInput.type === 'password';
  keyInput.type = show ? 'text' : 'password';
  e.target.textContent = show ? 'Hide' : 'Show';
});
document.getElementById('test').addEventListener('click', async () => {
  TS.setKey(keyInput.value); paint();
  status.innerHTML = '<span class="dim">Testing…</span>';
  try {
    const d = await TS.api('videos', { part: 'snippet', id: 'dQw4w9WgXcQ', maxResults: 1 });
    status.innerHTML = '<span class="badge g">Key works</span> <span class="dim">test call returned: ' + TS.esc(d.items[0].snippet.title.slice(0, 60)) + '…</span>';
  } catch (e) {
    status.innerHTML = TS.apiErrorHtml(e);
  }
});
paint();

/* custom LLM for Daily Ideas */
const llmEp = document.getElementById('llm_ep'), llmKey = document.getElementById('llm_key'), llmModel = document.getElementById('llm_model');
llmEp.value = localStorage.getItem('tubescope_llm_ep') || '';
llmKey.value = localStorage.getItem('tubescope_llm_key') || '';
llmModel.value = localStorage.getItem('tubescope_llm_model') || '';
function paintLlm() {
  const on = (localStorage.getItem('tubescope_llm_ep') || '').trim() && (localStorage.getItem('tubescope_llm_key') || '').trim();
  document.getElementById('llmStatus').innerHTML = on
    ? '<span class="badge g">Custom AI active</span>'
    : '<span class="badge n">Using free built-in AI</span>';
}
document.getElementById('llm_save').addEventListener('click', () => {
  localStorage.setItem('tubescope_llm_ep', llmEp.value.trim());
  localStorage.setItem('tubescope_llm_key', llmKey.value.trim());
  localStorage.setItem('tubescope_llm_model', llmModel.value.trim());
  paintLlm(); TS.toast('AI settings saved.');
});
paintLlm();

/* quota dashboard */
function msToMidnightPT() {
  const pt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return 24 * 3600e3 - (pt.getHours() * 3600e3 + pt.getMinutes() * 60e3 + pt.getSeconds() * 1e3 + pt.getMilliseconds());
}
function paintQuotaDash() {
  const q = TS.quota();
  const pct = Math.min(100, q.units / 10000 * 100);
  document.getElementById('qFill').style.width = pct + '%';
  document.getElementById('qUnits').textContent = q.units.toLocaleString();
  document.getElementById('qCalls').textContent = q.calls + ' API calls today from this browser.';
  const ms = msToMidnightPT(), h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3);
  document.getElementById('qReset').textContent = 'Resets in ' + h + 'h ' + m + 'm (midnight PT)';
}
document.getElementById('qResetBtn').addEventListener('click', () => { TS.resetQuota(); paintQuotaDash(); paint(); TS.toast('Quota counter reset.'); });
paintQuotaDash();
setInterval(paintQuotaDash, 60000);
