console.log("YT Short Generator - Playable version loaded");

const video = document.getElementById("video");
const generateBtn = document.getElementById("generateBtn");
const playBtn = document.getElementById("playBtn");
const factDisplay = document.getElementById("fact-display");
const voiceChoice = document.getElementById("voiceChoice");

if (!facts || facts.length === 0) {
    alert("⚠ facts.js missing or empty!");
}

const satisfyingVideos = [
    "media/vid1.mp4",
    "media/vid2.mp4",
    "media/vid3.mp4"
];

let selectedFact = "";

function getRandomFact() {
    return facts[Math.floor(Math.random() * facts.length)];
}

function getRandomVideo() {
    return satisfyingVideos[Math.floor(Math.random() * satisfyingVideos.length)];
}

async function generateAudio(text) {
    return new Promise(resolve => {
        const utter = new SpeechSynthesisUtterance(text);
        utter.voice = speechSynthesis.getVoices().find(v => v.name.includes(voiceChoice.value));
        utter.rate = 1.05;
        utter.onend = resolve;
        speechSynthesis.speak(utter);
    });
}

generateBtn.addEventListener("click", () => {
    selectedFact = getRandomFact();
    factDisplay.textContent = selectedFact;

    const videoSrc = getRandomVideo();
    video.src = videoSrc;

    // Random start point
    video.currentTime = Math.random() * 5;

    playBtn.disabled = false;
});

playBtn.addEventListener("click", async () => {
    playBtn.disabled = true;

    video.muted = false;
    video.play();

    await generateAudio(selectedFact + " . . . ");

    video.pause();
});
