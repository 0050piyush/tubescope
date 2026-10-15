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
