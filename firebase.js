// ── FIREBASE: Authentication + Firestore Sync ─────────────────────────────
// adam-asmaca-30444 | Firebase modular SDK v12

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBi0CvOLTcKfH9ejhDWBkHY9EbnVDBNdHo",
  authDomain: "adam-asmaca-30444.firebaseapp.com",
  projectId: "adam-asmaca-30444",
  storageBucket: "adam-asmaca-30444.firebasestorage.app",
  messagingSenderId: "595675238050",
  appId: "1:595675238050:web:cab0cde49aefdeaff2d1fb",
  measurementId: "G-5DF5S46WDE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ── HELPERS ────────────────────────────────────────────────────────────────
function userDoc(uid, docName) {
  return doc(db, "users", uid, "data", docName);
}

async function safeGet(ref) {
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("Firestore read error:", e.message);
    return null;
  }
}

async function safeSet(ref, data) {
  try {
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.warn("Firestore write error:", e.message);
  }
}

// ── STATS MERGE ────────────────────────────────────────────────────────────
// İki kaynaktan en iyi değerleri alır — veri kaybı olmaz
function mergeStats(local, cloud) {
  const result = {
    totalGames: Math.max(local.totalGames || 0, cloud.totalGames || 0),
    gamesWon: Math.max(local.gamesWon || 0, cloud.gamesWon || 0),
    longestStreak: Math.max(local.longestStreak || 0, cloud.longestStreak || 0),
    subjectScores: { ...(cloud.subjectScores || {}) }
  };
  // Ders bazlı skorları birleştir
  const localScores = local.subjectScores || {};
  for (const id in localScores) {
    const ls = localScores[id];
    const cs = result.subjectScores[id];
    if (!cs) {
      result.subjectScores[id] = ls;
    } else {
      result.subjectScores[id] = {
        name: cs.name || ls.name,
        played: Math.max(ls.played || 0, cs.played || 0),
        won: Math.max(ls.won || 0, cs.won || 0)
      };
    }
  }
  return result;
}

// ── BADGES MERGE ───────────────────────────────────────────────────────────
function mergeBadges(localUnlocked, cloudUnlocked) {
  const set = new Set([...(localUnlocked || []), ...(cloudUnlocked || [])]);
  return [...set];
}

// ── MISTAKES MERGE ─────────────────────────────────────────────────────────
function mergeMistakes(localList, cloudList) {
  const seen = new Set();
  const merged = [];
  for (const item of [...(localList || []), ...(cloudList || [])]) {
    const key = (item.word || "").toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

// ── PUBLIC API ─────────────────────────────────────────────────────────────
const FB = {
  get currentUser() { return auth.currentUser; },

  async signIn() {
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") {
        console.error("Google giriş hatası:", e.message);
        alert("Giriş yapılamadı: " + e.message);
      }
    }
  },

  async signOut() {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Çıkış hatası:", e.message);
    }
  },

  onAuthStateChanged(cb) {
    return onAuthStateChanged(auth, cb);
  },

  // İlk girişte yerel + bulut veri birleştirme
  async syncOnLogin(uid, getLocal) {
    const [cloudStats, cloudBadgesData, cloudMistakesData] = await Promise.all([
      safeGet(userDoc(uid, "stats")),
      safeGet(userDoc(uid, "badges")),
      safeGet(userDoc(uid, "mistakes"))
    ]);

    const local = getLocal(); // { stats, badges, badgeCounts, mistakes }

    // Stats
    const mergedStats = cloudStats ? mergeStats(local.stats, cloudStats) : local.stats;
    await safeSet(userDoc(uid, "stats"), mergedStats);

    // Badges
    const cloudBadges = cloudBadgesData ? (cloudBadgesData.unlocked || []) : [];
    const cloudCounts = cloudBadgesData ? (cloudBadgesData.counts || {}) : {};
    const mergedBadges = mergeBadges(local.badges, cloudBadges);
    const mergedCounts = { ...cloudCounts };
    for (const k in (local.badgeCounts || {})) {
      mergedCounts[k] = Math.max(mergedCounts[k] || 0, local.badgeCounts[k]);
    }
    await safeSet(userDoc(uid, "badges"), { unlocked: mergedBadges, counts: mergedCounts });

    // Mistakes
    const cloudMistakes = cloudMistakesData ? (cloudMistakesData.words || []) : [];
    const mergedMistakes = mergeMistakes(local.mistakes, cloudMistakes);
    await safeSet(userDoc(uid, "mistakes"), { words: mergedMistakes });

    // Profile
    const user = auth.currentUser;
    await safeSet(userDoc(uid, "profile"), {
      displayName: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
      lastSeen: serverTimestamp()
    });

    return { stats: mergedStats, badges: mergedBadges, badgeCounts: mergedCounts, mistakes: mergedMistakes };
  },

  // Buluttan veri yükle (farklı cihazdan giriş)
  async loadFromCloud(uid) {
    const [statsData, badgesData, mistakesData] = await Promise.all([
      safeGet(userDoc(uid, "stats")),
      safeGet(userDoc(uid, "badges")),
      safeGet(userDoc(uid, "mistakes"))
    ]);
    return {
      stats: statsData,
      badges: badgesData ? (badgesData.unlocked || []) : null,
      badgeCounts: badgesData ? (badgesData.counts || {}) : null,
      mistakes: mistakesData ? (mistakesData.words || []) : null
    };
  },

  async saveStats(uid, stats) {
    await safeSet(userDoc(uid, "stats"), stats);
  },

  async saveBadges(uid, unlocked, counts) {
    await safeSet(userDoc(uid, "badges"), { unlocked, counts });
  },

  async saveMistakes(uid, words) {
    await safeSet(userDoc(uid, "mistakes"), { words });
  },

  async saveGrade(uid, gradeNum) {
    await safeSet(userDoc(uid, "profile"), { savedGrade: gradeNum });
  }
};

// Global olarak eriş
window.FB = FB;

// Main.js'e hazır sinyali gönder
window.dispatchEvent(new CustomEvent("firebase-ready"));
