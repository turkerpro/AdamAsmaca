// ── STATE & DATA ────────────────────────────────────────────────────────────
let CURRICULUM_DATA = null;
const INDEX_URL = './curriculum_index.json';

let selectedGrade = null;
let selectedSubject = null;
let selectedUnit = null;

let WORD_BANK = [];
let availableWords = [];
let gameState = { word:"", hint:"", category:"", guessed:new Set(), wrong:[], score:0, over:false, won:false };

// ── LAYOUT CONSTANTS ───────────────────────────────────────────────────────
const TR_ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["Ğ","Ü","A","S","D","F","G","H","J","K"],
  ["L","Ş","İ","Z","X","C","V","B","N","M"],
  ["Ö","Ç","space"]
];

const BODY_PARTS = ["h-head","h-body","h-arm-l","h-arm-r","h-leg-l","h-leg-r"];
const MAX_WRONG = BODY_PARTS.length;

// ── INIT & FETCH ────────────────────────────────────────────────────────────
async function init() {
  buildKeyboard();
  await loadCurriculum();
  
  // Set up back buttons
  document.getElementById('back-to-grades').addEventListener('click', showGradeScreen);
  
  const backToSubBtn = document.getElementById('back-to-subjects');
  if(backToSubBtn) {
     backToSubBtn.addEventListener('click', showGradeScreen);
  }
  
  // Start on grade screen
  if(CURRICULUM_DATA && CURRICULUM_DATA.length > 0) {
    populateGrades();
    await startRandomGame();
  } else {
    document.getElementById('grade-list').innerHTML = '<p>Müfredat yüklenemedi. Lütfen internet bağlantınızı kontrol edin.</p>';
  }
}

async function startRandomGame() {
  const rGrade = CURRICULUM_DATA[Math.floor(Math.random() * CURRICULUM_DATA.length)];
  selectedGrade = rGrade;
  
  if (!rGrade.subjects || rGrade.subjects.length === 0) { showGradeScreen(); return; }
  const rSubj = rGrade.subjects[Math.floor(Math.random() * rGrade.subjects.length)];
  selectedSubject = rSubj;
  
  try {
    const res = await fetch(rSubj.dataFile);
    if(!res.ok) throw new Error();
    const data = await res.json();
    if(data.units && data.units.length > 0) {
      const rUnit = data.units[Math.floor(Math.random() * data.units.length)];
      selectedUnit = rUnit;
      WORD_BANK = rUnit.words;
      availableWords = [...WORD_BANK];
      newGame();
      showGameScreen();
    } else {
      showGradeScreen();
    }
  } catch (err) {
    showGradeScreen();
  }
}

async function loadCurriculum() {
  try {
    const res = await fetch(INDEX_URL);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    if (data && data.curriculum) {
      CURRICULUM_DATA = data.curriculum;
    }
  } catch (error) {
    console.error("Müfredat yüklenemedi:", error);
  }
}

// ── NAVIGATION & SCREENS ────────────────────────────────────────────────────
function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function showGradeScreen() {
  selectedGrade = null;
  switchScreen('grade-screen');
}

function showSubjectScreen() {
  selectedSubject = null;
  selectedUnit = null;
  switchScreen('subject-screen');
}

function showGameScreen() {
  switchScreen('game-screen');
}

// ── UI BUILDERS ─────────────────────────────────────────────────────────────
function populateGrades() {
  const list = document.getElementById('grade-list');
  list.innerHTML = '';
  
  CURRICULUM_DATA.forEach(gradeItem => {
    const btn = document.createElement('button');
    btn.className = 'grid-card';
    btn.textContent = gradeItem.gradeName;
    btn.addEventListener('click', () => {
      selectedGrade = gradeItem;
      populateSubjects();
      showSubjectScreen();
    });
    list.appendChild(btn);
  });
}

function populateSubjects() {
  document.getElementById('selected-grade-title').textContent = selectedGrade.gradeName + " - Ders Seçimi";
  const list = document.getElementById('subject-list');
  list.innerHTML = '';
  
  const currentMonth = new Date().getMonth() + 1; // 1-12
  
  selectedGrade.subjects.forEach(subject => {
    const card = document.createElement('div');
    card.className = 'subject-card';
    
    const header = document.createElement('div');
    header.className = 'subject-header';
    header.textContent = subject.name + " ▼";
    header.style.cursor = 'pointer';
    card.appendChild(header);
    
    const unitList = document.createElement('div');
    unitList.className = 'unit-list';
    unitList.style.display = 'none'; // hidden initially
    card.appendChild(unitList);
    
    header.addEventListener('click', async () => {
      // toggle visibility
      if (unitList.style.display === 'flex') {
         unitList.style.display = 'none';
         header.textContent = subject.name + " ▼";
         return;
      }
      
      header.textContent = subject.name + " ▲";
      
      // if already loaded, just show
      if (unitList.innerHTML !== '') {
         unitList.style.display = 'flex';
         return;
      }

      // Load data lazily
      unitList.innerHTML = '<div style="padding:16px;text-align:center;color:var(--color-text-muted);">Üniteler yükleniyor...</div>';
      unitList.style.display = 'flex';
      
      try {
        const res = await fetch(subject.dataFile);
        if(!res.ok) throw new Error("Veri çekilemedi");
        const data = await res.json();
        
        unitList.innerHTML = '';
        
        data.units.forEach(unit => {
          const isRecommended = unit.months && unit.months.includes(currentMonth);
          const unitBtn = document.createElement('button');
          unitBtn.className = 'unit-item' + (isRecommended ? ' recommended' : '');
          
          const titleSpan = document.createElement('span');
          titleSpan.textContent = unit.name;
          unitBtn.appendChild(titleSpan);
          
          if(isRecommended) {
            const badge = document.createElement('span');
            badge.className = 'unit-badge';
            badge.textContent = 'Şu Anki Ünite';
            unitBtn.appendChild(badge);
          }
          
          unitBtn.addEventListener('click', () => {
            selectedSubject = subject;
            selectedUnit = unit;
            WORD_BANK = unit.words;
            availableWords = [...WORD_BANK];
            newGame();
            showGameScreen();
          });
          unitList.appendChild(unitBtn);
        });
      } catch (err) {
        unitList.innerHTML = '<div style="padding:16px;text-align:center;color:var(--color-error);">Veri dosyası bulunamadı.</div>';
      }
    });
    
    list.appendChild(card);
  });
}

// ── GAME LOGIC ──────────────────────────────────────────────────────────────
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
  if(!WORD_BANK || WORD_BANK.length === 0) return;
  
  if(availableWords.length === 0) {
    availableWords = [...WORD_BANK];
  }
  
  const randomIndex = Math.floor(Math.random() * availableWords.length);
  const entry = availableWords.splice(randomIndex, 1)[0];
  
  const categoryText = `${selectedSubject.name} - ${selectedUnit.name.split(':')[0]}`;
  
  gameState = { 
    word: entry.word.toUpperCase(), 
    hint: entry.hint, 
    category: categoryText,
    guessed: new Set(), 
    wrong: [], 
    score: gameState.score, 
    over: false, 
    won: false 
  };
  
  document.querySelectorAll(".overlay").forEach(e=>e.remove());
  updateUI();
}

function guess(key) {
  if (gameState.over) return;
  const k = key.toUpperCase();
  if (gameState.guessed.has(k)) return;
  gameState.guessed.add(k);

  const inWord = gameState.word.includes(k) || (k === " ");
  if (!inWord) {
    gameState.wrong.push(k);
    if (gameState.wrong.length >= MAX_WRONG) { gameState.over = true; gameState.won = false; }
  }

  // win check
  const letters = [...gameState.word].filter(c => c !== " ");
  const allFound = letters.every(c => gameState.guessed.has(c));
  if (allFound) { gameState.over = true; gameState.won = true; gameState.score += 10; }

  updateUI();
  if (gameState.over) setTimeout(() => showEndOverlay(), 700);
}

// ── UPDATE UI ────────────────────────────────────────────────────────────────
function updateUI() {
  document.getElementById("category-badge").textContent = gameState.category;
  document.getElementById("hint-text").textContent = "İpucu: " + gameState.hint;
  document.getElementById("score-val").textContent = gameState.score;
  updateWordDisplay();
  updateHangman();
  updateWrong();
  updateKeys();
  updateLives();
}

function updateWordDisplay() {
  const wd = document.getElementById("word-display");
  wd.innerHTML = "";
  [...gameState.word].forEach(ch => {
    const slot = document.createElement("div"); slot.className = "letter-slot";
    const char = document.createElement("div"); char.className = "letter-char";
    const line = document.createElement("div"); line.className = "letter-line";

    if (ch === " ") {
      slot.style.width = "20px";
      char.classList.add("space-char");
      line.classList.add("space-line");
    } else if (gameState.guessed.has(ch)) {
      char.classList.add("revealed");
      if (!gameState.won && gameState.over) char.classList.add("wrong-final");
    } else {
      char.classList.add("hidden");
    }
    char.textContent = ch === " " ? " " : (gameState.guessed.has(ch) || (gameState.over && !gameState.won) ? ch : "_");
    if (gameState.over && !gameState.won && !gameState.guessed.has(ch) && ch !== " ") {
      char.classList.remove("hidden"); char.classList.add("wrong-final"); char.textContent = ch;
    }
    slot.appendChild(char); slot.appendChild(line); wd.appendChild(slot);
  });
}

function updateHangman() {
  BODY_PARTS.forEach((id, i) => {
    const el = document.getElementById(id);
    el.style.opacity = i < gameState.wrong.length ? "1" : "0";
    el.style.transition = "opacity 0.4s ease";
  });
}

function updateWrong() {
  const wl = document.getElementById("wrong-letters");
  wl.innerHTML = "";
  gameState.wrong.forEach(ch => {
    const chip = document.createElement("div"); chip.className = "wrong-chip";
    chip.textContent = ch; wl.appendChild(chip);
  });
}

function updateKeys() {
  document.querySelectorAll(".key-btn").forEach(btn => {
    const k = btn.dataset.key;
    btn.classList.remove("correct","wrong");
    btn.disabled = false;
    if (gameState.guessed.has(k)) {
      btn.classList.add(gameState.word.includes(k) ? "correct" : "wrong");
      btn.disabled = true;
    }
    if (gameState.over) btn.disabled = true;
  });
}

function updateLives() {
  const lb = document.getElementById("lives-bar");
  lb.innerHTML = "";
  for (let i = 0; i < MAX_WRONG; i++) {
    const h = document.createElement("span");
    h.className = "heart" + (i < gameState.wrong.length ? " lost" : "");
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
  const btnBack = document.createElement("button"); btnBack.className = "btn-secondary";
  btnBack.style.marginLeft = "var(--space-2)";

  if (gameState.won) {
    icon.textContent = "🎉"; title.textContent = "Tebrikler!";
    sub.textContent = `+10 puan kazandın! Toplam: ${gameState.score}`;
    wordEl.textContent = gameState.word; btnPrimary.textContent = "Sıradaki kelime →";
    confetti();
  } else {
    icon.textContent = "💀"; title.textContent = "Eyvah, Astın!";
    sub.textContent = "Kelimeyi bilemeden adam asıldı.";
    wordEl.textContent = "Cevap: " + gameState.word;
    btnPrimary.textContent = "Tekrar Oyna";
  }
  btnSec.textContent = "Skoru Sıfırla";
  btnBack.textContent = "Ders Seç";
  
  btnPrimary.addEventListener("click", () => newGame());
  btnSec.addEventListener("click", () => { gameState.score = 0; newGame(); });
  btnBack.addEventListener("click", () => {
    document.querySelectorAll(".overlay").forEach(e=>e.remove());
    showSubjectScreen();
  });

  card.append(icon,title,sub,wordEl,btnPrimary,btnSec,btnBack);
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
  if(document.getElementById('game-screen').classList.contains('active')) {
    const k = e.key.toUpperCase();
    if (k.length === 1 && /[A-ZÇĞİÖŞÜ]/.test(k)) guess(k);
  }
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

// Bismillah
init();
