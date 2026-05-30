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

// ── SYNC STRATEJİSİ ────────────────────────────────────────────────────────
// Kural: Bulut varsa → bulut kazanır (local üzerine yazılır)
//        Bulut yoksa → local'i buluta yükle (ilk kez kayıt)
//        Rozet/Hata Defteri → her zaman birleştir (kazanım kaybolmasın)

function cloudWinsStats(local, cloud) {
  // Bulut varsa bulut baz alınır;
  // local sadece offline oynanan EK oyunları ekler (delta).
  const localTotal = local.totalGames || 0;
  const cloudTotal = cloud.totalGames || 0;
  const offlineDelta = Math.max(0, localTotal - cloudTotal); // offline oyunlar

  const result = {
    totalGames:    cloudTotal + offlineDelta,
    gamesWon:      Math.max(local.gamesWon || 0, cloud.gamesWon || 0),
    longestStreak: Math.max(local.longestStreak || 0, cloud.longestStreak || 0),
    subjectScores: { ...(cloud.subjectScores || {}) }
  };

  // Offline oynanan dersleri ekle (bulutta yoksa)
  if (offlineDelta > 0) {
    const localScores = local.subjectScores || {};
    for (const id in localScores) {
      if (!result.subjectScores[id]) {
        result.subjectScores[id] = localScores[id];
      }
    }
  }
  return result;
}

// Rozetler: union (hiçbir rozet kaybolmaz)
function mergeBadges(localUnlocked, cloudUnlocked) {
  const set = new Set([...(localUnlocked || []), ...(cloudUnlocked || [])]);
  return [...set];
}

// Hata Defteri: union (unique kelimeler)
function mergeMistakes(localList, cloudList) {
  const seen = new Set();
  const merged = [];
  for (const item of [...(cloudList || []), ...(localList || [])]) {
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

  // Giriş senkronizasyonu
  // → Bulut verisi varsa: bulut kazanır, local sadece offline delta ekler
  // → Bulut boşsa: local'i buluta ilk kez yükle
  async syncOnLogin(uid, getLocal) {
    const [cloudStats, cloudBadgesData, cloudMistakesData] = await Promise.all([
      safeGet(userDoc(uid, "stats")),
      safeGet(userDoc(uid, "badges")),
      safeGet(userDoc(uid, "mistakes"))
    ]);

    const local = getLocal();
    const hasCloudData = !!(cloudStats || cloudBadgesData || cloudMistakesData);

    let finalStats, finalBadges, finalCounts, finalMistakes;

    if (hasCloudData) {
      // ── Bulut var → Bulut kazanır ──────────────────────────────────
      // Stats: bulut baz, offline delta eklenir
      finalStats    = cloudStats ? cloudWinsStats(local.stats, cloudStats) : cloudStats || local.stats;

      // Rozetler: her zaman union (hiçbir rozet kaybolmasın)
      const cloudBadges  = cloudBadgesData?.unlocked || [];
      const cloudCounts  = cloudBadgesData?.counts   || {};
      finalBadges = mergeBadges(local.badges, cloudBadges);
      finalCounts = { ...cloudCounts };
      // Sadece bulutta olmayan rozet sayaçlarını local'den al
      for (const k in (local.badgeCounts || {})) {
        if (!finalCounts[k]) finalCounts[k] = local.badgeCounts[k];
      }

      // Hata Defteri: cloud önce (cloud üzerine local'den yeni unique ekle)
      const cloudMistakes = cloudMistakesData?.words || [];
      finalMistakes = mergeMistakes(local.mistakes, cloudMistakes);

    } else {
      // ── Bulut boş → İlk kez kayıt, local'i yükle ──────────────────
      finalStats    = local.stats;
      finalBadges   = local.badges || [];
      finalCounts   = local.badgeCounts || {};
      finalMistakes = local.mistakes || [];
    }

    // Buluta yaz
    await Promise.all([
      safeSet(userDoc(uid, "stats"),    finalStats),
      safeSet(userDoc(uid, "badges"),   { unlocked: finalBadges, counts: finalCounts }),
      safeSet(userDoc(uid, "mistakes"), { words: finalMistakes }),
      safeSet(userDoc(uid, "profile"),  {
        displayName: auth.currentUser?.displayName || "",
        email:       auth.currentUser?.email || "",
        photoURL:    auth.currentUser?.photoURL || "",
        lastSeen:    serverTimestamp()
      })
    ]);

    return { stats: finalStats, badges: finalBadges, badgeCounts: finalCounts, mistakes: finalMistakes };
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
