console.log("script.js loaded correctly");

document.addEventListener("DOMContentLoaded", () => {

  const factText = document.getElementById("fact-text");
  const video = document.getElementById("slimeVideo");
  const voiceSelect = document.getElementById("voiceSelect");
  const nextBtn = document.getElementById("nextBtn");

  if (!factText || !video || !voiceSelect || !nextBtn) {
    console.error("One or more elements missing in index.html");
    return;
  }

  if (typeof facts === "undefined") {
    factText.textContent = "Error: facts.js did not load 😬";
    return;
  }

  const videos = [
    "media/slime1.mp4",
    "media/slime2.mp4",
    "media/slime3.mp4",
    "media/slime4.mp4",
    "media/soap1.mp4"
  ];

  let factIndex = 0;

  function playRandomVideo() {
    const url = videos[Math.floor(Math.random() * videos.length)];
    video.src = url;
    video.play();
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

  // Wait for voices to load to start
  speechSynthesis.onvoiceschanged = () => {
    showNextFact();
  };

});
