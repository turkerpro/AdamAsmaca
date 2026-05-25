const REPO_OWNER = "turkerpro";
const REPO_NAME = "AdamAsmaca";

let indexData = null;
const gradeSelect = document.getElementById("grade-select");
const subjectSelect = document.getElementById("subject-select");
const logBox = document.getElementById("log-box");
const encodingSelect = document.getElementById("encoding-select");
const overwriteCheck = document.getElementById("overwrite-check");

function log(msg) {
  logBox.textContent += "\n> " + msg;
  logBox.scrollTop = logBox.scrollHeight;
}

// 1. Load index to populate dropdowns
async function loadIndex() {
  try {
    const res = await fetch("./curriculum_index.json");
    if (!res.ok) throw new Error("Index yüklenemedi");
    const data = await res.json();
    indexData = data.curriculum;
    
    gradeSelect.innerHTML = '<option value="">-- Sınıf Seçin --</option>';
    indexData.forEach((g, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = g.gradeName;
      gradeSelect.appendChild(opt);
    });
  } catch (err) {
    log("Hata: " + err.message);
  }
}

gradeSelect.addEventListener("change", () => {
  subjectSelect.innerHTML = '<option value="">-- Ders Seçin --</option>';
  if (gradeSelect.value === "") return;
  
  const grade = indexData[gradeSelect.value];
  grade.subjects.forEach((s, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = s.name;
    subjectSelect.appendChild(opt);
  });
});

// 2. Base64 UTF-8 Encoding
function utf8_to_b64(str) {
  return window.btoa(unescape(encodeURIComponent(str)));
}
function b64_to_utf8(str) {
  return decodeURIComponent(escape(window.atob(str)));
}

// Custom uppercase for Turkish characters to avoid 'i' becoming 'I' instead of 'İ'
function toTrUpperCase(str) {
  return str.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

// 3. Process CSV
document.getElementById("btn-submit").addEventListener("click", async () => {
  const token = document.getElementById("gh-token").value.trim();
  const fileInput = document.getElementById("csv-file");
  const gradeIdx = gradeSelect.value;
  const subjIdx = subjectSelect.value;
  const encoding = encodingSelect.value;

  if (!token) return log("Hata: Lütfen GitHub Güvenlik Anahtarını girin.");
  if (!gradeIdx || !subjIdx) return log("Hata: Sınıf ve ders seçimi yapın.");
  if (!fileInput.files.length) return log("Hata: Lütfen bir CSV dosyası seçin.");

  const file = fileInput.files[0];
  const subject = indexData[gradeIdx].subjects[subjIdx];
  const filePath = subject.dataFile.replace(/^\.\//, "");

  log(`İşlem başlatılıyor... Dosya okunuyor (${encoding})...`);

  // Read CSV
  const reader = new FileReader();
  reader.onload = async (e) => {
    const csvText = e.target.result;
    const newUnitsObj = parseCSV(csvText);
    if (!newUnitsObj) return;

    log(`${Object.keys(newUnitsObj).length} üniteye ait kelimeler bulundu.`);
    await pushToGitHub(token, filePath, newUnitsObj);
  };
  reader.readAsText(file, encoding);
});

function parseCSV(csv) {
  const lines = csv.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) {
    log("Hata: CSV dosyası boş veya başlık dışında veri yok.");
    return null;
  }
  
  // Skip header
  const dataLines = lines.slice(1);
  const unitsObj = {};

  dataLines.forEach((line, i) => {
    const cols = line.split(';');
    if (cols.length < 5) {
      log(`Uyarı: Satır ${i+2} atlandı (Eksik sütun).`);
      return;
    }
    const [uId, uName, monthsStr, word, hint] = cols.map(c => c.trim());
    
    if (!unitsObj[uId]) {
      const months = monthsStr.split(',').map(m => parseInt(m.trim())).filter(m => !isNaN(m));
      unitsObj[uId] = {
        id: uId,
        name: uName,
        months: months,
        words: []
      };
    }
    
    if (word && hint) {
      unitsObj[uId].words.push({ word: toTrUpperCase(word), hint: hint });
    }
  });
  
  return unitsObj;
}

// 4. GitHub API Logic
async function pushToGitHub(token, path, newUnitsObj) {
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  const headers = {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github.v3+json"
  };
  const isOverwrite = overwriteCheck.checked;

  try {
    log("Mevcut veritabanı GitHub'dan kontrol ediliyor...");
    let fileSha = null;
    let existingData = { units: [] };

    const getRes = await fetch(apiUrl, { headers });
    
    if (getRes.status === 200) {
      const getJson = await getRes.json();
      fileSha = getJson.sha;
      if (!isOverwrite) {
        const contentStr = b64_to_utf8(getJson.content);
        existingData = JSON.parse(contentStr);
        log("Mevcut veri başarıyla indirildi. Yeni veriler üzerine eklenecek.");
      } else {
        log("DİKKAT: Üzerine yazma seçili! Mevcut eski veriler siliniyor...");
      }
    } else if (getRes.status === 404) {
      log("Dosya ilk kez oluşturulacak.");
    } else {
      throw new Error("GitHub'a bağlanılamadı. Kod: " + getRes.status);
    }

    // Merge Data
    log("Veriler işleniyor...");
    if(!existingData.units) existingData.units = [];
    
    for (const uId in newUnitsObj) {
      const newU = newUnitsObj[uId];
      const exUnitIndex = existingData.units.findIndex(u => u.id === uId);
      
      if (exUnitIndex >= 0) {
        // Merge words
        const exUnit = existingData.units[exUnitIndex];
        exUnit.months = newU.months;
        
        newU.words.forEach(nw => {
          const wordExists = exUnit.words.some(ew => ew.word === nw.word);
          if(!wordExists) exUnit.words.push(nw);
        });
      } else {
        existingData.units.push(newU);
      }
    }

    const updatedJsonStr = JSON.stringify(existingData, null, 2);
    const updatedBase64 = utf8_to_b64(updatedJsonStr);

    log("GitHub'a yükleniyor (Push)...");
    
    const putBody = {
      message: isOverwrite ? "fix: Bozuk JSON üzerine yazıldı (Admin)" : "feat: Admin panelinden yeni sorular eklendi",
      content: updatedBase64,
      branch: "main"
    };
    if (fileSha) putBody.sha = fileSha;

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(putBody)
    });

    if (putRes.ok) {
      log("BAŞARILI! ✅ Yeni kelimeler sisteme eklendi.");
      log("Uygulamaya yansıması 1-2 dakikayı bulabilir.");
    } else {
      const errJson = await putRes.json();
      throw new Error(errJson.message || "Yükleme başarısız.");
    }
    
  } catch (err) {
    log("HATA: " + err.message);
  }
}

// Bismillah
loadIndex();
