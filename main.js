// ── GOOGLE FORM CONFIGURATION ──────────────────────────────────────────────────
// Bu konfigürasyon, oyun içi hata bildirimlerinin (⚠️ butonu veya menüdeki hata bildir)
// doğrudan Google Form'a arka planda sessizce gönderilmesini sağlar.
const GOOGLE_FORM_CONFIG = {
  formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdKQQC5kDohdH5zo_AF9yFGdo3fSDHq00Ut0kMilIlQYqqjfw/formResponse", 
  entries: {
    grade: "entry.1834771806",
    subject: "entry.2070856554",
    unit: "entry.632575396",
    word: "entry.1219416252"
  }
};

// ── TEACHER SUBMITTED WORDS GOOGLE SHEET CSV ────────────────────────────────────
// Google E-Tablo'dan "Web'de Yayınla" diyerek aldığınız CSV linkini buraya yapıştırın.
// Örnek: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTEACHER_CSV_KEY/pub?gid=0&single=true&output=csv"
const TEACHER_WORDS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTZmj8vY5uYgRc1EZT5yTo6KkyZZKO7Bfh8gwT36RnUrst6wJ-DnHYKclRNGZD0xqTZv-97qV46t1M/pub?gid=1918846397&single=true&output=csv"; 


// ── SAFE STORAGE FALLBACKS ────────────────────────────────────────────────────
// Iframe veya kısıtlı web tarayıcı ortamlarında localStorage / sessionStorage
// erişimi engellendiğinde (DOMException) çökme yaşanmaması için in-memory fallback sağlar.
const SafeStorage = {
  memoryStore: {},
  isSupported() {
    try {
      const key = "__test_storage__";
      localStorage.setItem(key, "1");
      localStorage.removeItem(key);
      return true;
    } catch(e) {
      return false;
    }
  },
  getItem(key) {
    try {
      if (this.isSupported()) return localStorage.getItem(key);
    } catch(e) {}
    return this.memoryStore[key] || null;
  },
  setItem(key, value) {
    try {
      if (this.isSupported()) {
        localStorage.setItem(key, value);
        return;
      }
    } catch(e) {}
    this.memoryStore[key] = String(value);
  },
  removeItem(key) {
    try {
      if (this.isSupported()) {
        localStorage.removeItem(key);
        return;
      }
    } catch(e) {}
    delete this.memoryStore[key];
  }
};

const SafeSessionStorage = {
  memoryStore: {},
  isSupported() {
    try {
      const key = "__test_session__";
      sessionStorage.setItem(key, "1");
      sessionStorage.removeItem(key);
      return true;
    } catch(e) {
      return false;
    }
  },
  getItem(key) {
    try {
      if (this.isSupported()) return sessionStorage.getItem(key);
    } catch(e) {}
    return this.memoryStore[key] || null;
  },
  setItem(key, value) {
    try {
      if (this.isSupported()) {
        sessionStorage.setItem(key, value);
        return;
      }
    } catch(e) {}
    this.memoryStore[key] = String(value);
  }
};

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

// Ünite bazlı geçici round istatistikleri
let roundPlayedCount = 0;
let roundWonCount = 0;

let savedScore = 0;
try {
  const saved = SafeSessionStorage.getItem("hangman_score");
  if (saved) {
    const data = JSON.parse(saved);
    if (data.date === new Date().toLocaleDateString()) {
      savedScore = data.score;
    }
  }
} catch(e) {}

// Oyun özellikleri durumları
let currentDifficulty = SafeStorage.getItem("adamAsmacaDiff") || "medium";
let timeModeActive = SafeStorage.getItem("adamAsmacaTimeMode") === "true";
let timeLeft = 60;
let timerInterval = null;
let jokersLeft = 3;
let streakCount = 0;
let currentRoundLength = SafeStorage.getItem("hangmanRoundLength") || "20";

let currentUnitFullWords = [];
let currentEntry = null;

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
  SafeSessionStorage.setItem("hangman_score", JSON.stringify({ score: gameState.score, date: new Date().toLocaleDateString() }));
}

// ── RETRO SOUNDS (Web Audio API) ───────────────────────────────────────────
const SOUNDS = {
  ctx: null,
  muted: SafeStorage.getItem("adamAsmacaMuted") === "true",
  
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
  },

  applause() {
    // Fanfare / Celebration Sound
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playBeep(n, 0.25, "sine"), idx * 80);
    });
    setTimeout(() => {
      const claps = [800, 850, 750, 900, 800, 850, 900, 950];
      claps.forEach((f, i) => {
        setTimeout(() => this.playBeep(f, 0.08, "triangle"), i * 60);
      });
    }, 450);
  },

  sadJingle() {
    // Descending minor chord
    const notes = [392.00, 349.23, 311.13, 261.63, 196.00];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playBeep(n, 0.4, "sawtooth"), idx * 150);
    });
  }
};


// ── LOCAL STORAGE HELPERS (Stats & Badges & Mistakes) ────────────────────────
const STATS = {
  get() {
    const defaultStats = { totalGames: 0, gamesWon: 0, longestStreak: 0, subjectScores: {} };
    try {
      const raw = SafeStorage.getItem("hangman_stats");
      if (!raw) return defaultStats;
      const stats = JSON.parse(raw);
      if (stats && typeof stats === "object" && !Array.isArray(stats)) {
        if (!stats.subjectScores || typeof stats.subjectScores !== "object" || Array.isArray(stats.subjectScores)) {
          stats.subjectScores = {};
        }
        // Sanitize subjectScores items
        for (const k in stats.subjectScores) {
          const s = stats.subjectScores[k];
          if (s && typeof s === "object") {
            if (typeof s.played !== "number") s.played = parseInt(s.played) || 0;
            if (typeof s.won !== "number") s.won = parseInt(s.won) || 0;
            if (typeof s.name !== "string") s.name = k;
          } else {
            delete stats.subjectScores[k];
          }
        }
        if (typeof stats.totalGames !== "number") stats.totalGames = parseInt(stats.totalGames) || 0;
        if (typeof stats.gamesWon !== "number") stats.gamesWon = parseInt(stats.gamesWon) || 0;
        if (typeof stats.longestStreak !== "number") stats.longestStreak = parseInt(stats.longestStreak) || 0;
        return stats;
      }
      return defaultStats;
    } catch(e) {
      return defaultStats;
    }
  },
  save(stats) {
    SafeStorage.setItem("hangman_stats", JSON.stringify(stats));
  },
  recordGame(won, streak, subjectId, subjectName) {
    const s = this.get();
    s.totalGames++;
    if (won) s.gamesWon++;
    if (streak > s.longestStreak) s.longestStreak = streak;
    
    // Ders bazlı skorlar
    if (!s.subjectScores) s.subjectScores = {};
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
      const raw = SafeStorage.getItem("hangman_badges");
      if (!raw) return [];
      const res = JSON.parse(raw);
      return Array.isArray(res) ? res.filter(item => typeof item === "string") : [];
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
      SafeStorage.setItem("hangman_badges", JSON.stringify(unlocked));
      
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
      position: fixed; top: 24px; left: 50%; transform: translateX(-50%) translateY(-100px);
      background: var(--color-surface); border: 2px solid var(--color-primary);
      padding: 16px 24px; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
      display: flex; flex-direction: column; align-items: center; gap: 4px; z-index: 9999;
      opacity: 0; transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      width: 80%; max-width: 400px; box-sizing: border-box; text-align: center;
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
      toast.style.transform = "translateX(-50%) translateY(-100px)";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 600);
    }, 4500);
  }
};

const MISTAKES = {
  get() {
    try {
      const raw = SafeStorage.getItem("hangman_mistakes");
      if (!raw) return [];
      const res = JSON.parse(raw);
      if (!Array.isArray(res)) return [];
      return res.map(item => {
        if (typeof item === "string") {
          return { word: item, hint: "Kayıtlı Yanlış", gradeName: "Genel", subjectName: "Tekrar", subjectId: "" };
        }
        if (item && typeof item === "object" && typeof item.word === "string") {
          if (typeof item.hint !== "string") item.hint = "İpucu Yok";
          if (typeof item.gradeName !== "string") item.gradeName = "Genel";
          if (typeof item.subjectName !== "string") item.subjectName = "Tekrar";
          if (typeof item.subjectId !== "string") item.subjectId = "";
          return item;
        }
        return null;
      }).filter(item => item !== null);
    } catch(e) {
      return [];
    }
  },
  add(word, hint, gradeName, subjectName, subjectId) {
    const list = this.get();
    const isDup = list.some(item => item.word.toLowerCase() === word.toLowerCase());
    if (!isDup) {
      list.push({ word, hint, gradeName, subjectName, subjectId });
      SafeStorage.setItem("hangman_mistakes", JSON.stringify(list));
    }
  },
  remove(word) {
    let list = this.get();
    list = list.filter(item => item.word.toLowerCase() !== word.toLowerCase());
    SafeStorage.setItem("hangman_mistakes", JSON.stringify(list));
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

let currentKeyboard = SafeStorage.getItem("adamAsmacaKb") || "qwerty";
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

// ── TEACHER SUBMITTED WORDS LOADER & PARSER ──────────────────────────────────
async function fetchTeacherWords() {
  if (!TEACHER_WORDS_CSV_URL) {
    console.log("Öğretmen kelimeleri CSV linki tanımlı değil. Dinamik yükleme atlandı.");
    return;
  }
  try {
    const res = await fetch(TEACHER_WORDS_CSV_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error("CSV dosyası çekilemedi.");
    const csvText = await res.text();
    const rows = parseCSV(csvText);
    
    processTeacherCSVRows(rows);
  } catch (err) {
    console.error("Öğretmen kelimeleri yükleme hatası:", err);
  }
}

function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',') {
      if (inQuotes) {
        row[row.length - 1] += c;
      } else {
        row.push("");
      }
    } else if (c === '\r' || c === '\n') {
      if (inQuotes) {
        row[row.length - 1] += c;
      } else {
        if (c === '\r' && next === '\n') {
          i++;
        }
        lines.push(row);
        row = [""];
      }
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}

function extractGradeNumber(gradeStr) {
  if (!gradeStr) return null;
  if (gradeStr.includes("Çıkmış") || gradeStr.includes("Sınav")) {
    return 99;
  }
  const match = gradeStr.match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

function normalizeSubject(subjStr) {
  if (!subjStr) return "";
  const s = subjStr.toLowerCase().trim();
  if (s.includes("türkçe") || s.includes("turkce")) return "turkce";
  if (s.includes("hayat")) return "hayat";
  if (s.includes("matematik")) return "matematik";
  if (s.includes("fen")) return "fen";
  if (s.includes("ingilizce") || s.includes("english")) return "ingilizce";
  if (s.includes("din")) return "din";
  if (s.includes("sosyal")) return "sosyal";
  if (s.includes("inkılap") || s.includes("inkilap")) return "inkilap";
  if (s.includes("bilişim") || s.includes("bilisim")) return "bilisim";
  if (s.includes("edebiyat")) return "edebiyat";
  if (s.includes("fizik")) return "fizik";
  if (s.includes("kimya")) return "kimya";
  if (s.includes("biyoloji")) return "biyoloji";
  if (s.includes("tarih")) return "tarih";
  if (s.includes("coğrafya") || s.includes("cografya")) return "cografya";
  if (s.includes("felsefe")) return "felsefe";
  if (s.includes("lgs")) return "lgs";
  if (s.includes("yks")) return "yks";
  if (s.includes("kpss")) return "kpss";
  if (s.includes("görsel") || s.includes("gorsel")) return "gorselsanat";
  if (s.includes("müzik") || s.includes("muzik")) return "muzik";
  if (s.includes("beden") || s.includes("spor")) return "bedenegitimi";
  if (s.includes("oyun") || s.includes("fiziki")) return "oyunfiziki";
  if (s.includes("sağlık") || s.includes("saglik")) return "saglik";
  if (s.includes("rehberlik")) return "rehberlik";
  return s;
}

function processTeacherCSVRows(rows) {
  if (rows.length < 2) return;
  const teacherWords = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 9) continue;
    
    const gradeVal = extractGradeNumber(row[4]);
    const subjVal = normalizeSubject(row[5]);
    const unitName = row[6] ? row[6].trim() : "";
    const wordVal = row[7] ? toTrUpperCase(row[7].trim()) : "";
    const hintVal = row[8] ? row[8].trim() : "";
    
    if (gradeVal && subjVal && unitName && wordVal && hintVal) {
      teacherWords.push({
        grade: gradeVal,
        subjectId: subjVal,
        unitName: unitName,
        word: wordVal,
        hint: hintVal
      });
    }
  }
  
  console.log(`Google E-Tablo'dan ${teacherWords.length} öğretmen kelimesi başarıyla yüklendi.`);
  SafeStorage.setItem("adamAsmacaTeacherWords", JSON.stringify(teacherWords));
}

function getTeacherWordsForCurrentUnit() {
  if (!selectedGrade || !selectedSubject || !selectedUnit) return [];
  try {
    const raw = SafeStorage.getItem("adamAsmacaTeacherWords");
    if (!raw) return [];
    const allTeacherWords = JSON.parse(raw);
    if (!Array.isArray(allTeacherWords)) return [];
    
    return allTeacherWords.filter(item => {
      const matchGrade = item.grade === selectedGrade.grade;
      const matchSubject = item.subjectId === selectedSubject.id;
      
      const normalizeName = (name) => (name || "").toLowerCase().replace(/\s+/g, "").trim();
      const matchUnit = normalizeName(item.unitName) === normalizeName(selectedUnit.name);
      return matchGrade && matchSubject && matchUnit;
    }).map(item => ({
      word: item.word,
      hint: item.hint
    }));
  } catch (err) {
    console.error("Hata: Öğretmen kelimeleri alınamadı:", err);
    return [];
  }
}

// ── INIT & FETCH ────────────────────────────────────────────────────────────
async function init() {
  buildKeyboard();
  setupSettingsAndModals();
  await loadCurriculum();
  fetchTeacherWords();
  
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
  // Nav menü içindeki butonlar (modal açınca dropdown kapansın)
  function navMenuAction(fn) {
    return () => {
      const dropdown = document.getElementById("nav-dropdown");
      const backdrop = document.getElementById("nav-backdrop");
      if (dropdown) dropdown.style.display = "none";
      if (backdrop) backdrop.style.display = "none";
      if (typeof fn === "function") fn();
    };
  }

  // Zorluk seçici
  const diffSelect = document.getElementById("difficulty-select");
  if (diffSelect) {
    diffSelect.value = currentDifficulty;
    diffSelect.addEventListener("change", (e) => {
      currentDifficulty = e.target.value;
      SafeStorage.setItem("adamAsmacaDiff", currentDifficulty);
      
      MAX_WRONG = getLivesLimit(currentDifficulty);
      updateLives();
      updateHangman();
      updateJokerUI();
      
      if (gameState.over) {
        newGame(false);
      } else {
        if (gameState.wrong.length >= MAX_WRONG) {
          clearInterval(timerInterval);
          gameState.over = true;
          gameState.won = false;
          streakCount = 0;
          saveScore();
          SOUNDS.lose();
          showEndOverlay();
        }
      }
    });
  }

  // Süreli Mod - active sınıfı ile toggle
  const timeBtn = document.getElementById("time-mode-btn");
  if (timeBtn) {
    timeBtn.textContent = timeModeActive ? "⏱️ Süreli: Açık" : "⏱️ Süreli: Kapalı";
    if (timeModeActive) timeBtn.classList.add("active");
    timeBtn.addEventListener("click", () => {
      timeModeActive = !timeModeActive;
      SafeStorage.setItem("adamAsmacaTimeMode", timeModeActive ? "true" : "false");
      timeBtn.textContent = timeModeActive ? "⏱️ Süreli: Açık" : "⏱️ Süreli: Kapalı";
      timeBtn.classList.toggle("active", timeModeActive);
      newGame(!gameState.won);
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
  const kbPopup = document.getElementById("kb-popup");
  const kbPopupClose = document.getElementById("kb-popup-close");
  const kbOptionsList = document.getElementById("keyboard-options-list");

  function openSettingsPopup() {
    const roundOptionsList = document.getElementById("round-options-list");
    if (kbPopup && kbOptionsList) {
      kbOptionsList.querySelectorAll(".kb-option-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.value === currentKeyboard);
      });
      if (roundOptionsList) {
        roundOptionsList.querySelectorAll(".round-option-btn").forEach(btn => {
          btn.classList.toggle("active", btn.dataset.value === currentRoundLength);
        });
      }
      kbPopup.style.display = "flex";
    }
  }

  // Delegated listener for dynamically created settings button
  const kbArea = document.getElementById("keyboard-area");
  if (kbArea) {
    kbArea.addEventListener("click", (e) => {
      if (e.target.closest("#keyboard-settings-btn")) {
        openSettingsPopup();
      }
    });
  }

  if (kbPopup && kbPopupClose && kbOptionsList) {
    const roundOptionsList = document.getElementById("round-options-list");
    
    kbPopupClose.addEventListener("click", () => {
      kbPopup.style.display = "none";
    });
    kbPopup.addEventListener("click", (e) => {
      if (e.target === kbPopup) kbPopup.style.display = "none";
    });
    kbOptionsList.querySelectorAll(".kb-option-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        currentKeyboard = btn.dataset.value;
        SafeStorage.setItem("adamAsmacaKb", currentKeyboard);
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
    
    if (roundOptionsList) {
      roundOptionsList.querySelectorAll(".round-option-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          currentRoundLength = btn.dataset.value;
          SafeStorage.setItem("hangmanRoundLength", currentRoundLength);
          
          roundOptionsList.querySelectorAll(".round-option-btn").forEach(b => {
            b.classList.toggle("active", b.dataset.value === currentRoundLength);
          });
          
          if (selectedUnit && selectedUnit.words) {
            prepareRoundWordBank(selectedUnit.words);
            newGame();
          }
          
          setTimeout(() => {
            kbPopup.style.display = "none";
          }, 150);
        });
      });
    }
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
      SafeStorage.setItem("adamAsmacaMuted", SOUNDS.muted ? "true" : "false");
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
  gameState.score -= 2;
  saveScore();
  SOUNDS.wrong();
  
  // Shake animasyonu ekle
  const gameCard = document.getElementById("game-card");
  gameCard.classList.add("shake");
  setTimeout(() => gameCard.classList.remove("shake"), 350);

  if (gameState.wrong.length >= MAX_WRONG) {
    gameState.over = true;
    gameState.won = false;
    recordGameResult(false);
    updateUI();
    setTimeout(() => showEndOverlay(), 700);
  } else {
    updateUI();
    startTimer(); // Sonraki harf/süre döngüsünü başlat
  }
}

// ── MODALS INTEGRATION ─────────────────────────────────────────────────────
function openOverlay(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.error("openOverlay: element not found:", id);
    showNotificationToast("❌ Panel açılamadı: " + id);
    return;
  }
  el.style.display = "flex";
  el.style.zIndex = "9999";
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
  
  closeOverlay("report-overlay");
  
  submitWordToGoogleForm(currentWordVal, gradeLabel, subjectLabel, unitLabel, desc);
}

function showNotificationToast(message) {
  const oldToasts = document.querySelectorAll(".app-notification-toast");
  oldToasts.forEach(t => t.remove());

  const toast = document.createElement("div");
  toast.className = "app-notification-toast";
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(-100px);
    background: var(--color-surface);
    color: var(--color-text);
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-lg);
    padding: 12px 24px;
    font-size: var(--text-md);
    font-family: var(--font-body);
    box-shadow: var(--shadow-lg);
    z-index: 10000;
    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s;
    opacity: 0;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 600;
    width: 80%;
    max-width: 400px;
    box-sizing: border-box;
    text-align: center;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.transform = "translateX(-50%) translateY(0)";
    toast.style.opacity = "1";
  }, 50);
  
  setTimeout(() => {
    toast.style.transform = "translateX(-50%) translateY(-100px)";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function submitWordToGoogleForm(word, grade, subject, unit, description) {
  const url = GOOGLE_FORM_CONFIG.formUrl;
  const entries = GOOGLE_FORM_CONFIG.entries;
  
  let wordValue = word || "-";
  if (description && description !== "Oyun Sonu Ekranından Doğrudan Bildirildi" && description !== "Doğrudan Bildirildi") {
    wordValue += ` (Açıklama: ${description})`;
  }
  
  const params = new URLSearchParams();
  if (entries.grade) params.append(entries.grade, grade || "-");
  if (entries.subject) params.append(entries.subject, subject || "-");
  if (entries.unit) params.append(entries.unit, unit || "-");
  if (entries.word) params.append(entries.word, wordValue);
  
  showNotificationToast("⏳ Hata bildiriliyor...");
  
  fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  })
  .then(() => {
    showNotificationToast("✅ Hata bildirildi!");
  })
  .catch((err) => {
    console.error("Google Form submission error:", err);
    showNotificationToast("❌ Bildirim iletilemedi!");
  });
}


function openStatsModal() {
  try {
    const stats = STATS.get();
    document.getElementById("stats-total").textContent = stats.totalGames;
    document.getElementById("stats-won").textContent = stats.gamesWon;
    
    const winRate = stats.totalGames > 0 ? Math.round((stats.gamesWon / stats.totalGames) * 100) : 0;
    document.getElementById("stats-winrate").textContent = winRate + "%";
    document.getElementById("stats-streak").textContent = stats.longestStreak;
    
    // Grafik bar üretimi
    const chart = document.getElementById("stats-chart");
    chart.innerHTML = "";
    
    const keys = Object.keys(stats.subjectScores || {});
    if (keys.length === 0) {
      chart.innerHTML = `<p style="text-align:center; color:var(--color-text-faint); margin-top:12px;">Henüz yeterli oyun verisi yok.</p>`;
    } else {
      keys.forEach(k => {
        const subject = stats.subjectScores[k];
        if (subject && subject.played > 0) {
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
        }
      });
    }
    
    openOverlay("stats-overlay");
  } catch (err) {
    console.error("Stats modal error:", err);
    showNotificationToast("❌ İstatistikler açılamadı: " + err.message);
  }
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
    const raw = SafeStorage.getItem("hangman_badge_counts");
    const counts = raw ? JSON.parse(raw) : {};
    const count = (counts && typeof counts === "object") ? (counts[badgeId] || 0) : 0;
    let level = null;
    for (const lvl of BADGE_LEVELS) {
      if (count >= lvl.threshold) level = lvl;
    }
    return { count, level };
  } catch(e) { return { count: 0, level: null }; }
}

function incrementBadgeCount(badgeId) {
  try {
    const counts = JSON.parse(SafeStorage.getItem("hangman_badge_counts")) || {};
    counts[badgeId] = (counts[badgeId] || 0) + 1;
    SafeStorage.setItem("hangman_badge_counts", JSON.stringify(counts));
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
  try {
    const unlocked = Array.isArray(BADGES.getUnlocked()) ? BADGES.getUnlocked() : [];
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
  } catch (err) {
    console.error("Badges modal error:", err);
    showNotificationToast("❌ Rozetler açılamadı: " + err.message);
  }
}

function openMistakesModal() {
  try {
    const mistakes = Array.isArray(MISTAKES.get()) ? MISTAKES.get() : [];
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
  } catch (err) {
    console.error("Mistakes modal error:", err);
    showNotificationToast("❌ Hata Defteri açılamadı: " + err.message);
  }
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

function prepareRoundWordBank(words) {
  // Öğretmenin formdan eklediği dinamik kelimeleri yükle ve birleştir
  const tWords = getTeacherWordsForCurrentUnit();
  const mergedWords = [...words];
  tWords.forEach(tw => {
    const exists = mergedWords.some(w => w.word === tw.word);
    if (!exists) {
      mergedWords.push(tw);
    }
  });

  currentUnitFullWords = [...mergedWords];
  
  let count = mergedWords.length;
  if (currentRoundLength !== "all") {
    count = Math.min(parseInt(currentRoundLength) || 20, mergedWords.length);
  }
  
  const shuffled = [...mergedWords].sort(() => Math.random() - 0.5);
  WORD_BANK = shuffled.slice(0, count);
  availableWords = [...WORD_BANK];
  
  // Reset round session stats
  roundPlayedCount = 0;
  roundWonCount = 0;
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
    revealBtn.disabled = false;
    eliminateBtn.disabled = false;
  }
}

function useRevealJoker() {
  if (jokersLeft <= 0 || gameState.over) return;
  
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
  if (jokersLeft <= 0 || gameState.over) return;
  
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
        prepareRoundWordBank(rUnit.words);
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
            prepareRoundWordBank(unit.words);
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
  
  let lastVisibleRowIndex = -1;
  layout.forEach((row, ri) => {
    const isSpaceOnly = row.length === 1 && row[0] === "space";
    if (!isSpaceOnly) {
      lastVisibleRowIndex = ri;
    }
  });

  layout.forEach((row, ri) => {
    const el = document.getElementById(`row-${ri+1}`);
    if(!el) return;
    el.innerHTML = "";
    
    const isSpaceOnly = row.length === 1 && row[0] === "space";
    if(isSpaceOnly) {
      el.style.display = "none";
      return;
    }
    
    row.forEach(key => {
      if(key === "space") return;
      const btn = document.createElement("button");
      btn.className = "key-btn"; btn.dataset.key = key; btn.textContent = key;
      btn.addEventListener("click", () => guess(key));
      el.appendChild(btn);
    });
    
    if (ri === lastVisibleRowIndex) {
      const setBtn = document.createElement("button");
      setBtn.className = "key-btn";
      setBtn.id = "keyboard-settings-btn";
      setBtn.title = "Klavye Düzeni";
      setBtn.textContent = "⚙️";
      el.appendChild(setBtn);
    }
    
    el.style.display = "flex";
  });
  
  const r4 = document.getElementById("row-4");
  if (layout.length < 4) {
    if(r4) r4.style.display = "none";
  } else {
    const isSpaceOnlyRow4 = layout[3].length === 1 && layout[3][0] === "space";
    if(r4 && !isSpaceOnlyRow4) {
      r4.style.display = "flex";
    }
  }
}

function toTrUpperCase(str) {
  return str.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

function newGame(isRetry = false) {
  if(!WORD_BANK || WORD_BANK.length === 0) {
    alert("Kelimeler yüklenemedi. Lütfen başka bir ders/sınıf seçin.");
    showSubjectScreen();
    return;
  }
  
  buildKeyboard();
  MAX_WRONG = getLivesLimit(currentDifficulty);
  jokersLeft = 3;
  
  if (isRetry && currentEntry) {
    // Retrying the same word, no need to load a new one or check availableWords
  } else {
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
    currentEntry = availableWords.splice(randomIndex, 1)[0];
  }
  
  const entry = currentEntry;
  
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
  
  document.querySelectorAll(".overlay").forEach(e => {
    if (!["stats-overlay", "badges-overlay", "mistakes-overlay", "report-overlay", "kb-popup"].includes(e.id)) {
      e.remove();
    } else {
      e.style.display = "none";
    }
  });
  updateUI();
  startTimer();
}

function recordGameResult(won) {
  STATS.recordGame(won, streakCount, selectedSubject.id, selectedSubject.name);
  
  roundPlayedCount++;
  if (won) {
    roundWonCount++;
  }
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
    
    recordGameResult(true);
    
    if (isReviewMode) {
      MISTAKES.remove(gameState.rawWord);
    }
    SOUNDS.win();
  } else if (!inWord && gameState.wrong.length >= MAX_WRONG) {
    recordGameResult(false);
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
  const TR_SPECIAL = new Set(["Ğ","Ü","Ş","İ","Ö","Ç"]);
  // Tüm WORD_BANK'taki harfleri topla (üniteye özel karakterler)
  const wordBankChars = new Set();
  (WORD_BANK || []).forEach(entry => {
    [...(entry.word || "").toUpperCase()].forEach(ch => wordBankChars.add(ch));
  });

  document.querySelectorAll(".key-btn").forEach(btn => {
    const k = btn.dataset.key;
    if (!k) return; // settings btn vs.

    // Türkçe özel karakter mi? Ünitedeki hiçbir kelimede yoksa gizle
    if (TR_SPECIAL.has(k)) {
      const needed = wordBankChars.has(k);
      btn.style.display = needed ? "" : "none";
      if (!needed) return;
    } else {
      btn.style.display = "";
    }

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
  // Ünite istatistiklerini hesapla (Ömür boyu değil, bu round/ünite bazında)
  const totalPlayed = roundPlayedCount;
  const totalWon = roundWonCount;
  const winRate = totalPlayed > 0 ? Math.round((totalWon / totalPlayed) * 100) : 0;
  const isSuccess = winRate >= 50;
  
  document.querySelectorAll(".overlay").forEach(e => {
    if (!["stats-overlay", "badges-overlay", "mistakes-overlay", "report-overlay", "kb-popup"].includes(e.id)) {
      e.remove();
    } else {
      e.style.display = "none";
    }
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
  
  // Kutlama sesleri ve Konfeti
  if (isSuccess) {
    triggerGradeConfetti();
    setTimeout(() => triggerGradeConfetti(), 300); // Çift konfeti patlaması
    SOUNDS.applause();
  } else {
    SOUNDS.sadJingle();
  }
  
  const icon = isSuccess ? "🏆" : "😢";
  const title = isSuccess ? "Üniteyi Başarıyla Tamamladın!" : "Biraz Daha Çalışmalısın!";
  const feedbackSub = isSuccess 
    ? `${subjectName} &rsaquo; ${unitName}`
    : "Başarı oranı düşük kaldı. Üniteyi tekrar ederek daha iyi bir skor elde edebilirsin!";
  
  card.innerHTML = `
    <span class="overlay-icon" style="font-size:52px">${icon}</span>
    <h2 class="overlay-title" style="font-size:20px;margin:12px 0 4px;line-height:1.2;">${title}</h2>
    <p class="overlay-sub" style="margin-bottom:16px; font-size:13px; color:var(--color-text-muted);">${feedbackSub}</p>
    
    <div style="
      background:var(--color-surface-offset); border-radius:var(--radius-lg);
      padding:16px; margin-bottom:16px; width:100%;
      display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; text-align:center;
      box-sizing: border-box;
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
    
    <div style="width:100%;margin-bottom:20px;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--color-text-muted);margin-bottom:4px;">
        <span>Başarı Oranı</span>
        <span>%${winRate}</span>
      </div>
      <div style="background:var(--color-border);border-radius:99px;height:8px;overflow:hidden;">
        <div style="width:${winRate}%;height:100%;background:${isSuccess ? 'var(--color-success)' : 'var(--color-error)'};border-radius:99px;transition:width 0.8s ease;"></div>
      </div>
    </div>
    
    <div style="display:flex;flex-direction:column;gap:8px;width:100%;box-sizing:border-box;">
      <button class="btn-primary" id="unit-next-btn" style="width:100%;">${isSuccess ? 'Sonraki Ünite →' : 'Tekrar Dene 🔄'}</button>
      <button class="btn-secondary" id="unit-share-btn" style="width:100%;margin-top:0;">Sonucu Paylaş 🔗</button>
      <button class="btn-secondary" id="unit-replay-btn" style="width:100%;margin-top:0;">Bu Üniteyi Tekrarla 🔄</button>
      <button class="btn-secondary" id="unit-back-btn" style="width:100%;margin-top:0;">Ders Seçimine Dön</button>
    </div>
  `;
  
  ov.appendChild(card);
  document.body.appendChild(ov);
  
  // Sonraki Ünite butonu
  document.getElementById("unit-next-btn").addEventListener("click", () => {
    ov.remove();
    if (selectedSubject && selectedUnit) {
      const cachedData = PREFETCHED_DATA[selectedSubject.dataFile];
      if (cachedData && cachedData.units) {
        const units = cachedData.units;
        const currentIdx = units.findIndex(u => u.name === selectedUnit.name);
        if (currentIdx >= 0 && currentIdx + 1 < units.length) {
          const nextUnit = units[currentIdx + 1];
          selectedUnit = nextUnit;
          prepareRoundWordBank(nextUnit.words);
          newGame();
          return;
        }
      }
    }
    showSubjectScreen();
  });
  
  // Paylaş butonu
  const totalWrong = totalPlayed - totalWon;
  document.getElementById("unit-share-btn").addEventListener("click", (e) => {
    shareUnitComplete(e.target, totalWon, totalWrong);
  });
  
  document.getElementById("unit-replay-btn").addEventListener("click", () => {
    ov.remove();
    prepareRoundWordBank(currentUnitFullWords);
    newGame();
  });
  
  document.getElementById("unit-back-btn").addEventListener("click", () => {
    ov.remove();
    showSubjectScreen();
  });
}

function shareUnitComplete(btn, correct, incorrect) {
  const gradeLabel = selectedGrade ? selectedGrade.gradeName : "";
  const subjectLabel = selectedSubject ? selectedSubject.name : "";
  const unitLabel = selectedUnit ? selectedUnit.name : "";
  
  const shareText = `Adam Asmaca Eğitim - Ünite Tamamlandı! 🎓\nSınıf/Ders: ${gradeLabel}. Sınıf ${subjectLabel}\nÜnite: "${unitLabel}"\nSonuç: ${correct} Doğru, ${incorrect} Yanlış\nToplam Puanım: ${gameState.score} ⭐\nSen de kendini test et! 🏆`;

  if (navigator.share) {
    navigator.share({
      title: "Adam Asmaca Eğitim",
      text: shareText
    }).catch(() => {});
    return;
  }
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareText).then(() => {
      const orig = btn.textContent;
      btn.textContent = "Panoya Kopyalandı! ✅";
      setTimeout(() => btn.textContent = orig, 2500);
    });
  } else {
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

// ── END OVERLAY & FLASHCARD ──────────────────────────────────────────────────
function showEndOverlay() {
  document.querySelectorAll(".overlay").forEach(e => {
    if (!["stats-overlay", "badges-overlay", "mistakes-overlay", "report-overlay", "kb-popup"].includes(e.id)) {
      e.remove();
    } else {
      e.style.display = "none";
    }
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
  wordLabel.style.cssText = "font-size:24px; font-family:var(--font-display); color:var(--color-primary); display:flex; align-items:center; gap:8px;";
  wordLabel.textContent = gameState.word;
  
  const reportBtn = document.createElement("span");
  reportBtn.textContent = "⚠️";
  reportBtn.style.cssText = "font-size:16px; cursor:pointer; opacity:0.6; padding:4px; transition:opacity 0.2s;";
  reportBtn.title = "Hata Bildir";
  reportBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const gradeLabel = selectedGrade ? selectedGrade.gradeName : "-";
    const subjectLabel = selectedSubject ? selectedSubject.name : "-";
    const unitLabel = selectedUnit ? selectedUnit.name : "-";
    submitWordToGoogleForm(gameState.word, gradeLabel, subjectLabel, unitLabel, "Oyun Sonu Ekranından Doğrudan Bildirildi");
  });
  reportBtn.addEventListener("mouseenter", () => reportBtn.style.opacity = "1");
  reportBtn.addEventListener("mouseleave", () => reportBtn.style.opacity = "0.6");
  wordLabel.appendChild(reportBtn);
  
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
    btnPrimary.textContent = "Sıradaki Kelime →";
  }
  
  btnShare.textContent = "Skorunu Paylaş 🔗";
  btnBack.textContent = "Ders Seçimine Dön";
  
  btnPrimary.addEventListener("click", () => {
    ov.remove();
    newGame(false);
  });
  
  btnShare.addEventListener("click", () => {
    copyShareLink(btnShare);
  });
  
  btnBack.addEventListener("click", () => {
    ov.remove();
    showSubjectScreen();
  });

  btnRow.append(btnPrimary, btnShare, btnBack);
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
