import { DB, auth } from "./firebase.js";

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');

if (!roomId) {
  alert("Oda bulunamadı!");
  window.location.href = "./multiplayer.html";
}

const wordDisplay = document.getElementById("word-display");
const keyboard = document.getElementById("keyboard");
const p1Name = document.getElementById("p1-name");
const p1Score = document.getElementById("p1-score");
const p2Name = document.getElementById("p2-name");
const p2Score = document.getElementById("p2-score");

const gameOverOverlay = document.getElementById("game-over-overlay");
const gameOverTitle = document.getElementById("game-over-title");
const gameOverDesc = document.getElementById("game-over-desc");

let myUid = null;
let myPlayerNum = 0; // 1 or 2
let currentWord = "";
let isGameOver = false;

// Harfleri çizmek için
const QWERTY_TR = ["E","R","T","Y","U","I","O","P","Ğ","Ü","A","S","D","F","G","H","J","K","L","Ş","İ","Z","C","V","B","N","M","Ö","Ç"];

function initKeyboard() {
  keyboard.innerHTML = "";
  QWERTY_TR.forEach(letter => {
    const btn = document.createElement("button");
    btn.className = "key-btn";
    btn.textContent = letter;
    btn.id = `key-${letter}`;
    btn.addEventListener("click", () => handleKeyPress(letter));
    keyboard.appendChild(btn);
  });
}

function handleKeyPress(letter) {
  if (isGameOver) return;
  const btn = document.getElementById(`key-${letter}`);
  if (btn.disabled) return;
  
  // Anında disable yap (Double click önlemek için)
  btn.disabled = true;

  const isCorrect = currentWord.includes(letter);
  
  // Veritabanına bildir
  DB.guessLetterHangman(roomId, letter, myUid, isCorrect);
  if(isCorrect) {
     DB.updateHangmanScore(roomId, myPlayerNum, 10);
  }
}

function renderWord(roomData) {
   wordDisplay.innerHTML = "";
   let allLettersGuessed = true;

   for (const char of currentWord) {
     const letterBox = document.createElement("div");
     letterBox.className = "letter-box";
     
     // Bu harf tahmin edilmiş mi?
     const guessObj = roomData.guessedLetters.find(g => g.letter === char && g.isCorrect);
     
     if (guessObj) {
        letterBox.textContent = char;
        letterBox.classList.add("revealed");
        // Rengi kimin bildiğine göre ayarla
        if (guessObj.ownerUid === myUid) {
           letterBox.style.color = "#4ade80";
           letterBox.style.borderColor = "#4ade80";
        } else {
           letterBox.style.color = "#f87171";
           letterBox.style.borderColor = "#f87171";
        }
     } else {
        allLettersGuessed = false;
     }
     wordDisplay.appendChild(letterBox);
   }

   // Eğer tüm harfler bilindiyse oyunu bitir
   if (allLettersGuessed && !isGameOver) {
      isGameOver = true;
      checkGameOver(roomData);
   }
}

function renderKeyboardState(roomData) {
   roomData.guessedLetters.forEach(guess => {
      const btn = document.getElementById(`key-${guess.letter}`);
      if(btn) {
         btn.disabled = true;
         if (guess.isCorrect) {
            btn.style.background = guess.ownerUid === myUid ? "#4ade80" : "#f87171";
            btn.style.color = "#000";
         } else {
            btn.style.opacity = "0.3";
         }
      }
   });
}

function checkGameOver(roomData) {
    if (roomData.status !== "finished") {
        DB.finishHangmanRoom(roomId);
    }
    
    let p1 = roomData.player1.score;
    let p2 = roomData.player2 ? roomData.player2.score : 0;
    
    let winMsg = "";
    if (p1 > p2) {
       winMsg = `${roomData.player1.name} KAZANDI!`;
    } else if (p2 > p1) {
       winMsg = `${roomData.player2.name} KAZANDI!`;
    } else {
       winMsg = "BERABERE!";
    }

    gameOverTitle.textContent = winMsg;
    gameOverDesc.textContent = `Puanlar: ${p1} - ${p2}`;
    gameOverOverlay.style.display = "flex";
}

// Oyunu Başlat
setTimeout(() => {
    // Auth durumunun hazır olmasını ufak bir timer ile bekle (veya onAuthStateChanged kullanılabilir)
    myUid = auth.currentUser ? auth.currentUser.uid : "guest_" + Math.random().toString(36).substring(2,8);
    initKeyboard();

    DB.listenToHangmanRoom(roomId, (roomData) => {
        if (!roomData) return;
        currentWord = roomData.word;

        // Player bilgilerini ata
        if (roomData.player1) {
           p1Name.textContent = roomData.player1.uid === myUid ? roomData.player1.name + " (Sen)" : roomData.player1.name;
           p1Score.textContent = roomData.player1.score;
           if (roomData.player1.uid === myUid) myPlayerNum = 1;
        }
        if (roomData.player2) {
           p2Name.textContent = roomData.player2.uid === myUid ? roomData.player2.name + " (Sen)" : roomData.player2.name;
           p2Score.textContent = roomData.player2.score;
           if (roomData.player2.uid === myUid) myPlayerNum = 2;
        }

        renderWord(roomData);
        renderKeyboardState(roomData);

        if (roomData.status === "finished") {
           isGameOver = true;
           checkGameOver(roomData);
        }
    });
}, 1500);
