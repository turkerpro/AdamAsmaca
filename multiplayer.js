import { DB } from "./firebase.js";

const btnRandom = document.getElementById("btn-random-match");
const btnCreate = document.getElementById("btn-create-room");
const btnJoin = document.getElementById("btn-join-room");
const inputCode = document.getElementById("room-code-input");
const btnCancel = document.getElementById("btn-cancel-match");

const overlay = document.getElementById("loading-overlay");
const loadingTitle = document.getElementById("loading-title");
const loadingDesc = document.getElementById("loading-desc");
const codeDisplay = document.getElementById("room-code-display");

let currentRoomId = null;
let unsubscribeListener = null;

// Basit bir oyun kelimesi havuzu (Daha sonra müfredattan çekilebilir)
const WORDS = ["BİLGİSAYAR", "KÜTÜPHANE", "MÜHENDİSLİK", "TÜRKİYE", "FOTOĞRAF", "GALAKSİ", "BİYOLOJİ", "ASTRONOMİ", "SİBERNETİK", "KAPLUMBAĞA", "EĞİTİM", "ŞAMPİYON"];
const getRandomWord = () => WORDS[Math.floor(Math.random() * WORDS.length)];

function showLoading(title, showCode = null) {
  overlay.style.display = "flex";
  loadingTitle.textContent = title;
  if (showCode) {
    loadingDesc.textContent = "Arkadaşınıza bu kodu gönderin. Odaya katıldığında oyun başlayacak.";
    codeDisplay.textContent = showCode;
    codeDisplay.style.display = "block";
  } else {
    loadingDesc.textContent = "Oyun başladığında otomatik yönlendirileceksiniz.";
    codeDisplay.style.display = "none";
  }
}

function hideLoading() {
  overlay.style.display = "none";
  if (unsubscribeListener) {
    unsubscribeListener();
    unsubscribeListener = null;
  }
  // Eğer odadan iptal ederek çıkıyorsa odayı silme/statüsünü değiştirme kodu eklenebilir
}

async function joinOrCreateRoom(isPrivate, roomCode = null) {
  btnRandom.disabled = true;
  btnCreate.disabled = true;
  btnJoin.disabled = true;
  
  try {
    const word = getRandomWord();
    const result = await DB.findOrCreateHangmanRoom(word, isPrivate, roomCode);
    
    currentRoomId = result.roomId;
    
    if (isPrivate && result.isHost) {
       showLoading("Oda Kuruldu!", result.roomCode);
    } else {
       showLoading("Rakip Bekleniyor/Bağlanılıyor...");
    }

    // Odayı dinle
    unsubscribeListener = DB.listenToHangmanRoom(currentRoomId, (roomData) => {
       if (roomData.status === "playing") {
          // Oyun başladı! Yönlendir...
          window.location.href = `./multiplayer-game.html?roomId=${currentRoomId}`;
       }
    });

  } catch(e) {
    console.error(e);
    alert("Odaya bağlanırken hata oluştu: " + e.message);
    hideLoading();
  } finally {
    btnRandom.disabled = false;
    btnCreate.disabled = false;
    btnJoin.disabled = false;
  }
}

btnRandom.addEventListener("click", () => joinOrCreateRoom(false));
btnCreate.addEventListener("click", () => joinOrCreateRoom(true));
btnJoin.addEventListener("click", () => {
  const code = inputCode.value.trim().toUpperCase();
  if (!code || code.length < 3) {
    alert("Lütfen geçerli bir oda kodu girin.");
    return;
  }
  joinOrCreateRoom(true, code);
});

btnCancel.addEventListener("click", hideLoading);
