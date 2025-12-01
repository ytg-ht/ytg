console.log("script.js loaded correctly");

window.addEventListener("load", () => {

  const factText = document.getElementById("fact-text");
  const video = document.getElementById("slimeVideo");
  const voiceSelect = document.getElementById("voiceSelect");
  const nextBtn = document.getElementById("nextBtn");

  if (!factText || !video || !voiceSelect || !nextBtn) {
    console.error("HTML elements missing");
    return;
  }

  if (typeof facts === "undefined") {
    factText.textContent = "facts.js did not load";
    return;
  }

  const videos = [
    "media/slime1.mp4",
    "media/slime2.mp4",
    "media/slime3.mp4",
    "media/slime4.mp4",
    "media/soap1.mp4"
  ];

  function loadVoices() {
    const voices = speechSynthesis.getVoices();
    voiceSelect.innerHTML = "";

    voices.forEach(voice => {
      if (voice.lang.includes("en")) {
        const option = document.createElement("option");
        option.value = voice.name;
        option.textContent = voice.name;
        voiceSelect.appendChild(option);
      }
    });
  }

  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();

  let factIndex = 0;

  function playRandomVideo() {
    const url = videos[Math.floor(Math.random() * videos.length)];
    video.src = url;
    video.play().catch(err => console.warn(err));
  }

  function speak(text) {
    const msg = new SpeechSynthesisUtterance(text);
    msg.voice = speechSynthesis.getVoices().find(v => v.name === voiceSelect.value);
    speechSynthesis.cancel();
    speechSynthesis.speak(msg);
  }

  function showNextFact() {
    const fact = facts[factIndex % facts.length];
    factIndex++;
    factText.textContent = fact;
    speak(fact);
    playRandomVideo();
  }

  nextBtn.addEventListener("click", showNextFact);

  setTimeout(showNextFact, 300);
});
