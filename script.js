// script.js - main controller for full controls
document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const openPopupBtn = document.getElementById('openPopupBtn');
  const previewTTSBtn = document.getElementById('previewTTSBtn');
  const openRendererBtn = document.getElementById('openRendererBtn');
  const statusEl = document.getElementById('status');
  const voiceSelect = document.getElementById('voiceSelect');
  const musicVol = document.getElementById('musicVol');
  const crossMs = document.getElementById('crossMs');

  const miniVideo = document.getElementById('miniVideo');
  const miniCaption = document.getElementById('miniCaption');

  let playlist = [];
  const FACTS = 7;
  let popupWin = null;

  function log(s) { statusEl.textContent = 'Status: ' + s; }

  function pickFacts(n) {
    const out = [];
    const pool = Array.isArray(window.facts) ? [...window.facts] : [];
    if (!pool.length) {
      for (let i = 0; i < n; i++) out.push("Did you know honey never spoils?");
      return out;
    }
    for (let i = 0; i < n; i++) {
      if (!pool.length) pool.push(...window.facts);
      const idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }

  function setMini(videoSrc, text) {
    miniVideo.src = videoSrc;
    miniVideo.load();
    miniCaption.textContent = text;
  }

  generateBtn.addEventListener('click', () => {
    generateBtn.textContent = 'Generating...';
    generateBtn.disabled = true;
    setTimeout(() => {
      playlist = pickFacts(FACTS);
      log('Generated ' + playlist.length + ' facts');
      // pick random video for mini preview
      const vids = ["media/slime1.mp4","media/slime2.mp4","media/slime3.mp4","media/slime4.mp4","media/soap1.mp4"];
      const v = vids[Math.floor(Math.random()*vids.length)];
      setMini(v, playlist[0]);
      openPopupBtn.disabled = false;
      previewTTSBtn.disabled = false;
      openRendererBtn.disabled = false;
      generateBtn.textContent = 'Generate 7 facts';
      generateBtn.disabled = false;
    }, 250);
  });

  openPopupBtn.addEventListener('click', () => {
    if (!playlist || playlist.length === 0) return alert('Generate first');
    if (popupWin && !popupWin.closed) popupWin.close();
    // open preview popup at 1080x1920 (so share picker shows it)
    const w = 1080, h = 1920;
    const left = Math.max(0, (screen.width - w)/2);
    const top = Math.max(0, (screen.height - h)/2);
    popupWin = window.open('preview.html','ytg_preview',`width=${w},height=${h},left=${left},top=${top}`);
    if (!popupWin) { alert('Popup blocked — allow popups'); return; }
    log('Popup opened, waiting for ready...');
    const onMsg = (ev) => {
      if (ev.source !== popupWin) return;
      const d = ev.data || {};
      if (d.type === 'popup-ready') {
        window.removeEventListener('message', onMsg);
        // send settings and playlist
        popupWin.postMessage({
          type:'load-playlist',
          playlist,
          settings: {
            ttsRate: 0.85,
            voiceForce: voiceSelect.value,
            musicVolume: Number(musicVol.value)/100,
            crossfadeMs: Number(crossMs.value),
            captionWords: 10,
            interFactGap: 700,
            videoList: ["media/slime1.mp4","media/slime2.mp4","media/slime3.mp4","media/slime4.mp4","media/soap1.mp4"]
          }
        }, '*');
        log('Playlist posted to popup. Ready.');
      } else if (d.type === 'popup-closed') {
        window.removeEventListener('message', onMsg);
        log('Popup closed.');
      }
    };
    window.addEventListener('message', onMsg);
  });

  previewTTSBtn.addEventListener('click', () => {
    if (!playlist || playlist.length === 0) return alert('Generate first');
    // quick TTS preview in this tab
    const text = playlist.join('\n\n');
    // choose voice
    const voices = speechSynthesis.getVoices() || [];
    const forced = voiceSelect.value;
    let v = null;
    if (forced === 'male') v = voices.find(x=>/Google UK.*Male/i.test(x.name));
    if (forced === 'female') v = voices.find(x=>/Google UK.*Female/i.test(x.name));
    if (!v) v = voices.find(x=>/Google UK.*Male/i.test(x.name)) || voices.find(x=>/Google UK.*Female/i.test(x.name)) || voices[0];
    const utt = new SpeechSynthesisUtterance(text);
    if (v) utt.voice = v;
    utt.rate = 0.85;
    utt.onstart = () => log('TTS preview playing (this tab)');
    utt.onend = () => log('TTS preview ended');
    speechSynthesis.cancel();
    speechSynthesis.speak(utt);
  });

  openRendererBtn.addEventListener('click', () => {
    window.open('render.html', '_blank');
  });

  // preload voices
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.onvoiceschanged = ()=> {};
  }
});
