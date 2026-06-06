import { DB, auth } from "./firebase.js";

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');

if (!roomId) {
  alert("Oda bulunamadı!");
  window.location.href = "./isim-sehir-lobby.html";
}

const letterDisplay = document.getElementById("target-letter");
const timerDisplay = document.getElementById("timer-display");
const btnFinish = document.getElementById("btn-finish");
const body = document.getElementById("game-body");

const inputs = {
  isim: document.getElementById("inp-isim"),
  sehir: document.getElementById("inp-sehir"),
  hayvan: document.getElementById("inp-hayvan"),
  bitki: document.getElementById("inp-bitki"),
  esya: document.getElementById("inp-esya")
};

let myUid = null;
let myPlayerNum = 0;
let isGameOver = false;
let localTimer = null;
let secondsLeft = 60;
let targetLetterStr = "";

// Kullanıcı harf yazarken küçük bir validasyon (hedefi başa zorla) ekleyebiliriz ama şimdilik serbest bırakıyoruz.

setTimeout(() => {
    myUid = auth.currentUser ? auth.currentUser.uid : "guest_" + Math.random().toString(36).substring(2,8);

    DB.listenToIsimSehirRoom(roomId, (roomData) => {
        if (!roomData) return;
        
        targetLetterStr = roomData.targetLetter;
        letterDisplay.textContent = targetLetterStr;

        if (roomData.player1 && roomData.player1.uid === myUid) myPlayerNum = 1;
        if (roomData.player2 && roomData.player2.uid === myUid) myPlayerNum = 2;

        if (roomData.status === "finishing" && !isGameOver) {
            body.classList.add("panic-mode");
            clearInterval(localTimer);
            
            const remainingMs = roomData.endTime - Date.now();
            let remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
            
            timerDisplay.textContent = remainingSec;
            timerDisplay.style.color = "red";
            btnFinish.disabled = true;
            btnFinish.textContent = "RAKİP BİTİRDİ! SON SİYELER!";
            
            localTimer = setInterval(() => {
               remainingSec--;
               if(remainingSec <= 0) {
                  clearInterval(localTimer);
                  finishGame();
               } else {
                  timerDisplay.textContent = remainingSec;
               }
            }, 1000);
        }

        // Eğer ikisi de submit ettiyse
        if (roomData.player1.answers && roomData.player2 && roomData.player2.answers) {
            showGameOver(roomData);
        }
    });

    localTimer = setInterval(() => {
       if (body.classList.contains("panic-mode")) return; 
       secondsLeft--;
       timerDisplay.textContent = secondsLeft;
       if (secondsLeft <= 0) {
          clearInterval(localTimer);
          finishGame();
       }
    }, 1000);

}, 1500);

btnFinish.addEventListener("click", () => {
    if(isGameOver) return;
    DB.triggerIsimSehirFinish(roomId);
    btnFinish.disabled = true;
    btnFinish.textContent = "BEKLENİYOR...";
    body.classList.add("panic-mode");
});

function finishGame() {
    if (isGameOver) return;
    isGameOver = true;
    clearInterval(localTimer);
    body.classList.remove("panic-mode");
    
    Object.values(inputs).forEach(inp => inp.disabled = true);
    btnFinish.disabled = true;
    btnFinish.textContent = "SÜRE DOLDU!";
    
    const myAnswers = {
        isim: inputs.isim.value.trim().toUpperCase(),
        sehir: inputs.sehir.value.trim().toUpperCase(),
        hayvan: inputs.hayvan.value.trim().toUpperCase(),
        bitki: inputs.bitki.value.trim().toUpperCase(),
        esya: inputs.esya.value.trim().toUpperCase()
    };
    
    DB.submitIsimSehirAnswers(roomId, myPlayerNum, myAnswers);
}

function showGameOver(roomData) {
    document.getElementById("game-over-overlay").style.display = "flex";
    
    const myAnswersList = document.getElementById("my-answers-list");
    const enemyAnswersList = document.getElementById("enemy-answers-list");
    
    const p1Ans = roomData.player1.answers || {};
    const p2Ans = roomData.player2 ? (roomData.player2.answers || {}) : {};
    
    const myAns = myPlayerNum === 1 ? p1Ans : p2Ans;
    const enemyAns = myPlayerNum === 1 ? p2Ans : p1Ans;

    const categories = ["isim", "sehir", "hayvan", "bitki", "esya"];
    
    myAnswersList.innerHTML = "";
    enemyAnswersList.innerHTML = "";
    
    categories.forEach(cat => {
       // Kendi cevabımızın doğruluğunu kontrol et (Basit kontrol: Boş değilse ve hedef harfle başlıyorsa yeşil, değilse kırmızı)
       const mVal = myAns[cat] || "";
       const eVal = enemyAns[cat] || "";
       
       const mIsValid = mVal.startsWith(targetLetterStr) ? "#4ade80" : "#f87171";
       const eIsValid = eVal.startsWith(targetLetterStr) ? "#4ade80" : "#f87171";

       myAnswersList.innerHTML += `<div style="margin-bottom:5px;"><b>${cat.toUpperCase()}:</b> <span style="color:${mIsValid}">${mVal || "-"}</span></div>`;
       enemyAnswersList.innerHTML += `<div style="margin-bottom:5px;"><b>${cat.toUpperCase()}:</b> <span style="color:${eIsValid}">${eVal || "<i>Cevap Yok</i>"}</span></div>`;
    });
}
