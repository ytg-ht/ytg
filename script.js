document.addEventListener("DOMContentLoaded", () => {

    const generateBtn = document.getElementById("generateBtn");
    const playBtn = document.getElementById("playBtn");
    const downloadBtn = document.getElementById("downloadBtn");
    const captionBox = document.getElementById("captionBox");
    const videoSatisfy = document.getElementById("videoSatisfy");

    const videoList = [
        "media/slime1.mp4",
        "media/slime2.mp4",
        "media/slime3.mp4",
        "media/slime4.mp4",
        "media/soap1.mp4"
    ];

    let selectedFacts = [];
    let currentFactIndex = 0;

    function fadeText(newText) {
        captionBox.style.opacity = 0;
        setTimeout(() => {
            captionBox.textContent = newText;
            captionBox.style.opacity = 1;
        }, 300);
    }

    function generateShort() {
        // pick 7 random facts
        selectedFacts = [];
        for (let i = 0; i < 7; i++) {
            const rand = Math.floor(Math.random() * window.facts.length);
            selectedFacts.push(window.facts[rand]);
        }
        currentFactIndex = 0;

        // random satisfy video
        const vid = videoList[Math.floor(Math.random() * videoList.length)];
        videoSatisfy.src = vid;
        videoSatisfy.load();

        fadeText("Generated! Click Play!");
    }

    function playShort() {
        if (selectedFacts.length === 0) {
            fadeText("Generate First!");
            return;
        }

        videoSatisfy.play();
        showFact();
    }

    function showFact() {
        if (currentFactIndex >= selectedFacts.length) {
            fadeText("End!");
            return;
        }

        fadeText(selectedFacts[currentFactIndex]);
        currentFactIndex++;

        setTimeout(showFact, 1700); // change caption every 1.7s
    }

    generateBtn.addEventListener("click", generateShort);
    playBtn.addEventListener("click", playShort);
    downloadBtn.addEventListener("click", () => fadeText("Download coming next!"));

});
