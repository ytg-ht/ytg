console.log("script.js loaded correctly");

const factText = document.getElementById("factText");
const bgVideo = document.getElementById("bgVideo");
const nextBtn = document.getElementById("nextBtn");
const voiceSelect = document.getElementById("voiceSelect");

// Make sure facts.js loaded
if (!window.facts || !Array.isArray(facts)) {
  factText.textContent = "ERROR LOADING FACTS";
  throw new Error("Facts array missing");
}

// your real video list
const videos = [
  "media/slime1.mp4",
  "media/slime2.mp4",
  "media/slime3.mp4",
  "media/slime4.mp4",
  "media/soap1.mp4"
];

let factIndex = 0;

// Load voices into dropdown
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

  if (voices.length > 0 && factIndex === 0) {
    showNextFact();
  }
}

// Speak text
function speak(text) {
  const msg = new SpeechSynthesisUtterance(text);
  const selectedVoice = speechSynthesis.getVoices().find(v => v.name === voiceSelect.value);
  if (selectedVoice) msg.voice = selectedVoice;

  speechSynthesis.cancel();
  speechSynthesis.speak(msg);
}

// Play random video
function playRandomVideo() {
  const file = videos[Math.floor(Math.random() * videos.length)];
  bgVideo.src = file;
  bgVideo.play();
}

// Show next fact
function showNextFact() {
  const fact = facts[factIndex % facts.length];
  factIndex++;

  factText.textContent = fact;
  speak(fact);
  playRandomVideo();
}

nextBtn.addEventListener("click", showNextFact);
speechSynthesis.onvoiceschanged = loadVoices;
window.onload = loadVoices;
