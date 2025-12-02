// index.js (controller)
document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const openPopupBtn = document.getElementById('openPopupBtn');
  const recordBtn = document.getElementById('recordBtn');
  const status = document.getElementById('status');
  const voiceSelect = document.getElementById('voiceSelect');
  const musicUrlInput = document.getElementById('musicUrl');

  let popupWin = null;
  let playlist = [];
  const FACTS = 7;

  function log(s){ status.textContent = 'Status: ' + s; }

  function pickFacts(n){
    const out = [];
    const pool = Array.isArray(window.facts) ? [...window.facts] : [];
    if (pool.length === 0) {
      for (let i=0;i<n;i++) out.push("Did you know honey never spoils?");
      return out;
    }
    for (let i=0;i<n;i++){
      if (pool.length === 0) pool.push(...window.facts);
      const idx = Math.floor(Math.random()*pool.length);
      out.push(pool.splice(idx,1)[0]);
    }
    return out;
  }

  // B behavior: show Generating... while building
  generateBtn.addEventListener('click', () => {
    generateBtn.textContent = 'Generating...';
    generateBtn.disabled = true;
    setTimeout(()=>{ // small UX delay so user feels it changed
      playlist = pickFacts(FACTS);
      log('Generated ' + playlist.length + ' facts.');
      openPopupBtn.disabled = false;
      recordBtn.disabled = true;
      generateBtn.textContent = 'Generate 7 Facts';
      generateBtn.disabled = false;
    }, 250);
  });

  openPopupBtn.addEventListener('click', () => {
    if (popupWin && !popupWin.closed) popupWin.close();

    const w = 1080, h = 1920; // popup real size so it is recognized in share picker
    const left = Math.max(0, (screen.width - w)/2);
    const top = Math.max(0, (screen.height - h)/2);
    popupWin = window.open('preview.html', 'ytg_preview', `width=${w},height=${h},left=${left},top=${top}`);
    if (!popupWin) { alert('Popup blocked. Allow popups for this site.'); return; }

    log('Popup opened — waiting for ready...');
    const onMessage = (ev) => {
      if (ev.source !== popupWin) return;
      const d = ev.data || {};
      if (d.type === 'popup-ready') {
        window.removeEventListener('message', onMessage);
        popupWin.postMessage({
          type: 'load-playlist',
          playlist,
          settings: {
            bgMusicUrl: musicUrlInput.value || 'https://ytg-ht.github.io/ytg/sound.mp3',
            captionWords: 10,         // normal readability (B)
            interFactGap: 700,
            ttsRate: 0.85,
            voiceForce: voiceSelect.value,
            crossfadeMs: 500,
            videoList: ["media/slime1.mp4","media/slime2.mp4","media/slime3.mp4","media/slime4.mp4","media/soap1.mp4"]
          }
        }, '*');
        log('Playlist sent to popup. Ready to record.');
        recordBtn.disabled = false;
      } else if (d.type === 'popup-closed') {
        window.removeEventListener('message', onMessage);
        log('Popup closed.');
        recordBtn.disabled = true;
      }
    };
    window.addEventListener('message', onMessage);
  });

  recordBtn.addEventListener('click', async () => {
    if (!popupWin || popupWin.closed) return alert('Open the preview popup first.');
    log('Choose the PREVIEW window in the share dialog. Recording starts after you allow.');

    try {
      // capture the popup window (user MUST select the popup window in the dialog)
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });

      // MediaRecorder
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' :
                   MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3500000 });
      const parts = [];
      recorder.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t=>t.stop());
        const blob = new Blob(parts, { type: parts[0]?.type || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'short.webm';
        a.click();
        setTimeout(()=>URL.revokeObjectURL(url), 30000);
        log('Download ready — short.webm');
      };

      recorder.start(1000);
      log('Recording started. Telling popup to play...');
      popupWin.postMessage({ type: 'start-playback' }, '*');

      const onMsg = (ev) => {
        if (ev.source !== popupWin) return;
        const d = ev.data || {};
        if (d.type === 'playback-done') {
          setTimeout(()=> { if (recorder.state !== 'inactive') recorder.stop(); }, 600);
          window.removeEventListener('message', onMsg);
        }
      };
      window.addEventListener('message', onMsg);

    } catch (err) {
      console.error(err);
      log('Recording canceled or failed: ' + (err.message || err));
    }
  });

});
