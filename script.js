// index.js (main controller)
const generateBtn = document.getElementById('generateBtn');
const openPopupBtn = document.getElementById('openPopupBtn');
const recordBtn = document.getElementById('recordBtn');
const statusEl = document.getElementById('status');
const titleInput = document.getElementById('title');

let popupWin = null;
let playlist = []; // array of facts (7)
const factsPerShort = 7;

function logStatus(t){
  statusEl.textContent = 'Status: ' + t;
}

function pickFacts(n){
  const out = [];
  if (!window.facts || !window.facts.length){
    // fallback sample
    for (let i=0;i<n;i++) out.push("Did you know honey never spoils?");
    return out;
  }
  // pick random non-repeating (or repeating if not enough)
  const pool = [...window.facts];
  for (let i=0;i<n;i++){
    if (pool.length === 0) pool.push(...window.facts);
    const idx = Math.floor(Math.random()*pool.length);
    out.push(pool.splice(idx,1)[0]);
  }
  return out;
}

// generate 7 facts
generateBtn.addEventListener('click', () => {
  playlist = pickFacts(factsPerShort);
  logStatus('Generated ' + playlist.length + ' facts.');
  openPopupBtn.disabled = false;
  recordBtn.disabled = true;
});

// open popup and send playlist to it
openPopupBtn.addEventListener('click', () => {
  if (popupWin && !popupWin.closed) popupWin.close();
  // open preview popup at 720x1280
  const w=720, h=1280;
  const left = Math.max(0, (screen.width - w) / 2);
  const top = Math.max(0, (screen.height - h) / 2);
  popupWin = window.open('preview.html', 'ytg_preview', `width=${w},height=${h},left=${left},top=${top}`);
  if (!popupWin) {
    alert('Popup blocked. Allow popups for this site and try again.');
    return;
  }
  logStatus('Popup opened — waiting for it to be ready...');
  // Wait for popup to signal ready via postMessage
  const onMessage = (ev) => {
    if (ev.source !== popupWin) return;
    const d = ev.data || {};
    if (d.type === 'popup-ready') {
      window.removeEventListener('message', onMessage);
      // send playlist and settings
      popupWin.postMessage({
        type: 'load-playlist',
        playlist,
        settings: {
          videoList: [
            "media/slime1.mp4",
            "media/slime2.mp4",
            "media/slime3.mp4",
            "media/slime4.mp4",
            "media/soap1.mp4"
          ],
          bgMusicUrl: "https://ytg-ht.github.io/ytg/sound.mp3",
          captionWords: 6,
          interChunkGap: 700,
          ttsRate: 1.3
        }
      }, '*');
      logStatus('Sent playlist to popup. Popup ready.');
      recordBtn.disabled = false;
    } else if (d.type === 'popup-closed') {
      window.removeEventListener('message', onMessage);
      logStatus('Popup closed.');
      recordBtn.disabled = true;
    }
  };
  window.addEventListener('message', onMessage);
});

// record popup and download
recordBtn.addEventListener('click', async () => {
  if (!popupWin || popupWin.closed) return alert('Open the preview popup first.');
  const filename = (titleInput.value || 'short') + '.webm';
  logStatus('Please choose the PREVIEW window in the share dialog. Recording will start after you allow sharing.');
  try {
    // ask user to share a screen/window/tab. In the picker choose the popup window (the preview).
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    // Some browsers may give you the full screen — that's OK, as long as it includes the popup visually.
    // Prepare MediaRecorder
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' :
                 MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3000000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };

    rec.onstop = () => {
      // stop tracks
      stream.getTracks().forEach(t=>t.stop());
      const blob = new Blob(chunks, { type: chunks[0]?.type || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 30000);
      logStatus('Download ready: ' + filename);
    };

    // start recorder
    rec.start(1000);
    logStatus('Recording... now telling popup to start playback. Do not close the popup.');

    // Instruct popup to start playing the playlist
    popupWin.postMessage({ type: 'start-playback' }, '*');

    // Wait for popup to notify 'playback-done'
    const onMsg = (ev) => {
      if (ev.source !== popupWin) return;
      const d = ev.data || {};
      if (d.type === 'playback-done') {
        // stop recorder shortly after
        setTimeout(()=> {
          if (rec.state !== 'inactive') rec.stop();
        }, 600); // small buffer to finish audio
        window.removeEventListener('message', onMsg);
      }
    };
    window.addEventListener('message', onMsg);

  } catch (err) {
    console.error(err);
    logStatus('Recording canceled or failed: ' + (err.message || err));
  }
});
