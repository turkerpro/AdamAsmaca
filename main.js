// ── STATE & DATA ────────────────────────────────────────────────────────────
let CURRICULUM_DATA = null;
const INDEX_URL = './curriculum_index.json';

let selectedGrade = null;
let selectedSubject = null;
let selectedUnit = null;

const PREFETCHED_DATA = {}; // Arka plan önbelleği

let WORD_BANK = [];
let availableWords = [];

let savedScore = 0;
try {
  const saved = sessionStorage.getItem("hangman_score");
  if (saved) {
    const data = JSON.parse(saved);
    if (data.date === new Date().toLocaleDateString()) {
      savedScore = data.score;
    }
  }
} catch(e) {}

let gameState = { word:"", hint:"", category:"", guessed:new Set(), wrong:[], score:savedScore, over:false, won:false };

function saveScore() {
  sessionStorage.setItem("hangman_score", JSON.stringify({ score: gameState.score, date: new Date().toLocaleDateString() }));
}

// ── LAYOUT CONSTANTS ───────────────────────────────────────────────────────
const KEYBOARDS = {
  qwerty: [
    ["Q","W","E","R","T","Y","U","I","O","P","Ğ","Ü"],
    ["A","S","D","F","G","H","J","K","L","Ş","İ"],
    ["Z","X","C","V","B","N","M","Ö","Ç"],
    ["space"]
  ],
  f: [
    ["F","G","Ğ","I","O","D","R","N","H","P","Q","W"],
    ["U","İ","E","A","Ü","T","K","M","L","Y","Ş"],
    ["J","Ö","V","C","Ç","Z","S","B","X"],
    ["space"]
  ],
  smart: [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["Ğ","Ü","A","S","D","F","G","H","J","K"],
    ["L","Ş","İ","Z","X","C","V","B","N","M"],
    ["Ö","Ç","space"]
  ],
  mobile_q: [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["Z","X","C","V","B","N","M"],
    ["Ğ","Ü","Ş","İ","Ö","Ç","space"]
  ],
  abc: [
    ["A","B","C","Ç","D","E","F","G"],
    ["Ğ","H","I","İ","J","K","L","M"],
    ["N","O","Ö","P","R","S","Ş","T"],
    ["U","Ü","V","Y","Z","space"]
  ]
};

let currentKeyboard = localStorage.getItem("adamAsmacaKb") || "qwerty";

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

  // Set up Keyboard select
  const kbSelect = document.getElementById('keyboard-select');
  if (kbSelect) {
    kbSelect.value = currentKeyboard;
    kbSelect.addEventListener('change', (e) => {
      currentKeyboard = e.target.value;
      localStorage.setItem("adamAsmacaKb", currentKeyboard);
      buildKeyboard();
      updateKeys();
    });
  }
  
  // Start on grade screen
  if(CURRICULUM_DATA && CURRICULUM_DATA.length > 0) {
    populateGrades();
    await startRandomGame();
    startBackgroundPrefetch(); // Arka planda diğer dersleri çekmeye başla
  } else {
    document.getElementById('grade-list').innerHTML = '<p>Müfredat yüklenemedi. Lütfen internet bağlantınızı kontrol edin.</p>';
  }
}

function startBackgroundPrefetch() {
  if(!CURRICULUM_DATA) return;
  const allUrls = [];
  CURRICULUM_DATA.forEach(g => g.subjects.forEach(s => allUrls.push(s.dataFile)));
  
  let i = 0;
  function fetchNext() {
    if(i >= allUrls.length) return;
    const url = allUrls[i++];
    if(!PREFETCHED_DATA[url]) {
       fetch(url + "?t=" + Date.now()).then(r=>r.json()).then(d=>{
          PREFETCHED_DATA[url] = d;
          setTimeout(fetchNext, 1500); // 1.5 saniye arayla yavaşça çek
       }).catch(() => setTimeout(fetchNext, 1500));
    } else {
       fetchNext();
    }
  }
  setTimeout(fetchNext, 3000); // Oyuna girdikten 3 saniye sonra başla
}

async function startRandomGame() {
  let attempts = 0;
  const maxAttempts = 20;

  while(attempts < maxAttempts) {
    attempts++;
    const rGrade = CURRICULUM_DATA[Math.floor(Math.random() * CURRICULUM_DATA.length)];
    if (!rGrade.subjects || rGrade.subjects.length === 0) continue;
    
    const rSubj = rGrade.subjects[Math.floor(Math.random() * rGrade.subjects.length)];
    
    try {
      let data;
      if (PREFETCHED_DATA[rSubj.dataFile]) {
        data = PREFETCHED_DATA[rSubj.dataFile];
      } else {
        const res = await fetch(rSubj.dataFile + "?t=" + Date.now());
        if(!res.ok) continue; // 404, try another one
        data = await res.json();
        PREFETCHED_DATA[rSubj.dataFile] = data;
      }
      
      if(data.units && data.units.length > 0) {
        const non_empty_units = data.units.filter(u => u.words && u.words.length > 0);
        if (non_empty_units.length === 0) continue;
        
        selectedGrade = rGrade;
        applyGradeTheme(selectedGrade.grade);
        selectedSubject = rSubj;
        const rUnit = non_empty_units[Math.floor(Math.random() * non_empty_units.length)];
        selectedUnit = rUnit;
        WORD_BANK = rUnit.words;
        availableWords = [...WORD_BANK];
        newGame();
        showGameScreen();
        return; // Success
      }
    } catch (err) {
      // JSON parse error or network error, loop again
    }
  }
  
  // If we couldn't find any valid JSON after 20 tries, fallback to grade screen
  showGradeScreen();
}

async function loadCurriculum() {
  try {
    const res = await fetch(INDEX_URL + "?t=" + Date.now());
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

// ── THEME HELPERS ──────────────────────────────────────────────────────────
function getGradeThemeGroup(gradeNum) {
  const g = parseInt(gradeNum);
  if (g === 99) return { group: "exam", emoji: "🏆" };
  if (g >= 1 && g <= 3) return { group: "primary", emoji: "🎈" };
  if (g >= 4 && g <= 5) return { group: "adventure", emoji: "🌲" };
  if (g >= 6 && g <= 8) return { group: "tech", emoji: "👾" };
  if (g >= 9 && g <= 12) return { group: "academic", emoji: "🏛️" };
  return { group: "", emoji: "📚" };
}

function applyGradeTheme(gradeNum) {
  if (!gradeNum) {
    document.documentElement.removeAttribute("data-grade-group");
    return;
  }
  const theme = getGradeThemeGroup(gradeNum);
  document.documentElement.setAttribute("data-grade-group", theme.group);
}

function showGradeScreen() {
  selectedGrade = null;
  applyGradeTheme(null);
  switchScreen('grade-screen');
}

function showSubjectScreen() {
  selectedSubject = null;
  selectedUnit = null;
  if (selectedGrade) {
    populateSubjects();
  } else {
    showGradeScreen();
    return;
  }
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
    const theme = getGradeThemeGroup(gradeItem.grade);
    btn.className = `grid-card theme-${theme.group}`;
    
    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'card-emoji';
    emojiSpan.textContent = theme.emoji;
    
    const textSpan = document.createElement('span');
    textSpan.textContent = gradeItem.gradeName;
    
    btn.appendChild(emojiSpan);
    btn.appendChild(textSpan);
    
    btn.addEventListener('click', () => {
      selectedGrade = gradeItem;
      applyGradeTheme(selectedGrade.grade);
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
        let data;
        if (PREFETCHED_DATA[subject.dataFile]) {
          data = PREFETCHED_DATA[subject.dataFile];
        } else {
          const res = await fetch(subject.dataFile + "?t=" + Date.now());
          if(!res.ok) throw new Error("Veri çekilemedi");
          data = await res.json();
          PREFETCHED_DATA[subject.dataFile] = data;
        }
        
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
  const isEnglish = selectedSubject && selectedSubject.id === "ingilizce";
  let layout;
  if (isEnglish) {
    layout = [
      ["Q","W","E","R","T","Y","U","I","O","P"],
      ["A","S","D","F","G","H","J","K","L"],
      ["Z","X","C","V","B","N","M"],
      ["space"]
    ];
  } else {
    layout = KEYBOARDS[currentKeyboard];
  }
  layout.forEach((row, ri) => {
    const el = document.getElementById(`row-${ri+1}`);
    if(!el) return;
    el.innerHTML = "";
    if(row[0] === "space" && row.length === 1) return; // skip space only row
    row.forEach(key => {
      if(key === "space") return;
      const btn = document.createElement("button");
      btn.className = "key-btn"; btn.dataset.key = key; btn.textContent = key;
      btn.addEventListener("click", () => guess(key));
      el.appendChild(btn);
    });
    el.style.display = (row.length === 1 && row[0] === "space") ? "none" : "flex";
  });
  
  const r4 = document.getElementById("row-4");
  if (layout.length < 4) {
    if(r4) r4.style.display = "none";
  } else {
    if(r4 && !(layout[3].length === 1 && layout[3][0] === "space")) {
      r4.style.display = "flex";
    }
  }
}

function toTrUpperCase(str) {
  return str.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

function newGame() {
  if(!WORD_BANK || WORD_BANK.length === 0) {
    alert("Bu ünitede henüz soru bulunmamaktadır. Lütfen başka bir ünite seçin.");
    showSubjectScreen();
    return;
  }
  
  buildKeyboard();
  
  if(availableWords.length === 0) {
    availableWords = [...WORD_BANK];
  }
  
  const randomIndex = Math.floor(Math.random() * availableWords.length);
  const entry = availableWords.splice(randomIndex, 1)[0];
  
  const gradePrefix = selectedGrade ? `${selectedGrade.gradeName} - ` : '';
  const categoryText = `${gradePrefix}${selectedSubject.name} - ${selectedUnit.name.split(':')[0]}`;
  
  const isEnglish = selectedSubject && selectedSubject.id === "ingilizce";
  let finalWord;
  if (isEnglish) {
    finalWord = entry.word.replace(/İ/g, "I").replace(/ı/g, "I").toUpperCase();
  } else {
    finalWord = toTrUpperCase(entry.word);
  }
  
  gameState = { 
    word: finalWord, 
    hint: entry.hint, 
    category: categoryText,
    guessed: new Set(), 
    wrong: [], 
    score: gameState.score ?? 0,
    startingScore: gameState.score ?? 0,
    over: false, 
    won: false 
  };
  
  document.querySelectorAll(".overlay").forEach(e=>e.remove());
  updateUI();
}

function guess(key) {
  if (gameState.over) return;
  const isEnglish = selectedSubject && selectedSubject.id === "ingilizce";
  const k = isEnglish ? key.replace(/İ/g, "I").replace(/ı/g, "I").toUpperCase() : toTrUpperCase(key);
  if (gameState.guessed.has(k)) return;
  gameState.guessed.add(k);

  const inWord = gameState.word.includes(k);
  if (!inWord) {
    gameState.wrong.push(k);
    gameState.score -= 2;
    saveScore();
    if (gameState.wrong.length >= MAX_WRONG) { gameState.over = true; gameState.won = false; }
  }

  // win check
  const letters = [...gameState.word].filter(c => isEnglish ? /[A-Z]/.test(c) : /[A-ZÇĞİÖŞÜ]/.test(c));
  const allFound = letters.length > 0 && letters.every(c => gameState.guessed.has(c));
  if (allFound) { gameState.over = true; gameState.won = true; gameState.score += 10; saveScore(); }

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
  const isEnglish = selectedSubject && selectedSubject.id === "ingilizce";
  [...gameState.word].forEach(ch => {
    const slot = document.createElement("div"); slot.className = "letter-slot";
    const char = document.createElement("div"); char.className = "letter-char";
    const line = document.createElement("div"); line.className = "letter-line";

    const isLetter = isEnglish ? /[A-Z]/.test(ch) : /[A-ZÇĞİÖŞÜ]/.test(ch);

    if (!isLetter) {
      if (ch === " ") {
        slot.style.width = "20px";
        char.classList.add("space-char");
        line.classList.add("space-line");
      } else {
        char.classList.add("revealed");
        line.style.display = "none";
      }
      char.textContent = ch;
    } else if (gameState.guessed.has(ch)) {
      char.classList.add("revealed");
      if (!gameState.won && gameState.over) char.classList.add("wrong-final");
      char.textContent = ch;
    } else {
      char.classList.add("hidden");
      char.textContent = "_";
    }
    
    if (gameState.over && !gameState.won && isLetter && !gameState.guessed.has(ch)) {
      char.classList.remove("hidden");
      char.classList.add("wrong-final");
      char.textContent = ch;
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
    const netGain = gameState.score - gameState.startingScore;
    icon.textContent = "🎉"; title.textContent = "Tebrikler!";
    sub.textContent = `+${netGain} puan kazandın! Toplam: ${gameState.score}`;
    wordEl.textContent = gameState.word; btnPrimary.textContent = "Sıradaki kelime →";
    confetti();
  } else {
    const lostPoints = gameState.startingScore - gameState.score;
    icon.textContent = "💀"; title.textContent = "Eyvah, Astın!";
    if (lostPoints > 0) {
      sub.textContent = `Yanlış harflerden ${lostPoints} puan kaybettin. Toplam Puan: ${gameState.score}`;
    } else {
      sub.textContent = `Kelimeyi bilemeden adam asıldı. Toplam Puan: ${gameState.score}`;
    }
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
    const isEnglish = selectedSubject && selectedSubject.id === "ingilizce";
    const k = isEnglish ? e.key.replace(/İ/g, "I").replace(/ı/g, "I").toUpperCase() : toTrUpperCase(e.key);
    if (isEnglish) {
      if (k.length === 1 && /[A-Z]/.test(k)) guess(k);
    } else {
      if (k.length === 1 && /[A-ZÇĞİÖŞÜ]/.test(k)) guess(k);
    }
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
