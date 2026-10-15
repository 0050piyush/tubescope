/* home */
'use strict';
TS.initNav('');
document.getElementById('uniForm').addEventListener('submit', e => {
  e.preventDefault();
  const raw = document.getElementById('uniInput').value.trim();
  if (!raw) return;
  if (TS.parseVideoId(raw)) { location.href = 'video.html?v=' + encodeURIComponent(raw); return; }
  if (TS.parseChannelInput(raw)) { location.href = 'channel.html?c=' + encodeURIComponent(raw); return; }
  TS.toast('Could not recognize that as a video or channel URL.');
});
if (!TS.hasKey()) {
  document.getElementById('keyNudge').innerHTML =
    '<div class="gate"><div class="tx"><h3>One quick setup, then everything is free</h3>' +
    '<p>Add your free YouTube API key to unlock all tools. It never leaves your browser.</p></div>' +
    '<a class="btn" href="settings.html">Set up in 2 min</a></div>';
}
