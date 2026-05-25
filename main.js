// ── WORDS ──────────────────────────────────────────────────────────────────
let WORD_BANK = [];
// Uzak bir sunucudaki JSON dosyasını da buraya yazabilirsiniz (örnek: 'https://mysite.com/questions.json')
const QUESTIONS_URL = './questions.json';

async function loadQuestions() {
  try {
    const res = await fetch(QUESTIONS_URL);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    if (data && data.length > 0) {
      WORD_BANK = data;
    }
  } catch (error) {
    console.error("Sorular yüklenemedi:", error);
    // Fallback if fetch fails
    WORD_BANK = [
      {word:"HATA",hint:"Sorular yüklenemedi. Lütfen internet bağlantınızı kontrol edin.",category:"Sistem"}
    ];
  }
}

// ── LAYOUT ─────────────────────────────────────────────────────────────────
const TR_ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P","Ğ","Ü"],
  ["A","S","D","F","G","H","J","K","L","Ş","İ"],
  ["Z","X","C","V","B","N","M","Ö","Ç"],
  ["space"]
];

const BODY_PARTS = ["h-head","h-body","h-arm-l","h-arm-r","h-leg-l","h-leg-r"];
const MAX_WRONG = BODY_PARTS.length;

// ── STATE ───────────────────────────────────────────────────────────────────
let state = { word:"", hint:"", category:"", guessed:new Set(), wrong:[], score:0, over:false, won:false };

// ── INIT ────────────────────────────────────────────────────────────────────
function buildKeyboard() {
  TR_ROWS.forEach((row, ri) => {
    const el = document.getElementById(`row-${ri+1}`);
    el.innerHTML = "";
    if(ri === 3) return; // skip space row
    row.forEach(key => {
      const btn = document.createElement("button");
      btn.className = "key-btn"; btn.dataset.key = key; btn.textContent = key;
      btn.addEventListener("click", () => guess(key));
      el.appendChild(btn);
    });
  });
  document.getElementById("row-4").style.display = "none";
}

function newGame() {
  if(WORD_BANK.length === 0) return;
  const entry = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  state = { word: entry.word.toUpperCase(), hint: entry.hint, category: entry.category,
    guessed: new Set(), wrong: [], score: state.score, over: false, won: false };
  document.querySelectorAll(".overlay").forEach(e=>e.remove());
  updateUI();
}

// ── GUESS ────────────────────────────────────────────────────────────────────
function guess(key) {
  if (state.over) return;
  const k = key.toUpperCase();
  if (state.guessed.has(k)) return;
  state.guessed.add(k);

  const inWord = state.word.includes(k) || (k === " ");
  if (!inWord) {
    state.wrong.push(k);
    if (state.wrong.length >= MAX_WRONG) { state.over = true; state.won = false; }
  }

  // win check
  const letters = [...state.word].filter(c => c !== " ");
  const allFound = letters.every(c => state.guessed.has(c));
  if (allFound) { state.over = true; state.won = true; state.score += 10; }

  updateUI();
  if (state.over) setTimeout(() => showEndOverlay(), 700);
}

// ── UPDATE UI ────────────────────────────────────────────────────────────────
function updateUI() {
  document.getElementById("category-badge").textContent = state.category;
  document.getElementById("hint-text").textContent = "İpucu: " + state.hint;
  document.getElementById("score-val").textContent = state.score;
  updateWordDisplay();
  updateHangman();
  updateWrong();
  updateKeys();
  updateLives();
}

function updateWordDisplay() {
  const wd = document.getElementById("word-display");
  wd.innerHTML = "";
  [...state.word].forEach(ch => {
    const slot = document.createElement("div"); slot.className = "letter-slot";
    const char = document.createElement("div"); char.className = "letter-char";
    const line = document.createElement("div"); line.className = "letter-line";

    if (ch === " ") {
      slot.style.width = "20px";
      char.classList.add("space-char");
      line.classList.add("space-line");
    } else if (state.guessed.has(ch)) {
      char.classList.add("revealed");
      if (!state.won && state.over) char.classList.add("wrong-final");
    } else {
      char.classList.add("hidden");
    }
    char.textContent = ch === " " ? " " : (state.guessed.has(ch) || (state.over && !state.won) ? ch : "_");
    if (state.over && !state.won && !state.guessed.has(ch) && ch !== " ") {
      char.classList.remove("hidden"); char.classList.add("wrong-final"); char.textContent = ch;
    }
    slot.appendChild(char); slot.appendChild(line); wd.appendChild(slot);
  });
}

function updateHangman() {
  BODY_PARTS.forEach((id, i) => {
    const el = document.getElementById(id);
    el.style.opacity = i < state.wrong.length ? "1" : "0";
    el.style.transition = "opacity 0.4s ease";
  });
}

function updateWrong() {
  const wl = document.getElementById("wrong-letters");
  wl.innerHTML = "";
  state.wrong.forEach(ch => {
    const chip = document.createElement("div"); chip.className = "wrong-chip";
    chip.textContent = ch; wl.appendChild(chip);
  });
}

function updateKeys() {
  document.querySelectorAll(".key-btn").forEach(btn => {
    const k = btn.dataset.key;
    btn.classList.remove("correct","wrong");
    btn.disabled = false;
    if (state.guessed.has(k)) {
      btn.classList.add(state.word.includes(k) ? "correct" : "wrong");
      btn.disabled = true;
    }
    if (state.over) btn.disabled = true;
  });
}

function updateLives() {
  const lb = document.getElementById("lives-bar");
  lb.innerHTML = "";
  for (let i = 0; i < MAX_WRONG; i++) {
    const h = document.createElement("span");
    h.className = "heart" + (i < state.wrong.length ? " lost" : "");
    h.textContent = "❤️"; lb.appendChild(h);
  }
}

// ── END OVERLAY ──────────────────────────────────────────────────────────────
function showEndOverlay() {
  const ov = document.createElement("div"); ov.className = "overlay";
  const card = document.createElement("div"); card.className = "overlay-card";

  const icon = document.createElement("span"); icon.className = "overlay-icon";
  const title = document.createElement("h2"); title.className = "overlay-title";
  const sub = document.createElement("p"); sub.className = "overlay-sub";
  const wordEl = document.createElement("div"); wordEl.className = "overlay-word";
  const btnPrimary = document.createElement("button"); btnPrimary.className = "btn-primary";
  const btnSec = document.createElement("button"); btnSec.className = "btn-secondary";

  if (state.won) {
    icon.textContent = "🎉"; title.textContent = "Tebrikler!";
    sub.textContent = `+10 puan kazandın! Toplam: ${state.score}`;
    wordEl.textContent = state.word; btnPrimary.textContent = "Sıradaki kelime →";
    confetti();
  } else {
    icon.textContent = "💀"; title.textContent = "Eyvah, Astın!";
    sub.textContent = "Kelimeyi bilemeden adam asıldı.";
    wordEl.textContent = "Cevap: " + state.word;
    btnPrimary.textContent = "Tekrar Oyna";
  }
  btnSec.textContent = "Skoru Sıfırla";
  btnPrimary.addEventListener("click", () => newGame());
  btnSec.addEventListener("click", () => { state.score = 0; newGame(); });

  card.append(icon,title,sub,wordEl,btnPrimary,btnSec);
  ov.appendChild(card);
  document.body.appendChild(ov);
}

// ── CONFETTI ──────────────────────────────────────────────────────────────────
function confetti() {
  const colors = ["#4f98a3","#6daa45","#e8af34","#d163a7","#fdab43"];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement("div"); p.className = "confetti-piece";
    p.style.cssText = `left:${Math.random()*100}vw;top:-10px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      transform:rotate(${Math.random()*360}deg);opacity:1`;
    document.body.appendChild(p);
    const fall = p.animate([
      {transform:`translateY(0) rotate(0deg)`, opacity:1},
      {transform:`translateY(${80+Math.random()*40}vh) rotate(${360+Math.random()*360}deg)`, opacity:0}
    ],{duration:1200+Math.random()*1000,easing:"cubic-bezier(0.25,0.46,0.45,0.94)",delay:Math.random()*400});
    fall.onfinish = ()=>p.remove();
  }
}

// ── KEYBOARD PHYSICAL ────────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  const k = e.key.toUpperCase();
  if (k.length === 1 && /[A-ZÇĞİÖŞÜ]/.test(k)) guess(k);
});

// ── THEME TOGGLE ─────────────────────────────────────────────────────────────
(function(){
  const t=document.querySelector("[data-theme-toggle]"),r=document.documentElement;
  let d=matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light";
  r.setAttribute("data-theme",d);
  t&&t.addEventListener("click",()=>{
    d=d==="dark"?"light":"dark";r.setAttribute("data-theme",d);
    t.innerHTML=d==="dark"
      ?'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
      :'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
  });
})();

// ── START ────────────────────────────────────────────────────────────────────
async function init() {
  buildKeyboard();
  await loadQuestions();
  newGame();
}

init();
