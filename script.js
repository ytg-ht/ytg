const btn = document.getElementById("generate");
const video = document.getElementById("shortVideo");
const captions = document.getElementById("captionText");
const bgMusic = document.getElementById("bgMusic");
const downloadBtn = document.getElementById("downloadBtn");

let index = 0;
let capturing = false;
let chunks = [];
let recorder;

bgMusic.src = "audio/bg.mp3";

btn.addEventListener("click", startShort);

async function startShort() {
    btn.style.display = "none";
    downloadBtn.style.display = "none";

    const fact = window.facts[Math.floor(Math.random() * window.facts.length)];
    
    const phrases = splitFact(fact);
    let phraseIndex = 0;

    startRecording();

    function playNextVideo() {
        const nextVid = `videos/vid${(index % 3) + 1}.mp4`;
        index++;

        video.style.opacity = 0;
        setTimeout(() => {
            video.src = nextVid;
            video.play();
            video.style.opacity = 1;
        }, 300);
    }

    playNextVideo();
    bgMusic.play();

    const interval = setInterval(() => {
        captions.textContent = phrases[phraseIndex];
        phraseIndex++;

        if (phraseIndex % 2 === 0) playNextVideo(); // swap every 10s (2 captions)

        if (phraseIndex >= phrases.length) {
            clearInterval(interval);
            setTimeout(stopRecording, 3000);
        }
    }, 5000); // 5s per caption
}

function splitFact(fact) {
    const words = fact.split(" ");
    let result = [];

    for (let i = 0; i < words.length; i += 5) {
        result.push(words.slice(i, i + 5).join(" "));
    }

    return result;
}

function startRecording() {
    const stream = document.getElementById("short-container").captureStream(30);
    recorder = new MediaRecorder(stream);
    chunks = [];

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = downloadVideo;

    recorder.start();
    capturing = true;
}

function stopRecording() {
    if (capturing) {
        capturing = false;
        recorder.stop();
        bgMusic.pause();
    }
}

function downloadVideo() {
    const blob = new Blob(chunks, { type: "video/mp4" });
    const url = URL.createObjectURL(blob);

    downloadBtn.style.display = "block";
    downloadBtn.onclick = () => {
        const a = document.createElement("a");
        a.href = url;
        a.download = "short.mp4";
        a.click();
    };
}
