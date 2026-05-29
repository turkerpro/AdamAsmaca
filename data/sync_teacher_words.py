import os
import re
import urllib.request
import csv
import json
import codecs

# Normalization maps equivalent to main.js javascript functions
def extract_grade_number(grade_str):
    if not grade_str:
        return None
    if "Çıkmış" in grade_str or "Sınav" in grade_str:
        return 99
    match = re.search(r'\d+', grade_str)
    return int(match.group(0)) if match else None

def normalize_subject(subj_str):
    if not subj_str:
        return ""
    s = subj_str.lower().strip()
    if "türkçe" in s or "turkce" in s:
        return "turkce"
    if "hayat" in s:
        return "hayat"
    if "matematik" in s:
        return "matematik"
    if "fen" in s:
        return "fen"
    if "ingilizce" in s or "english" in s:
        return "ingilizce"
    if "din" in s:
        return "din"
    if "sosyal" in s:
        return "sosyal"
    if "inkılap" in s or "inkilap" in s:
        return "inkilap"
    if "bilişim" in s or "bilisim" in s:
        return "bilisim"
    if "edebiyat" in s:
        return "edebiyat"
    if "fizik" in s:
        return "fizik"
    if "kimya" in s:
        return "kimya"
    if "biyoloji" in s:
        return "biyoloji"
    if "tarih" in s:
        return "tarih"
    if "coğrafya" in s or "cografya" in s:
        return "cografya"
    if "felsefe" in s:
        return "felsefe"
    if "lgs" in s:
        return "lgs"
    if "yks" in s:
        return "yks"
    if "kpss" in s:
        return "kpss"
    if "görsel" in s or "gorsel" in s:
        return "gorselsanat"
    if "müzik" in s or "muzik" in s:
        return "muzik"
    if "beden" in s or "spor" in s:
        return "bedenegitimi"
    if "oyun" in s or "fiziki" in s:
        return "oyunfiziki"
    if "sağlık" in s or "saglik" in s:
        return "saglik"
    if "rehberlik" in s:
        return "rehberlik"
    return s

def to_tr_upper(s):
    if not s:
        return ""
    # Map Turkish lowercase chars before standard upper
    mapped = s.replace('i', 'İ').replace('ı', 'I')
    return mapped.upper()

def main():
    print("=== ÖĞRETMEN KELİMELERİ SENKRONİZASYON ARACI ===")
    
    # 1. Read main.js to extract TEACHER_WORDS_CSV_URL
    main_js_path = os.path.join(os.getcwd(), "main.js")
    if not os.path.exists(main_js_path):
        print("Hata: main.js bulunamadı! Lütfen proje kök dizininde çalıştırın.")
        return
        
    with open(main_js_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    match = re.search(r'const\s+TEACHER_WORDS_CSV_URL\s*=\s*["\'](.*?)["\']', content)
    if not match or not match.group(1):
        print("Uyarı: main.js içinde TEACHER_WORDS_CSV_URL tanımlı değil veya boş.")
        print("Eşitleme yapabilmek için lütfen E-Tablo CSV linkinizi main.js'e ekleyin.")
        return
        
    csv_url = match.group(1)
    print(f"Bağlantı kuruluyor: {csv_url}")
    
    # 2. Fetch CSV
    try:
        req = urllib.request.Request(
            csv_url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            csv_data = response.read().decode('utf-8')
    except Exception as e:
        print(f"Hata: Google Sheet verisi indirilemedi. Bağlantıyı kontrol edin: {e}")
        return
        
    # 3. Parse CSV rows
    reader = csv.reader(csv_data.splitlines())
    rows = list(reader)
    if len(rows) < 2:
        print("Formda henüz hiçbir kelime girilmemiş veya başlık satırı eksik.")
        return
        
    # 4. Load curriculum index
    index_path = os.path.join(os.getcwd(), "curriculum_index.json")
    if not os.path.exists(index_path):
        print("Hata: curriculum_index.json bulunamadı.")
        return
        
    with open(index_path, "r", encoding="utf-8") as f:
        curriculum = json.load(f).get("curriculum", [])
        
    # Map index data for easy lookup: (grade, subjectId) -> file_path
    db_map = {}
    for grade_item in curriculum:
        g = grade_item.get("grade")
        for subj_item in grade_item.get("subjects", []):
            s_id = subj_item.get("id")
            data_file = subj_item.get("dataFile", "").replace("./", "")
            if g is not None and s_id and data_file:
                db_map[(g, s_id)] = data_file

    print(f"Form yanıtlarından {len(rows) - 1} satır okundu. Eşleştirme yapılıyor...")
    
    added_count = 0
    updated_files = set()
    
    # Cache loaded JSON databases to avoid repeated disk reads/writes
    loaded_dbs = {}
    
    for idx, row in enumerate(rows[1:], start=1):
        if len(row) < 9:
            continue
            
        grade_val = extract_grade_number(row[4])
        subj_val = normalize_subject(row[5])
        unit_name = row[6].strip() if row[6] else ""
        word_val = to_tr_upper(row[7].strip()) if row[7] else ""
        hint_val = row[8].strip() if row[8] else ""
        
        if not (grade_val and subj_val and unit_name and word_val and hint_val):
            continue
            
        # Find JSON path
        db_key = (grade_val, subj_val)
        if db_key not in db_map:
            print(f"Uyarı: Satır {idx} atlandı. {grade_val}. Sınıf ve '{subj_val}' dersi için JSON dosyası bulunamadı.")
            continue
            
        file_path = db_map[db_key]
        
        # Load file into cache if not already loaded
        if file_path not in loaded_dbs:
            if os.path.exists(file_path):
                with open(file_path, "r", encoding="utf-8") as f:
                    try:
                        loaded_dbs[file_path] = json.load(f)
                    except Exception:
                        loaded_dbs[file_path] = {"units": []}
            else:
                loaded_dbs[file_path] = {"units": []}
                
        db_data = loaded_dbs[file_path]
        if "units" not in db_data:
            db_data["units"] = []
            
        # Find or create unit
        units = db_data["units"]
        target_unit = None
        for u in units:
            if u.get("name", "").lower().replace(" ", "") == unit_name.lower().replace(" ", ""):
                target_unit = u
                break
                
        if not target_unit:
            # Create new unit
            unit_id = f"unit_{len(units) + 1}"
            target_unit = {
                "id": unit_id,
                "name": unit_name,
                "months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                "words": []
            }
            units.append(target_unit)
            
        # Check if word already exists in unit
        word_list = target_unit.get("words", [])
        exists = any(w.get("word") == word_val for w in word_list)
        if not exists:
            word_list.append({
                "word": word_val,
                "hint": hint_val
            })
            added_count += 1
            updated_files.add(file_path)
            
    # Write back modified files
    for file_path, data in loaded_dbs.items():
        if file_path in updated_files:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Güncellendi: {file_path}")
            
    print("--------------------------------------------------")
    print(f"BAŞARILI! Toplam {added_count} yeni kelime yerel veritabanına kalıcı olarak işlendi.")
    print("Değişikliklerin oyuna yansıması için projeyi build edin ve pushlayın.")

if __name__ == "__main__":
    main()
