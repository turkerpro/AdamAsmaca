// ── STATE & DATA ────────────────────────────────────────────────────────────
let CURRICULUM_DATA = null;
const INDEX_URL = './curriculum_index.json';

let selectedGrade = null;
let selectedSubject = null;
let selectedUnit = null;

const PREFETCHED_DATA = {}; // Arka plan önbelleği

let WORD_BANK = [];
let availableWords = [];
let isReviewMode = false; // Hata Defteri tekrar modu aktif mi?

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

// Oyun özellikleri durumları
let currentDifficulty = localStorage.getItem("adamAsmacaDiff") || "medium";
let timeModeActive = localStorage.getItem("adamAsmacaTimeMode") === "true";
let timeLeft = 60;
let timerInterval = null;
let jokersLeft = 3;
let streakCount = 0;

let gameState = { 
  word: "", 
  hint: "", 
  category: "", 
  guessed: new Set(), 
  wrong: [], 
  score: savedScore, 
  startingScore: savedScore,
  over: false, 
  won: false 
};

function saveScore() {
  sessionStorage.setItem("hangman_score", JSON.stringify({ score: gameState.score, date: new Date().toLocaleDateString() }));
}

// ── RETRO SOUNDS (Web Audio API) ───────────────────────────────────────────
const SOUNDS = {
  ctx: null,
  muted: localStorage.getItem("adamAsmacaMuted") === "true",
  
  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  },
  
  playBeep(freq, duration, type = "sine") {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      if (this.ctx.state === "suspended") this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch(e) {}
  },
  
  correct() {
    this.playBeep(587.33, 0.15); // D5
    setTimeout(() => this.playBeep(880, 0.15), 100); // A5
  },
  
  wrong() {
    this.playBeep(220, 0.25, "sawtooth"); // A3
    setTimeout(() => this.playBeep(180, 0.25, "sawtooth"), 120);
  },
  
  tick() {
    this.playBeep(900, 0.05, "triangle");
  },
  
  win() {
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((n, idx) => {
      setTimeout(() => this.playBeep(n, 0.25), idx * 100);
    });
  },
  
  lose() {
    const notes = [220, 196, 174.61, 146.83];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playBeep(n, 0.35, "triangle"), idx * 130);
    });
  }
};

// ── LOCAL STORAGE HELPERS (Stats & Badges & Mistakes) ────────────────────────
const STATS = {
  get() {
    const defaultStats = { totalGames: 0, gamesWon: 0, longestStreak: 0, subjectScores: {} };
    try {
      return JSON.parse(localStorage.getItem("hangman_stats")) || defaultStats;
    } catch(e) {
      return defaultStats;
    }
  },
  save(stats) {
    localStorage.setItem("hangman_stats", JSON.stringify(stats));
  },
  recordGame(won, streak, subjectId, subjectName) {
    const s = this.get();
    s.totalGames++;
    if (won) s.gamesWon++;
    if (streak > s.longestStreak) s.longestStreak = streak;
    
    // Ders bazlı skorlar
    if (!s.subjectScores[subjectId]) {
      s.subjectScores[subjectId] = { name: subjectName, played: 0, won: 0 };
    }
    s.subjectScores[subjectId].played++;
    if (won) s.subjectScores[subjectId].won++;
    
    this.save(s);
    BADGES.checkAndUnlock(won, streak);
  }
};

const BADGES = {
  list: [
    { id: "first_win", name: "İlk Başarı 🏅", desc: "İlk kelimeni doğru tahmin ettin." },
    { id: "streak_3", name: "Seri Başlangıcı 🔥", desc: "Üst üste 3 kelime bildin." },
    { id: "streak_5", name: "Seri Ustası ⚡", desc: "Üst üste 5 kelime bildin." },
    { id: "perfect_win", name: "Kusursuz Zafer ⭐", desc: "Hiç hata yapmadan kelimeyi bildin." },
    { id: "hard_win", name: "Zorlu Mücadele 💪", desc: "Zor seviyede bir kelime bildin." },
    { id: "time_survivor", name: "Zaman Bükücü ⏳", desc: "Süreli modda son 10 saniyede bildin." },
    { id: "mistake_clear", name: "Hata Defteri Temizliği 📘", desc: "Hata Defterinden bir kelimeyi bildin." }
  ],
  getUnlocked() {
    try {
      return JSON.parse(localStorage.getItem("hangman_badges")) || [];
    } catch(e) {
      return [];
    }
  },
  unlock(badgeId) {
    const unlocked = this.getUnlocked();
    // Her kazanımda sayacı artır (seviye sistemi için)
    incrementBadgeCount(badgeId);
    if (!unlocked.includes(badgeId)) {
      unlocked.push(badgeId);
      localStorage.setItem("hangman_badges", JSON.stringify(unlocked));
      
      const badge = this.list.find(b => b.id === badgeId);
      if (badge) {
        setTimeout(() => this.showToast(badge), 1000);
      }
    }
  },
  checkAndUnlock(won, streak) {
    if (!won) return;
    this.unlock("first_win");
    if (streak >= 3) this.unlock("streak_3");
    if (streak >= 5) this.unlock("streak_5");
    if (gameState.wrong.length === 0) this.unlock("perfect_win");
    if (currentDifficulty === "hard") this.unlock("hard_win");
    if (timeModeActive && timeLeft <= 10) this.unlock("time_survivor");
    if (isReviewMode) this.unlock("mistake_clear");
  },
  showToast(badge) {
    SOUNDS.win();
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(100px);
      background: var(--color-surface); border: 2px solid var(--color-primary);
      padding: 16px 24px; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
      display: flex; flex-direction: column; align-items: center; gap: 4px; z-index: 999;
      opacity: 0; transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    toast.innerHTML = `
      <span style="font-size:24px;">🏆 Başarım Açıldı!</span>
      <strong style="color:var(--color-primary); font-size:16px;">${badge.name}</strong>
      <span style="font-size:12px; color:var(--color-text-muted);">${badge.desc}</span>
    `;
    document.body.appendChild(toast);
    
    // animate in
    setTimeout(() => {
      toast.style.transform = "translateX(-50%) translateY(0)";
      toast.style.opacity = "1";
    }, 100);
    
    // animate out
    setTimeout(() => {
      toast.style.transform = "translateX(-50%) translateY(100px)";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 600);
    }, 4500);
  }
};

const MISTAKES = {
  get() {
    try {
      return JSON.parse(localStorage.getItem("hangman_mistakes")) || [];
    } catch(e) {
      return [];
    }
  },
  add(word, hint, gradeName, subjectName, subjectId) {
    const list = this.get();
    const isDup = list.some(item => item.word.toLowerCase() === word.toLowerCase());
    if (!isDup) {
      list.push({ word, hint, gradeName, subjectName, subjectId });
      localStorage.setItem("hangman_mistakes", JSON.stringify(list));
    }
  },
  remove(word) {
    let list = this.get();
    list = list.filter(item => item.word.toLowerCase() !== word.toLowerCase());
    localStorage.setItem("hangman_mistakes", JSON.stringify(list));
  }
};

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
let MAX_WRONG = 6;

// Zorluğa göre can hesabı
function getLivesLimit(difficulty) {
  if (difficulty === "easy") return 8;
  if (difficulty === "hard") return 4;
  return 6; // medium
}

// Zorluğa göre asılan adam uzuvlarının animasyonlu görünümü
function getBodyPartsForAttempt(wrongCount, maxWrong) {
  const partsToReveal = [];
  if (maxWrong === 6) {
    for (let i = 0; i < wrongCount; i++) {
      if (BODY_PARTS[i]) partsToReveal.push(BODY_PARTS[i]);
    }
  } else if (maxWrong === 4) {
    if (wrongCount >= 1) partsToReveal.push("h-head");
    if (wrongCount >= 2) partsToReveal.push("h-body");
    if (wrongCount >= 3) { partsToReveal.push("h-arm-l"); partsToReveal.push("h-arm-r"); }
    if (wrongCount >= 4) { partsToReveal.push("h-leg-l"); partsToReveal.push("h-leg-r"); }
  } else if (maxWrong === 8) {
    const standardIndex = wrongCount - 2;
    for (let i = 0; i < standardIndex; i++) {
      if (BODY_PARTS[i]) partsToReveal.push(BODY_PARTS[i]);
    }
  }
  return partsToReveal;
}

// ── INIT & FETCH ────────────────────────────────────────────────────────────
async function init() {
  buildKeyboard();
  setupSettingsAndModals();
  await loadCurriculum();
  
  document.getElementById('back-to-grades').addEventListener('click', showGradeScreen);
  
  const backToSubBtn = document.getElementById('back-to-subjects');
  if(backToSubBtn) {
     backToSubBtn.addEventListener('click', showGradeScreen);
  }
  
  if(CURRICULUM_DATA && CURRICULUM_DATA.length > 0) {
    populateGrades();
    await startRandomGame();
    startBackgroundPrefetch();
  } else {
    document.getElementById('grade-list').innerHTML = '<p>Müfredat yüklenemedi. Lütfen internet bağlantınızı kontrol edin.</p>';
  }
}

function setupSettingsAndModals() {
  // Logo tıkladığında sınıf seçimine git
  const logoBtn = document.getElementById("logo-home-btn");
  if (logoBtn) {
    logoBtn.addEventListener("click", () => {
      showGradeScreen();
    });
  }

  // Hamburger menü
  const menuBtn = document.getElementById("nav-menu-btn");
  const dropdown = document.getElementById("nav-dropdown");
  const backdrop = document.getElementById("nav-backdrop");
  if (menuBtn && dropdown) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display !== "none";
      dropdown.style.display = isOpen ? "none" : "block";
      backdrop.style.display = isOpen ? "none" : "block";
    });
    backdrop.addEventListener("click", () => {
      dropdown.style.display = "none";
      backdrop.style.display = "none";
    });
  }

  // Nav menü içindeki butonlar (modal açınca dropdown kapansın)
  function navMenuAction(fn) {
    return () => {
      if (dropdown) dropdown.style.display = "none";
      if (backdrop) backdrop.style.display = "none";
      fn();
    };
  }

  // Zorluk seçici
  const diffSelect = document.getElementById("difficulty-select");
  if (diffSelect) {
    diffSelect.value = currentDifficulty;
    diffSelect.addEventListener("change", (e) => {
      currentDifficulty = e.target.value;
      localStorage.setItem("adamAsmacaDiff", currentDifficulty);
      newGame();
    });
  }

  // Süreli Mod - active sınıfı ile toggle
  const timeBtn = document.getElementById("time-mode-btn");
  if (timeBtn) {
    timeBtn.textContent = timeModeActive ? "⏱️ Süreli: Açık" : "⏱️ Süreli: Kapalı";
    if (timeModeActive) timeBtn.classList.add("active");
    timeBtn.addEventListener("click", () => {
      timeModeActive = !timeModeActive;
      localStorage.setItem("adamAsmacaTimeMode", timeModeActive ? "true" : "false");
      timeBtn.textContent = timeModeActive ? "⏱️ Süreli: Açık" : "⏱️ Süreli: Kapalı";
      timeBtn.classList.toggle("active", timeModeActive);
      newGame();
    });
  }

  // Jokerler
  document.getElementById("joker-reveal-btn").addEventListener("click", useRevealJoker);
  document.getElementById("joker-eliminate-btn").addEventListener("click", useEliminateJoker);

  // Navigasyon Modalları
  document.getElementById("nav-stats-btn").addEventListener("click", navMenuAction(openStatsModal));
  document.getElementById("close-stats-btn").addEventListener("click", () => closeOverlay("stats-overlay"));

  document.getElementById("nav-badges-btn").addEventListener("click", navMenuAction(openBadgesModal));
  document.getElementById("close-badges-btn").addEventListener("click", () => closeOverlay("badges-overlay"));

  document.getElementById("nav-mistakes-btn").addEventListener("click", navMenuAction(openMistakesModal));
  document.getElementById("close-mistakes-btn").addEventListener("click", () => closeOverlay("mistakes-overlay"));
  document.getElementById("start-mistakes-btn").addEventListener("click", startReviewMode);

  // Klavye ayar butonu popup
  const kbSettingsBtn = document.getElementById("keyboard-settings-btn");
  const kbPopup = document.getElementById("kb-popup");
  const kbPopupClose = document.getElementById("kb-popup-close");
  const kbOptionsList = document.getElementById("keyboard-options-list");

  if (kbSettingsBtn && kbPopup && kbOptionsList) {
    kbSettingsBtn.addEventListener("click", () => {
      kbOptionsList.querySelectorAll(".kb-option-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.value === currentKeyboard);
      });
      kbPopup.style.display = "flex";
    });
    kbPopupClose.addEventListener("click", () => {
      kbPopup.style.display = "none";
    });
    kbPopup.addEventListener("click", (e) => {
      if (e.target === kbPopup) kbPopup.style.display = "none";
    });
    kbOptionsList.querySelectorAll(".kb-option-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        currentKeyboard = btn.dataset.value;
        localStorage.setItem("adamAsmacaKb", currentKeyboard);
        buildKeyboard();
        updateKeys();
        
        kbOptionsList.querySelectorAll(".kb-option-btn").forEach(b => {
          b.classList.toggle("active", b.dataset.value === currentKeyboard);
        });
        
        setTimeout(() => {
          kbPopup.style.display = "none";
        }, 150);
      });
    });
  }

  // Hata Bildir butonu (Menü)
  const navReportBtn = document.getElementById("nav-report-btn");
  if (navReportBtn) {
    navReportBtn.addEventListener("click", navMenuAction(() => {
      openReportModal();
    }));
  }

  // Hata Bildir Overlay kontrolleri
  const closeReportBtn = document.getElementById("close-report-btn");
  if (closeReportBtn) {
    closeReportBtn.addEventListener("click", () => closeOverlay("report-overlay"));
  }
  const sendReportBtn = document.getElementById("send-report-btn");
  if (sendReportBtn) {
    sendReportBtn.addEventListener("click", sendReport);
  }

  // Ses aç/kapat butonu - menüün yanına ekle
  const headerRight = document.querySelector(".header-right");
  if (headerRight) {
    const soundBtn = document.createElement("button");
    soundBtn.className = "theme-toggle";
    soundBtn.title = "Sesi Kapat/Aç";
    soundBtn.style.cssText = "font-size:16px;";
    soundBtn.innerHTML = SOUNDS.muted ? "🔇" : "🔊";
    soundBtn.addEventListener("click", () => {
      SOUNDS.muted = !SOUNDS.muted;
      localStorage.setItem("adamAsmacaMuted", SOUNDS.muted ? "true" : "false");
      soundBtn.innerHTML = SOUNDS.muted ? "🔇" : "🔊";
    });
    // menü butonunun öncesine ekle
    const menuBtnEl = document.getElementById("nav-menu-btn");
    headerRight.insertBefore(soundBtn, menuBtnEl);
  }
}

// ── TIMERS ─────────────────────────────────────────────────────────────────
function startTimer() {
  clearInterval(timerInterval);
  const timerBadge = document.getElementById("timer-badge");
  const timerVal = document.getElementById("timer-val");
  
  if (!timeModeActive) {
    timerBadge.style.display = "none";
    return;
  }
  
  timeLeft = 60;
  timerBadge.style.display = "flex";
  timerBadge.classList.remove("danger");
  timerVal.textContent = timeLeft;
  
  timerInterval = setInterval(() => {
    timeLeft--;
    timerVal.textContent = timeLeft;
    
    if (timeLeft <= 10) {
      timerBadge.classList.add("danger");
      SOUNDS.tick();
    }
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      handleTimeout();
    }
  }, 1000);
}

function handleTimeout() {
  if (gameState.over) return;
  
  // Can azalt
  gameState.wrong.push("SÜRE");
  gameState.score = Math.max(0, gameState.score - 2);
  saveScore();
  SOUNDS.wrong();
  
  // Shake animasyonu ekle
  const gameCard = document.getElementById("game-card");
  gameCard.classList.add("shake");
  setTimeout(() => gameCard.classList.remove("shake"), 350);

  if (gameState.wrong.length >= MAX_WRONG) {
    gameState.over = true;
    gameState.won = false;
    updateUI();
    setTimeout(() => showEndOverlay(), 700);
  } else {
    updateUI();
    startTimer(); // Sonraki harf/süre döngüsünü başlat
  }
}

// ── MODALS INTEGRATION ─────────────────────────────────────────────────────
function openOverlay(id) {
  document.getElementById(id).style.display = "flex";
}
function closeOverlay(id) {
  document.getElementById(id).style.display = "none";
}

function openReportModal(wordOverride, hintOverride) {
  const currentWordVal = wordOverride || (gameState && gameState.word) || "-";
  const gradeLabel = selectedGrade ? selectedGrade.gradeName : "-";
  const subjectLabel = selectedSubject ? selectedSubject.name : "-";
  const unitLabel = selectedUnit ? selectedUnit.name : "-";
  
  document.getElementById("report-subject").textContent = `${gradeLabel}. Sınıf - ${subjectLabel}`;
  document.getElementById("report-unit").textContent = unitLabel;
  document.getElementById("report-word").textContent = currentWordVal;
  document.getElementById("report-desc").value = "";
  
  openOverlay("report-overlay");
}

function sendReport() {
  const gradeLabel = selectedGrade ? selectedGrade.gradeName : "-";
  const subjectLabel = selectedSubject ? selectedSubject.name : "-";
  const unitLabel = selectedUnit ? selectedUnit.name : "-";
  const currentWordVal = document.getElementById("report-word").textContent;
  const desc = document.getElementById("report-desc").value.trim();
  
  if (!desc) {
    alert("Lütfen hata açıklamasını yazın.");
    return;
  }
  
  const reportText = `Adam Asmaca Hata Bildirimi:\nSınıf: ${gradeLabel}. Sınıf\nDers: ${subjectLabel}\nÜnite: ${unitLabel}\nKelime: ${currentWordVal}\nHata Açıklaması: ${desc}`;
  
  closeOverlay("report-overlay");
  
  if (navigator.share) {
    navigator.share({
      title: 'Adam Asmaca Hata Bildirimi',
      text: reportText
    }).catch(() => {
      openMailFallback(reportText, currentWordVal);
    });
  } else {
    navigator.clipboard.writeText(reportText).then(() => {
      alert("Hata açıklaması panoya kopyalandı! Açılacak e-postaya yapıştırıp gönderebilirsiniz.");
      openMailFallback(reportText, currentWordVal);
    }).catch(() => {
      openMailFallback(reportText, currentWordVal);
    });
  }
}

function openMailFallback(text, word) {
  const email = "destek@example.com";
  const subject = encodeURIComponent(`Adam Asmaca Hata Bildirimi (${word})`);
  const body = encodeURIComponent(text);
  window.open(`mailto:${email}?subject=${subject}&body=${body}`);
}

function openStatsModal() {
  const stats = STATS.get();
  document.getElementById("stats-total").textContent = stats.totalGames;
  document.getElementById("stats-won").textContent = stats.gamesWon;
  
  const winRate = stats.totalGames > 0 ? Math.round((stats.gamesWon / stats.totalGames) * 100) : 0;
  document.getElementById("stats-winrate").textContent = winRate + "%";
  document.getElementById("stats-streak").textContent = stats.longestStreak;
  
  // Grafik bar üretimi
  const chart = document.getElementById("stats-chart");
  chart.innerHTML = "";
  
  const keys = Object.keys(stats.subjectScores);
  if (keys.length === 0) {
    chart.innerHTML = `<p style="text-align:center; color:var(--color-text-faint); margin-top:12px;">Henüz yeterli oyun verisi yok.</p>`;
  } else {
    keys.forEach(k => {
      const subject = stats.subjectScores[k];
      const rate = Math.round((subject.won / subject.played) * 100);
      
      const barWrapper = document.createElement("div");
      barWrapper.className = "stats-bar-wrapper";
      barWrapper.innerHTML = `
        <div class="stats-bar-label">${subject.name} (${subject.played} Oyun)</div>
        <div class="stats-bar-bg">
          <div class="stats-bar-fill" style="width: ${rate}%; background-color: var(--color-success);"></div>
          <span class="stats-bar-pct">%${rate}</span>
        </div>
      `;
      chart.appendChild(barWrapper);
    });
  }
  
  openOverlay("stats-overlay");
}

const BADGE_ICONS = {
  first_win: "🏅",
  streak_3: "🔥",
  streak_5: "⚡",
  perfect_win: "⭐",
  hard_win: "💪",
  time_survivor: "⏳",
  mistake_clear: "📘"
};

const BADGE_LEVELS = [
  { threshold: 1,  label: "Bronz",  color: "#cd7f32" },
  { threshold: 3,  label: "Gümüş",  color: "#a0a0b0" },
  { threshold: 5,  label: "Altın",   color: "#ffd700" },
  { threshold: 10, label: "Elmas",   color: "#7ed6f7" }
];

function getBadgeLevel(badgeId) {
  try {
    const counts = JSON.parse(localStorage.getItem("hangman_badge_counts")) || {};
    const count = counts[badgeId] || 0;
    let level = null;
    for (const lvl of BADGE_LEVELS) {
      if (count >= lvl.threshold) level = lvl;
    }
    return { count, level };
  } catch(e) { return { count: 0, level: null }; }
}

function incrementBadgeCount(badgeId) {
  try {
    const counts = JSON.parse(localStorage.getItem("hangman_badge_counts")) || {};
    counts[badgeId] = (counts[badgeId] || 0) + 1;
    localStorage.setItem("hangman_badge_counts", JSON.stringify(counts));
  } catch(e) {}
}

function showBadgeDetail(badge, isUnlocked) {
  // Mevcut detay modalını temizle
  const existing = document.getElementById("badge-detail-modal");
  if (existing) existing.remove();
  
  const { count, level } = getBadgeLevel(badge.id);
  const icon = BADGE_ICONS[badge.id] || "🏅";
  
  const modal = document.createElement("div");
  modal.id = "badge-detail-modal";
  modal.style.cssText = `
    position:fixed; inset:0; z-index:10000; display:flex;
    align-items:center; justify-content:center;
    background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);
  `;
  
  let levelHtml = "";
  if (isUnlocked) {
    levelHtml = BADGE_LEVELS.map(lvl => {
      const achieved = count >= lvl.threshold;
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--color-border);">
        <span style="font-size:20px;opacity:${achieved?1:0.3}">${achieved ? "✅" : "⭕"}</span>
        <span style="font-weight:${achieved?700:400};color:${achieved?lvl.color:"var(--color-text-muted)"}">${lvl.label}</span>
        <span style="margin-left:auto;font-size:12px;color:var(--color-text-muted)">${lvl.threshold}× gerekli</span>
      </div>`;
    }).join("");
  }
  
  const currentLevelLabel = level ? `<span style="color:${level.color};font-weight:700">${level.label} Seviye</span>` : isUnlocked ? "<span>Başlangıç</span>" : "<span style='color:var(--color-text-muted)'>Kilitli 🔒</span>";
  
  modal.innerHTML = `
    <div style="
      background:var(--color-surface); border-radius:var(--radius-xl);
      padding:28px; max-width:340px; width:90%; box-shadow:var(--shadow-xl);
      display:flex; flex-direction:column; align-items:center; gap:12px;
      border:2px solid var(--color-border);
    ">
      <span style="font-size:56px;">${icon}</span>
      <h3 style="font-family:var(--font-display);font-size:20px;margin:0;text-align:center;">${badge.name}</h3>
      <p style="font-size:13px;color:var(--color-text-muted);text-align:center;margin:0;">${badge.desc}</p>
      <div style="font-size:14px;margin:4px 0;">${currentLevelLabel} ${isUnlocked ? `· ${count}× kazanıldı` : ""}</div>
      ${isUnlocked ? `<div style="width:100%;">${levelHtml}</div>` : `<p style="font-size:12px;color:var(--color-text-muted);text-align:center;">Bu rozeti kazanmak için oyuna devam et!</p>`}
      <button class="btn-primary" style="width:100%;margin-top:8px;" id="badge-detail-close">Kapat</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.querySelector("#badge-detail-close").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

function openBadgesModal() {
  const unlocked = BADGES.getUnlocked();
  const grid = document.getElementById("badges-grid");
  grid.innerHTML = "";
  
  BADGES.list.forEach(badge => {
    const isUnlocked = unlocked.includes(badge.id);
    const { level } = getBadgeLevel(badge.id);
    const icon = BADGE_ICONS[badge.id] || "🏅";
    const card = document.createElement("div");
    card.className = "badge-card" + (isUnlocked ? "" : " locked");
    card.style.cursor = "pointer";
    card.title = isUnlocked ? "Detayları gör" : "Henüz kazanılmadı";
    
    const levelBadge = level ? `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:99px;background:${level.color}20;color:${level.color};border:1px solid ${level.color};margin-top:2px;display:inline-block;">${level.label}</span>` : "";
    
    card.innerHTML = `
      <span class="badge-icon">${icon}</span>
      <span class="badge-name">${badge.name}</span>
      <span class="badge-desc">${badge.desc}</span>
      ${levelBadge}
    `;
    card.addEventListener("click", () => showBadgeDetail(badge, isUnlocked));
    grid.appendChild(card);
  });
  
  openOverlay("badges-overlay");
}

function openMistakesModal() {
  const mistakes = MISTAKES.get();
  const subText = document.getElementById("mistakes-count-sub");
  const container = document.getElementById("mistakes-list");
  const startBtn = document.getElementById("start-mistakes-btn");
  
  container.innerHTML = "";
  
  if (mistakes.length === 0) {
    subText.textContent = "Henüz yanlış bildiğin bir kelime yok. Harikasın!";
    startBtn.style.display = "none";
  } else {
    subText.textContent = `${mistakes.length} hatalı kelimen var. Tekrar ederek pekiştir!`;
    startBtn.style.display = "inline-block";
    
    mistakes.forEach(item => {
      const card = document.createElement("div");
      card.className = "mistake-item";
      card.innerHTML = `
        <div class="mistake-info">
          <span class="mistake-word">${item.word}</span>
          <span class="mistake-hint">İpucu: ${item.hint}</span>
          <span class="mistake-meta">${item.gradeName} - ${item.subjectName}</span>
        </div>
        <span class="mistake-del-btn" title="Listeden Kaldır">🗑️</span>
      `;
      card.querySelector(".mistake-del-btn").addEventListener("click", () => {
        MISTAKES.remove(item.word);
        openMistakesModal(); // Yenile
      });
      container.appendChild(card);
    });
  }
  
  openOverlay("mistakes-overlay");
}

function startReviewMode() {
  const mistakes = MISTAKES.get();
  if (mistakes.length === 0) return;
  
  closeOverlay("mistakes-overlay");
  
  isReviewMode = true;
  selectedGrade = { grade: 99, gradeName: "Hata Defteri" };
  applyGradeTheme(99);
  selectedSubject = { id: mistakes[0].subjectId, name: "Tekrar Modu", dataFile: "" };
  selectedUnit = { name: "Yanlış Kelimeler", words: mistakes };
  
  WORD_BANK = mistakes;
  availableWords = [...WORD_BANK];
  
  newGame();
  showGameScreen();
}

// ── JOKER LOGIC ────────────────────────────────────────────────────────────
function updateJokerUI() {
  const status = document.getElementById("joker-status");
  status.textContent = `Joker: ${jokersLeft}/3`;
  
  const revealBtn = document.getElementById("joker-reveal-btn");
  const eliminateBtn = document.getElementById("joker-eliminate-btn");
  
  if (jokersLeft <= 0 || gameState.over) {
    revealBtn.disabled = true;
    eliminateBtn.disabled = true;
  } else {
    revealBtn.disabled = gameState.score < 5;
    eliminateBtn.disabled = gameState.score < 3;
  }
}

function useRevealJoker() {
  if (jokersLeft <= 0 || gameState.score < 5 || gameState.over) return;
  
  // Kelimede henüz tahmin edilmemiş harfler
  const unguessed = [...gameState.word].filter(char => {
    const isLetter = /[A-ZÇĞİÖŞÜ]/.test(char);
    return isLetter && !gameState.guessed.has(char);
  });
  
  if (unguessed.length > 0) {
    jokersLeft--;
    gameState.score -= 5;
    saveScore();
    
    // Rastgele bir harf aç
    const targetChar = unguessed[Math.floor(Math.random() * unguessed.length)];
    guess(targetChar);
  }
}

function useEliminateJoker() {
  if (jokersLeft <= 0 || gameState.score < 3 || gameState.over) return;
  
  // Klavyeden kelimede olmayan ve tahmin edilmemiş harfler
  const isEnglish = selectedSubject && selectedSubject.id === "ingilizce";
  const allAlphabet = isEnglish 
    ? ["Q","W","E","R","T","Y","U","I","O","P","A","S","D","F","G","H","J","K","L","Z","X","C","V","B","N","M"]
    : ["A","B","C","Ç","D","E","F","G","Ğ","H","I","İ","J","K","L","M","N","O","Ö","P","R","S","Ş","T","U","Ü","V","Y","Z","Q","W","X"];
  
  const wrongUnguessed = allAlphabet.filter(char => {
    return !gameState.word.includes(char) && !gameState.guessed.has(char);
  });
  
  if (wrongUnguessed.length >= 2) {
    jokersLeft--;
    gameState.score -= 3;
    saveScore();
    
    // 2 adet yanlış harfi SADECE guessed listesine ekle (wrong listesine DEĞİL)
    // Bu şekilde klavyede devre dışı kalır ama adam figürü ilerlemez
    const eliminated = [];
    for (let i = 0; i < 2; i++) {
      const idx = Math.floor(Math.random() * wrongUnguessed.length);
      const targetChar = wrongUnguessed.splice(idx, 1)[0];
      gameState.guessed.add(targetChar);
      eliminated.push(targetChar);
    }
    
    // Kısa görsel geri bildirim: iptal edilen harfler için toast
    const toast = document.createElement("div");
    toast.style.cssText = `
      position:fixed; bottom:90px; left:50%; transform:translateX(-50%) translateY(30px);
      background:var(--color-surface); border:2px solid var(--color-warning,#f0a500);
      padding:10px 20px; border-radius:var(--radius-lg); z-index:9999;
      font-weight:600; color:var(--color-primary); opacity:0;
      transition:all 0.3s ease;
    `;
    toast.textContent = `❌ ${eliminated.join(", ")} harfleri elendi!`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity="1"; toast.style.transform="translateX(-50%) translateY(0)"; }, 50);
    setTimeout(() => { toast.style.opacity="0"; setTimeout(() => toast.remove(), 400); }, 2000);
    
    SOUNDS.correct();
    updateUI();
  }
}

// ── PREFETCH ────────────────────────────────────────────────────────────
function startBackgroundPrefetch() {
  if(!CURRICULUM_DATA) return;
  const allUrls = [];
  CURRICULUM_DATA.forEach(g => g.subjects.forEach(s => {
    if (s.dataFile) allUrls.push(s.dataFile);
  }));
  
  let i = 0;
  function fetchNext() {
    if(i >= allUrls.length) return;
    const url = allUrls[i++];
    if(!PREFETCHED_DATA[url]) {
       fetch(url + "?t=" + Date.now()).then(r=>r.json()).then(d=>{
          PREFETCHED_DATA[url] = d;
          setTimeout(fetchNext, 1500);
       }).catch(() => setTimeout(fetchNext, 1500));
    } else {
       fetchNext();
    }
  }
  setTimeout(fetchNext, 3000);
}

async function startRandomGame() {
  let attempts = 0;
  const maxAttempts = 20;

  while(attempts < maxAttempts) {
    attempts++;
    const rGrade = CURRICULUM_DATA[Math.floor(Math.random() * CURRICULUM_DATA.length)];
    if (!rGrade.subjects || rGrade.subjects.length === 0) continue;
    
    const rSubj = rGrade.subjects[Math.floor(Math.random() * rGrade.subjects.length)];
    if (!rSubj.dataFile) continue;
    
    try {
      let data;
      if (PREFETCHED_DATA[rSubj.dataFile]) {
        data = PREFETCHED_DATA[rSubj.dataFile];
      } else {
        const res = await fetch(rSubj.dataFile + "?t=" + Date.now());
        if(!res.ok) continue;
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
        return;
      }
    } catch (err) {}
  }
  
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
  isReviewMode = false;
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
  
  const currentMonth = new Date().getMonth() + 1;
  
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
    unitList.style.display = 'none';
    card.appendChild(unitList);
    
    header.addEventListener('click', async () => {
      if (unitList.style.display === 'flex') {
         unitList.style.display = 'none';
         header.textContent = subject.name + " ▼";
         return;
      }
      
      header.textContent = subject.name + " ▲";
      
      if (unitList.innerHTML !== '') {
         unitList.style.display = 'flex';
         return;
      }
      
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
    if(row[0] === "space" && row.length === 1) return;
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
    alert("Kelimeler yüklenemedi. Lütfen başka bir ders/sınıf seçin.");
    showSubjectScreen();
    return;
  }
  
  buildKeyboard();
  MAX_WRONG = getLivesLimit(currentDifficulty);
  jokersLeft = 3;
  
  if(availableWords.length === 0) {
    // Ünite bitti — tamamlama ekranını göster (newGame başlamadan önce)
    // Ancak sadece önceki oyun bitmiş ise (ilk başlatma değilse) göster
    if (gameState.word && !gameState.over) {
      // Henüz oyun oynanmamış, direkt başlat
    } else if (gameState.word) {
      showUnitCompleteOverlay();
      return;
    }
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
    rawWord: entry.word,
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
  startTimer();
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
    gameState.score = Math.max(0, gameState.score - 2);
    saveScore();
    SOUNDS.wrong();
    
    // Can barına/karta sarsıntı
    const gameCard = document.getElementById("game-card");
    gameCard.classList.add("shake");
    setTimeout(() => gameCard.classList.remove("shake"), 350);

    if (gameState.wrong.length >= MAX_WRONG) { 
      clearInterval(timerInterval);
      gameState.over = true; 
      gameState.won = false; 
      streakCount = 0;
      MISTAKES.add(gameState.rawWord, gameState.hint, selectedGrade.gradeName, selectedSubject.name, selectedSubject.id);
      SOUNDS.lose();
    }
  } else {
    SOUNDS.correct();
  }

  // kazanma kontrolü
  const letters = [...gameState.word].filter(c => isEnglish ? /[A-Z]/.test(c) : /[A-ZÇĞİÖŞÜ]/.test(c));
  const allFound = letters.length > 0 && letters.every(c => gameState.guessed.has(c));
  if (allFound) { 
    clearInterval(timerInterval);
    gameState.over = true; 
    gameState.won = true; 
    
    streakCount++;
    
    // Seri bonusu çarpanı
    let multiplier = 1.0;
    if (streakCount >= 3 && streakCount < 5) multiplier = 1.5;
    else if (streakCount >= 5) multiplier = 2.0;
    
    const scoreGain = Math.floor(10 * multiplier);
    gameState.score += scoreGain;
    saveScore();
    
    STATS.recordGame(true, streakCount, selectedSubject.id, selectedSubject.name);
    
    if (isReviewMode) {
      MISTAKES.remove(gameState.rawWord);
    }
    SOUNDS.win();
  } else if (!inWord && gameState.wrong.length >= MAX_WRONG) {
    STATS.recordGame(false, streakCount, selectedSubject.id, selectedSubject.name);
  }

  updateUI();
  if (gameState.over) setTimeout(() => showEndOverlay(), 700);
}

// ── UPDATE UI ────────────────────────────────────────────────────────────────
function updateUI() {
  document.getElementById("category-badge").textContent = gameState.category;
  document.getElementById("hint-text").textContent = "İpucu: " + gameState.hint;
  document.getElementById("score-val").textContent = gameState.score;
  
  // Streak / Seri
  const streakBadge = document.getElementById("streak-badge");
  const streakVal = document.getElementById("streak-val");
  if (streakCount > 1) {
    streakBadge.style.display = "inline-flex";
    streakVal.textContent = streakCount;
  } else {
    streakBadge.style.display = "none";
  }

  // Progress Bar
  const totalWords = WORD_BANK.length;
  const solvedWords = totalWords - availableWords.length;
  const progressPercent = totalWords > 0 ? (solvedWords / totalWords) * 100 : 0;
  document.getElementById("progress-bar-fill").style.width = `${progressPercent}%`;
  document.getElementById("progress-text").textContent = `Kelime: ${solvedWords}/${totalWords}`;

  updateWordDisplay();
  updateHangman();
  updateWrong();
  updateKeys();
  updateLives();
  updateJokerUI();
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
  // Görünür olan parçalara sallantılı animasyonu ekle
  const revealedParts = getBodyPartsForAttempt(gameState.wrong.length, MAX_WRONG);
  
  BODY_PARTS.forEach(id => {
    const el = document.getElementById(id);
    const shouldShow = revealedParts.includes(id);
    
    if (shouldShow) {
      if (el.style.opacity !== "1") {
        el.style.opacity = "1";
        el.classList.add("animate-drop");
      }
    } else {
      el.style.opacity = "0";
      el.classList.remove("animate-drop");
    }
  });
}

// Devamı...
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

// ── ÜNİTE TAMAMLAMA EKRANI ──────────────────────────────────────────────────────────────────────
function showUnitCompleteOverlay() {
  // Ünite istatistiklerini hesapla
  const stats = STATS.get();
  const subjectData = selectedSubject ? stats.subjectScores[selectedSubject.id] : null;
  const totalPlayed = subjectData ? subjectData.played : 0;
  const totalWon = subjectData ? subjectData.won : 0;
  const winRate = totalPlayed > 0 ? Math.round((totalWon / totalPlayed) * 100) : 0;
  
  document.querySelectorAll(".overlay").forEach(e => {
    if (e.id !== "stats-overlay" && e.id !== "badges-overlay" && e.id !== "mistakes-overlay") e.remove();
  });

  const ov = document.createElement("div"); ov.className = "overlay";
  ov.style.cssText = "position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);";
  
  const card = document.createElement("div"); card.className = "overlay-card";
  card.style.cssText = `
    max-width:380px; width:92%; padding:32px 28px;
    animation: popIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both;
  `;
  
  // Ünite adı
  const unitName = selectedUnit ? selectedUnit.name : "";
  const subjectName = selectedSubject ? selectedSubject.name : "";
  
  // Confetti fırlat
  triggerGradeConfetti();
  SOUNDS.win();
  
  card.innerHTML = `
    <span class="overlay-icon" style="font-size:52px">🎓</span>
    <h2 class="overlay-title" style="font-size:22px;margin:12px 0 4px;">Üniteyi Tamamladın!</h2>
    <p class="overlay-sub" style="margin-bottom:16px;">${subjectName} &rsaquo; ${unitName}</p>
    
    <div style="
      background:var(--color-surface-offset); border-radius:var(--radius-lg);
      padding:16px; margin-bottom:16px; width:100%;
      display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; text-align:center;
    ">
      <div>
        <div style="font-size:28px;font-weight:800;color:var(--color-primary);">${gameState.score}</div>
        <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;">Toplam Puan</div>
      </div>
      <div>
        <div style="font-size:28px;font-weight:800;color:var(--color-success,#22c55e);">${totalWon}</div>
        <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;">Doğru</div>
      </div>
      <div>
        <div style="font-size:28px;font-weight:800;color:var(--color-error,#ef4444);">${totalPlayed - totalWon}</div>
        <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;">Yanlış</div>
      </div>
    </div>
    
    <div style="width:100%;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--color-text-muted);margin-bottom:4px;">
        <span>Başarı Oranı</span>
        <span>%${winRate}</span>
      </div>
      <div style="background:var(--color-border);border-radius:99px;height:8px;overflow:hidden;">
        <div style="width:${winRate}%;height:100%;background:var(--color-primary);border-radius:99px;transition:width 0.8s ease;"></div>
      </div>
    </div>
    
    <div style="display:flex;flex-direction:column;gap:8px;width:100%;">
      <button class="btn-primary" id="unit-next-btn" style="width:100%;">Sonraki Ünite →</button>
      <button class="btn-secondary" id="unit-replay-btn" style="width:100%;margin-top:0;">Bu Üniteyi Tekrarla 🔄</button>
      <button class="btn-secondary" id="unit-back-btn" style="width:100%;margin-top:0;">Ders Seçimine Dön</button>
    </div>
  `;
  
  ov.appendChild(card);
  document.body.appendChild(ov);
  
  // Sonraki Ünite butonu
  document.getElementById("unit-next-btn").addEventListener("click", () => {
    ov.remove();
    // Aynı derste bir sonraki Üniteyi bul ve başlat
    if (selectedSubject && selectedUnit) {
      const cachedData = PREFETCHED_DATA[selectedSubject.dataFile];
      if (cachedData && cachedData.units) {
        const units = cachedData.units;
        const currentIdx = units.findIndex(u => u.name === selectedUnit.name);
        if (currentIdx >= 0 && currentIdx + 1 < units.length) {
          const nextUnit = units[currentIdx + 1];
          selectedUnit = nextUnit;
          WORD_BANK = nextUnit.words;
          availableWords = [...WORD_BANK];
          newGame();
          return;
        }
      }
    }
    // Sonraki ünite bulunamazsa ders seçimine dön
    showSubjectScreen();
  });
  
  document.getElementById("unit-replay-btn").addEventListener("click", () => {
    ov.remove();
    availableWords = [...WORD_BANK];
    newGame();
  });
  
  document.getElementById("unit-back-btn").addEventListener("click", () => {
    ov.remove();
    showSubjectScreen();
  });
}

// ── END OVERLAY & FLASHCARD ──────────────────────────────────────────────────
function showEndOverlay() {
  document.querySelectorAll(".overlay").forEach(e => {
    if (e.id !== "stats-overlay" && e.id !== "badges-overlay" && e.id !== "mistakes-overlay") e.remove();
  });

  const ov = document.createElement("div"); ov.className = "overlay";
  const card = document.createElement("div"); card.className = "overlay-card";
  card.style.perspective = "1000px";

  const icon = document.createElement("span"); icon.className = "overlay-icon";
  const title = document.createElement("h2"); title.className = "overlay-title";
  const sub = document.createElement("p"); sub.className = "overlay-sub";
  
  // Flashcard / Kelime Kartı
  const wordCard = document.createElement("div");
  wordCard.style.cssText = `
    background: var(--color-surface-offset); border: 2px solid var(--color-border);
    border-radius: var(--radius-lg); padding: 16px; margin: 16px 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    box-shadow: var(--shadow-sm); transition: transform 0.6s;
  `;
  
  const wordLabel = document.createElement("strong");
  wordLabel.style.cssText = "font-size:24px; font-family:var(--font-display); color:var(--color-primary);";
  wordLabel.textContent = gameState.word;
  
  const hintLabel = document.createElement("p");
  hintLabel.style.cssText = "font-size:12px; color:var(--color-text-muted); margin-top:8px; font-style:italic;";
  hintLabel.textContent = `Açıklama / İpucu: ${gameState.hint}`;
  
  wordCard.append(wordLabel, hintLabel);

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex; flex-direction:column; gap:8px; width:100%; align-items:center;";

  const btnPrimary = document.createElement("button"); btnPrimary.className = "btn-primary";
  btnPrimary.style.width = "100%";
  const btnShare = document.createElement("button"); btnShare.className = "btn-secondary";
  btnShare.style.width = "100%"; btnShare.style.marginTop = "0";
  const btnBack = document.createElement("button"); btnBack.className = "btn-secondary";
  btnBack.style.width = "100%"; btnBack.style.marginTop = "0";
  const btnReport = document.createElement("button"); btnReport.className = "btn-secondary";
  btnReport.style.width = "100%"; btnReport.style.marginTop = "0";
  btnReport.style.borderColor = "rgba(239, 68, 68, 0.4)";
  btnReport.style.color = "var(--color-error)";
  btnReport.textContent = "⚠️ Hata Bildir";

  if (gameState.won) {
    const netGain = gameState.score - gameState.startingScore;
    icon.textContent = "🎉"; title.textContent = "Tebrikler!";
    
    let multiplierText = "";
    if (streakCount >= 3) {
      const mult = streakCount >= 5 ? "2.0x" : "1.5x";
      multiplierText = ` (${mult} Seri Bonusu)`;
    }
    
    sub.textContent = `+${netGain} puan kazandın!${multiplierText} Toplam: ${gameState.score}`;
    btnPrimary.textContent = "Sıradaki Kelime →";
    triggerGradeConfetti();
  } else {
    icon.textContent = "💀"; title.textContent = "Eyvah, Astın!";
    sub.textContent = `Kelimeyi bulamadın. Toplam Puan: ${gameState.score}`;
    btnPrimary.textContent = "Tekrar Dene";
  }
  
  btnShare.textContent = "Skorunu Paylaş 🔗";
  btnBack.textContent = "Ders Seçimine Dön";
  
  btnPrimary.addEventListener("click", () => {
    ov.remove();
    newGame();
  });
  
  btnShare.addEventListener("click", () => {
    copyShareLink(btnShare);
  });

  btnReport.addEventListener("click", () => {
    openReportModal();
  });
  
  btnBack.addEventListener("click", () => {
    ov.remove();
    showSubjectScreen();
  });

  btnRow.append(btnPrimary, btnShare, btnReport, btnBack);
  card.append(icon, title, sub, wordCard, btnRow);
  ov.appendChild(card);
  document.body.appendChild(ov);
}

function copyShareLink(btn) {
  const gradeLabel = selectedGrade ? selectedGrade.gradeName : "";
  const subjectLabel = selectedSubject ? selectedSubject.name : "";
  
  const livesLeft = MAX_WRONG - gameState.wrong.length;
  
  let blockGrid = "";
  for (let i = 0; i < MAX_WRONG; i++) {
    if (i < gameState.wrong.length) blockGrid += "🟥";
    else blockGrid += "🟩";
  }
  
  const shareText = `Adam Asmaca Eğitim - ${gradeLabel} ${subjectLabel}
Kelimeyi ${gameState.won ? "BİLDİM! 🎉" : "Bilemedim... 💀"}
Can: ${livesLeft}/${MAX_WRONG} | Puan: ${gameState.score}
${blockGrid}
Sen de Adam Asmaca Eğitim'i oyna! 🏆`;

  // Web Share API (mobil paylaşma menüsü)
  if (navigator.share) {
    navigator.share({
      title: "Adam Asmaca Eğitim",
      text: shareText
    }).catch(() => {}); // kullanıcı iptal ederse yoksay
    return;
  }
  
  // Fallback: Panoya kopyala
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareText).then(() => {
      const orig = btn.textContent;
      btn.textContent = "Panoya Kopyalandı! ✅";
      setTimeout(() => btn.textContent = orig, 2500);
    });
  } else {
    // Son çare: prompt
    const orig = btn.textContent;
    btn.textContent = "Kopyalandı! ✅";
    setTimeout(() => btn.textContent = orig, 2000);
    try {
      const ta = document.createElement("textarea");
      ta.value = shareText; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy");
      document.body.removeChild(ta);
    } catch(e) { alert(shareText); }
  }
}

function triggerGradeConfetti() {
  const gradeTheme = selectedGrade ? getGradeThemeGroup(selectedGrade.grade).group : "";
  let colors = ["#4f98a3","#6daa45","#e8af34","#d163a7","#fdab43"];
  
  if (gradeTheme === "primary") colors = ["#ff8a3d", "#ffd785", "#ff477e", "#2ec4b6", "#ff9f1c"];
  else if (gradeTheme === "adventure") colors = ["#2d8a4e", "#59d184", "#bed2b8", "#cca21b", "#effaf2"];
  else if (gradeTheme === "tech") colors = ["#822faf", "#ca7cfa", "#2ae6b7", "#ff5e9c", "#ffa15e"];
  else if (gradeTheme === "academic") colors = ["#174276", "#5495e2", "#1f6b57", "#ff5c5c", "#f2c03f"];
  else if (gradeTheme === "exam") colors = ["#b08010", "#f2cb44", "#ffd76d", "#206d59", "#9c1f1f"];

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
  if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT") return;
  
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
