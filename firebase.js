// ── FIREBASE: Authentication + Firestore Sync ─────────────────────────────
// adam-asmaca-30444 | Firebase modular SDK v12

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  arrayUnion,
  arrayRemove
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

function userProfileDoc(uid) {
  return doc(db, "users", uid, "profile", "info");
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
  const localTotal = local.totalGames || 0;
  const cloudTotal = cloud.totalGames || 0;
  const offlineDelta = Math.max(0, localTotal - cloudTotal);

  const result = {
    totalGames:    cloudTotal + offlineDelta,
    gamesWon:      Math.max(local.gamesWon || 0, cloud.gamesWon || 0),
    longestStreak: Math.max(local.longestStreak || 0, cloud.longestStreak || 0),
    subjectScores: { ...(cloud.subjectScores || {}) }
  };

  if (offlineDelta > 0) {
    const localScores = local.subjectScores || {};
    for (const id in localScores) {
      if (!result.subjectScores[id]) result.subjectScores[id] = localScores[id];
    }
  }
  return result;
}

function mergeBadges(localUnlocked, cloudUnlocked) {
  const set = new Set([...(localUnlocked || []), ...(cloudUnlocked || [])]);
  return [...set];
}

function mergeMistakes(localList, cloudList) {
  const seen = new Set();
  const merged = [];
  for (const item of [...(cloudList || []), ...(localList || [])]) {
    const key = (item.word || "").toLowerCase();
    if (!seen.has(key)) { seen.add(key); merged.push(item); }
  }
  return merged;
}

// ── 6 HANELİ KOD ÜRETİCİ ─────────────────────────────────────────────────
function generateClassCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // O,I,0,1 hariç
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── PUBLIC API ─────────────────────────────────────────────────────────────
const FB = {
  get currentUser() { return auth.currentUser; },

  async signIn() {
    try {
      // Android/Capacitor webview'larda popup beyaz ekran verir, redirect kullanılır.
      await signInWithRedirect(auth, provider);
    } catch (e) {
      console.error("Google giriş hatası:", e.message);
      alert("Giriş yapılamadı: " + e.message);
    }
  },

  async signOut() {
    try { await signOut(auth); }
    catch (e) { console.error("Çıkış hatası:", e.message); }
  },

  onAuthStateChanged(cb) {
    return onAuthStateChanged(auth, cb);
  },

  // ── ROL YÖNETİMİ ─────────────────────────────────────────────────────
  // Rol Firestore'da users/{uid}/profile/info.role = "teacher" | "student"
  // Varsayılan: "student" (her kullanıcı öğrenci başlar)
  // Öğretmen rolü: Firebase Console'dan admin tarafından elle atanır

  async getRole(uid) {
    try {
      const snap = await getDoc(userProfileDoc(uid));
      if (!snap.exists()) return "student";
      const data = snap.data();
      return (data.role || data.Role || "student").toLowerCase();
    } catch (e) {
      return "student";
    }
  },

  // ── SINIF YÖNETİMİ ────────────────────────────────────────────────────

  // Yeni sınıf oluştur (sadece öğretmen)
  // Dönüş: { code, success }
  async createClass(teacherUid, teacherName, className) {
    try {
      // Benzersiz kod bul
      let code, exists = true;
      let attempts = 0;
      while (exists && attempts < 10) {
        code = generateClassCode();
        const snap = await getDoc(doc(db, "classes", code));
        exists = snap.exists();
        attempts++;
      }
      if (exists) return { success: false, error: "Kod üretilemedi" };

      await setDoc(doc(db, "classes", code), {
        code,
        name: className,
        teacherUid,
        teacherName,
        createdAt: serverTimestamp(),
        memberCount: 0
      });
      return { success: true, code };
    } catch (e) {
      console.error("createClass:", e);
      return { success: false, error: e.message };
    }
  },

  async getTeacherClasses(teacherUid) {
    try {
      const q = query(
        collection(db, "classes"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({id: d.id, ...d.data()}))
        .filter(c => c.teacherUid === teacherUid);
    } catch (e) {
      console.error("getTeacherClasses:", e);
      return [];
    }
  },

  // ── ÖĞRENCİ ─────────────────────────────────────────────────────────────
  
  async getStudentClassCodes() {
    if (!this.currentUser) return [];
    try {
      const snap = await getDoc(userProfileDoc(this.currentUser.uid));
      if (!snap.exists()) return [];
      const data = snap.data();
      let codes = data.joinedClassCodes || [];
      if (data.joinedClassCode && !codes.includes(data.joinedClassCode)) {
        codes.push(data.joinedClassCode);
      }
      return codes;
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async joinClass(classCode) {
    if (!this.currentUser || !classCode) return { success: false, msg: "Geçersiz istek" };
    try {
      const code = classCode.toUpperCase();
      const classRef = doc(db, "classes", code);
      const classSnap = await getDoc(classRef);
      if (!classSnap.exists()) {
        return { success: false, msg: "Sınıf bulunamadı!" };
      }

      const profRef = userProfileDoc(this.currentUser.uid);
      await setDoc(profRef, { joinedClassCodes: arrayUnion(code) }, { merge: true });

      const memberRef = doc(db, "classes", code, "members", this.currentUser.uid);
      await setDoc(memberRef, {
        displayName: this.currentUser.displayName || "İsimsiz",
        email: this.currentUser.email || "",
        photoURL: this.currentUser.photoURL || "",
        joinedAt: serverTimestamp()
      });

      return { success: true, className: classSnap.data().name };
    } catch (e) {
      console.error(e);
      return { success: false, msg: "Bağlantı hatası: " + e.message };
    }
  },

  async getClassInfo(code) {
    try {
      const snap = await getDoc(doc(db, "classes", code.toUpperCase()));
      return snap.exists() ? snap.data() : null;
    } catch (e) {
      return null;
    }
  },

  async saveStudentStats(classCode, uid, stats) {
    if (!classCode || !uid) return;
    try {
      const memberRef = doc(db, "classes", classCode.toUpperCase(), "members", uid);
      await setDoc(memberRef, {
        stats: {
          totalGames: stats.totalGames || 0,
          gamesWon:   stats.gamesWon   || 0,
          score:      stats.score      || 0
        },
        mistakes: stats.mistakes || {},
        lastActive: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("saveStudentStats:", e.message);
    }
  },

  async getClassMembers(code) {
    try {
      const membersCol = collection(db, "classes", code.toUpperCase(), "members");
      const q = query(membersCol, orderBy("lastActive", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    } catch (e) {
      console.error("getClassMembers:", e);
      return [];
    }
  },

  async addClassWord(classCode, wordText, hint, category = "Özel Eklenti") {
    if (!classCode || !wordText || !this.currentUser) return false;
    try {
      const wordsCol = collection(db, "classes", classCode.toUpperCase(), "words");
      await addDoc(wordsCol, {
        word: wordText.toUpperCase(),
        hint: hint || "",
        category: category,
        teacherUid: this.currentUser.uid,
        createdAt: serverTimestamp()
      });
      return true;
    } catch (e) {
      console.error("addClassWord:", e);
      return false;
    }
  },

  async getClassWords(classCode) {
    if (!classCode) return [];
    try {
      const wordsCol = collection(db, "classes", classCode.toUpperCase(), "words");
      const q = query(wordsCol, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error("getClassWords:", e);
      return [];
    }
  },

  async deleteClassWord(classCode, wordId) {
    try {
      await deleteDoc(doc(db, "classes", classCode.toUpperCase(), "words", wordId));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  async deleteClass(classCode) {
    if (!this.currentUser || !classCode) return false;
    try {
      const code = classCode.toUpperCase();
      const wordsSnap = await getDocs(collection(db, "classes", code, "words"));
      for (const d of wordsSnap.docs) await deleteDoc(d.ref);

      const membersSnap = await getDocs(collection(db, "classes", code, "members"));
      for (const d of membersSnap.docs) {
         await deleteDoc(d.ref);
      }

      await deleteDoc(doc(db, "classes", code));
      return true;
    } catch (e) {
      console.error("deleteClass error:", e);
      return false;
    }
  },

  async removeMember(classCode, uid) {
    if (!this.currentUser || !classCode || !uid) return false;
    try {
      const code = classCode.toUpperCase();
      await deleteDoc(doc(db, "classes", code, "members", uid));
      return true;
    } catch (e) {
      console.error("removeMember error:", e);
      return false;
    }
  },

  // ── KİŞİSEL VERİ SYNC ─────────────────────────────────────────────────

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
      finalStats  = cloudStats ? cloudWinsStats(local.stats, cloudStats) : local.stats;

      const cloudBadges = cloudBadgesData?.unlocked || [];
      const cloudCounts = cloudBadgesData?.counts   || {};
      finalBadges = mergeBadges(local.badges, cloudBadges);
      finalCounts = { ...cloudCounts };
      for (const k in (local.badgeCounts || {})) {
        if (!finalCounts[k]) finalCounts[k] = local.badgeCounts[k];
      }

      const cloudMistakes = cloudMistakesData?.words || [];
      finalMistakes = mergeMistakes(local.mistakes, cloudMistakes);
    } else {
      finalStats    = local.stats;
      finalBadges   = local.badges || [];
      finalCounts   = local.badgeCounts || {};
      finalMistakes = local.mistakes || [];
    }

    await Promise.all([
      safeSet(userDoc(uid, "stats"),    finalStats),
      safeSet(userDoc(uid, "badges"),   { unlocked: finalBadges, counts: finalCounts }),
      safeSet(userDoc(uid, "mistakes"), { words: finalMistakes }),
      safeSet(userProfileDoc(uid),      {
        displayName: auth.currentUser?.displayName || "",
        email:       auth.currentUser?.email || "",
        photoURL:    auth.currentUser?.photoURL || "",
        lastSeen:    serverTimestamp()
      })
    ]);

    return { stats: finalStats, badges: finalBadges, badgeCounts: finalCounts, mistakes: finalMistakes };
  },

  async loadFromCloud(uid) {
    const [statsData, badgesData, mistakesData] = await Promise.all([
      safeGet(userDoc(uid, "stats")),
      safeGet(userDoc(uid, "badges")),
      safeGet(userDoc(uid, "mistakes"))
    ]);
    return {
      stats:       statsData,
      badges:      badgesData ? (badgesData.unlocked || []) : null,
      badgeCounts: badgesData ? (badgesData.counts   || {}) : null,
      mistakes:    mistakesData ? (mistakesData.words || []) : null
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
    await safeSet(userProfileDoc(uid), { savedGrade: gradeNum });
  }
};

// Global olarak eriş
window.FB = FB;

// Main.js'e hazır sinyali gönder
window.dispatchEvent(new CustomEvent("firebase-ready"));
