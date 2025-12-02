// index.js (controller)
document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const openPopupBtn = document.getElementById('openPopupBtn');
  const recordBtn = document.getElementById('recordBtn');
  const status = document.getElementById('status');
  const voiceSelect = document.getElementById('voiceSelect');

  let popupWin = null;
  let playlist = [];

  const FACTS_PER_SHORT = 7;

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

  generateBtn.addEventListener('click', () => {
    playlist = pickFacts(FACTS_PER_SHORT);
    log('Generated ' + playlist.length + ' facts.');
    openPopupBtn.disabled = false;
    recordBtn.disabled = true;
  });

  openPopupBtn.addEventListener('click', () => {
    if (popupWin && !popupWin.closed) popupWin.close();
    // popup at 720x1280 for recording selection clarity
    const w = 720, h = 1280;
    const left = Math.max(0, (screen.width - w)/2);
    const top = Math.max(0, (screen.height - h)/2);
    popupWin = window.open('preview.html', 'ytg_preview', `width=${w},height=${h},left=${left},top=${top}`);
    if (!popupWin) { alert('Popup blocked. Allow popups for this site.'); return; }
    log('Popup opened, waiting for ready message...');
    const onMessage = (ev) => {
      if (ev.source !== popupWin) return;
      const d = ev.data || {};
      if (d.type === 'popup-ready') {
        window.removeEventListener('message', onMessage);
        // choose voice preference
        const force = voiceSelect.value; // 'auto'|'male'|'female'
        popupWin.postMessage({ type:'load-playlist', playlist, settings:{
          bgMusicUrl: 'https://ytg-ht.github.io/ytg/sound.mp3',
          captionWords: 6, interFactGap: 700, ttsRate: 1.3, voiceForce: force,
          videoList: ["media/slime1.mp4","media/slime2.mp4","media/slime3.mp4","media/slime4.mp4","media/soap1.mp4"]
        } }, '*');
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
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' :
                   MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3000000 });
      const parts = [];
      recorder.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t=>t.stop());
        const blob = new Blob(parts, { type: parts[0]?.type || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'short.webm';
        a.click();
        setTimeout(()=>URL.revokeObjectURL(url),30000);
        log('Download ready — short.webm');
      };
      recorder.start(1000);
      log('Recording... telling popup to start playback.');
      // notify popup to start
      popupWin.postMessage({ type: 'start-playback' }, '*');

      // wait for playback-done
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
      log('Recording canceled or failed: ' + (err.message||err));
    }
  });

});
