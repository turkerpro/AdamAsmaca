import os
import json
import time
import sys
import re

# Add google-genai library import
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Hata: 'google-genai' kutuphanesi yuklu degil.")
    sys.exit(1)

def to_tr_uppercase(text):
    if not text:
        return ""
    # Standard Turkish uppercase rules
    text = text.replace("i", "İ").replace("ı", "I").replace("ş", "Ş").replace("ç", "Ç").replace("ğ", "Ğ").replace("ü", "Ü").replace("ö", "Ö")
    return text.upper()

def load_api_keys():
    keys = []
    for path in ["api_keys.txt", "data/api_keys.txt", "../api_keys.txt"]:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    k = line.strip()
                    if k and not k.startswith("#"):
                        keys.append(k)
            if keys:
                print(f"[SISTEM] {len(keys)} adet API anahtari yuklendi.")
                return keys
    return []

api_keys = load_api_keys()
if not api_keys:
    print("Hata: API anahtari bulunamadi.")
    sys.exit(1)

current_key_index = 0
client = genai.Client(api_key=api_keys[0])

def rotate_key():
    global current_key_index, client
    if len(api_keys) <= 1:
        return False
    current_key_index = (current_key_index + 1) % len(api_keys)
    client = genai.Client(api_key=api_keys[current_key_index])
    print(f"  [ANAHTAR] -> Indeks {current_key_index} anahtarina gecildi.")
    return True

# Detect working GenAI model
working_model_name = None
test_models = ["gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash-8b", "gemini-1.5-flash"]
for model_name in test_models:
    try:
        client.models.generate_content(model=model_name, contents="test")
        working_model_name = model_name
        print(f"[SISTEM] Kullanilacak model: {working_model_name}")
        break
    except Exception as e:
        rotate_key()

if not working_model_name:
    print("Hata: Calisir GenAI modeli bulunamadi.")
    sys.exit(1)

generate_config = types.GenerateContentConfig(response_mime_type="application/json")

# Load curriculum index and meb master mapping
CURRICULUM_INDEX_PATH = "curriculum_index.json"
if not os.path.exists(CURRICULUM_INDEX_PATH):
    CURRICULUM_INDEX_PATH = "../curriculum_index.json"
if not os.path.exists(CURRICULUM_INDEX_PATH):
    print("Hata: curriculum_index.json bulunamadı.")
    sys.exit(1)

MEB_MASTER_PATH = "data/meb_master.json"
if not os.path.exists(MEB_MASTER_PATH):
    MEB_MASTER_PATH = "meb_master.json"
if not os.path.exists(MEB_MASTER_PATH):
    print("Hata: meb_master.json bulunamadı.")
    sys.exit(1)

with open(CURRICULUM_INDEX_PATH, "r", encoding="utf-8") as f:
    curriculum_index = json.load(f)

with open(MEB_MASTER_PATH, "r", encoding="utf-8") as f:
    meb_master = json.load(f)

def get_subject_type(subj_id):
    s = subj_id.lower()
    for key in ["matematik", "turkce", "edebiyat", "hayat", "fen", "fizik", "kimya", "biyoloji", "sosyal", "tarih", "cografya", "inkilap", "ingilizce"]:
        if key in s:
            return key
    return None

base_dir = os.path.dirname(CURRICULUM_INDEX_PATH)

print("\n====================================================")
print("       VERİTABANI TEMİZLEME VE YENİDEN YAPILANDIRMA  ")
print("====================================================\n")

for grade_item in curriculum_index.get("curriculum", []):
    g_num = str(grade_item["grade"])
    grade_name = grade_item["gradeName"]
    
    # 1. Sınıf Görsel Sanatlar, Müzik, Oyun ve Fiziki gibi özel dosyaları skip edebiliriz
    # Veya meb_master'da tanımlı olmayanları koruyabiliriz
    master_grade_curriculum = meb_master.get(g_num, {})
    
    for subject in grade_item.get("subjects", []):
        subj_id = subject["id"]
        subj_name = subject["name"]
        data_file_rel = subject["dataFile"].replace("./", "")
        full_data_path = os.path.join(base_dir, data_file_rel)
        
        subj_type = get_subject_type(subj_id)
        if not subj_type:
            continue
            
        standard_units = master_grade_curriculum.get(subj_type, [])
        if not standard_units:
            print(f"  [ATLANITOR] {grade_name} - {subj_name} (Özel Ders veya Tanımsız)")
            continue
            
        if not os.path.exists(full_data_path):
            print(f"  [HATA] Dosya bulunamadı: {full_data_path}")
            continue
            
        print(f"\n>>> İşleniyor: {grade_name} - {subj_name} ({data_file_rel})")
        
        with open(full_data_path, "r", encoding="utf-8") as f:
            subject_data = json.load(f)
            
        existing_units = subject_data.get("units", [])
        new_units = []
        modified = False
        
        for std_u in standard_units:
            u_num = std_u["num"]
            u_name = std_u["name"]
            
            # Find matched existing unit in the JSON
            # We look for a unit with the same number or name prefix
            matched_existing = None
            for u in existing_units:
                # check if u name starts with "u_num. Ünite:" or "Unit u_num:" or similar
                prefix = f"{u_num}."
                if u.get("name", "").startswith(prefix) or u.get("id", "").endswith(f"_u{u_num}"):
                    matched_existing = u
                    break
            
            existing_words = matched_existing.get("words", []) if matched_existing else []
            existing_words_clean = []
            
            # Pre-filter existing words to remove wrong casing (e.g. İSİ, İŞİK, YİLDİZ) and punctuation
            for w_entry in existing_words:
                w_word = w_entry.get("word", "").strip()
                w_hint = w_entry.get("hint", "").strip()
                
                # Filter out obvious casing bugs and punctuation
                if not w_word or not w_hint:
                    continue
                if w_word in ["İSİ", "İŞİK", "İRAKSAK", "YİLDİZ", "SİCAKLİK", "YANSİMA", "YALİTKAN", "AKİSKANLİK", "KATİLİK", "BASKİ", "YAKİN", "YALNİZ", "İRKÇİLİK"]:
                    continue
                if "'" in w_word or "-" in w_word or "?" in w_word or "." in w_word:
                    continue
                existing_words_clean.append(w_entry)
            
            print(f"  - Ünite {u_num}: {u_name} (Mevcut Temiz Kelime: {len(existing_words_clean)})")
            
            # Ask Gemini to clean and fill the unit
            is_english = (subj_type == "ingilizce")
            existing_json_str = json.dumps(existing_words_clean, ensure_ascii=False)
            
            if is_english:
                prompt = f"""
                Sen eğitim odaklı bir İngilizce kelime uzmanısın.
                Sınıf Seviyesi: {grade_name}
                Ders: {subj_name}
                Ünite: {u_name}
                
                Sana bu üniteye ait olduğu iddia edilen mevcut kelime listesini veriyorum:
                {existing_json_str}
                
                GÖREVİN:
                1. Bu kelime listesinden ÜNİTE İLE ALAKASIZ/DIŞINDA olan (veya çok basit/childish kalan) tüm İngilizce kelimeleri FİLTRELE ve SİL. 
                   Sadece '{u_name}' konusuyla doğrudan ilişkili olan kelimeleri tut.
                2. Kalan kelimeleri en az 50 (hedef 52) kelimeye tamamlayacak şekilde yeni İngilizce kelimeler ve Türkçe ipuçları üret.
                
                ZORUNLU KURALLAR:
                - İngilizce kelimeler (word) tamamen İngilizce olmalı ve ASLA Türkçe karakter (Ç, Ğ, İ, Ö, Ş, Ü) içermemelidir.
                - Kelimeler tamamen BÜYÜK HARFLE yazılmalıdır.
                - Kelimelerde kesme işareti ('), tire (-), nokta (.), soru işareti (?) gibi noktalama işaretleri KESİNLİKLE YASAKTIR! (Örn: I'm yerine IM, ya da bu tarz kısaltmaları hiç üretme).
                - İpuçları (hint) TÜRKÇE olmalıdır.
                - Çıktı sadece JSON formatında olmalıdır.
                
                JSON Formatı:
                [{{"word": "FRIEND", "hint": "Arkadaş, dost"}}, ...]
                """
            else:
                prompt = f"""
                Sen eğitim odaklı bir Türkçe kelime ve öğretim uzmanısın.
                Sınıf Seviyesi: {grade_name}
                Ders: {subj_name}
                Ünite: {u_name}
                
                Sana bu üniteye ait olduğu iddia edilen mevcut kelime listesini veriyorum:
                {existing_json_str}
                
                GÖREVİN:
                1. Bu kelime listesinden ÜNİTE İLE ALAKASIZ/DIŞINDA olan tüm Türkçe kelimeleri FİLTRELE ve SİL.
                   Sadece '{u_name}' konusuyla doğrudan ilişkili olan kelimeleri tut.
                2. Kalan kelimeleri en az 50 (hedef 52) kelimeye tamamlayacak şekilde yeni Türkçe kelimeler ve Türkçe ipuçları üret.
                
                ZORUNLU KURALLAR:
                - Türkçe kelimeler (word) tamamen Türkçe büyük harf kurallarına uygun olmalıdır (Örn: ISI, IŞIK, YILDIZ, SICAKLIK, YANSIMA, YALITKAN, AKIŞKANLIK, KATILIK, BASKI, YAKIN, YALNIZ).
                  Asla mixed-vowel hatası (İSİ, İŞİK, YİLDİZ, SİCAKLİK vb.) yapma!
                - Kelimelerde kesme işareti ('), tire (-), nokta (.), soru işareti (?) gibi noktalama işaretleri KESİNLİKLE YASAKTIR!
                - Çıktı sadece JSON formatında olmalıdır.
                
                JSON Formatı:
                [{{"word": "ÖNERME", "hint": "Doğru ya da yanlış kesin hüküm bildiren cümle."}}, ...]
                """
            
            success = False
            retries = 10
            while retries > 0 and not success:
                try:
                    response = client.models.generate_content(
                        model=working_model_name,
                        contents=prompt,
                        config=generate_config
                    )
                    res_text = response.text.strip()
                    if res_text.startswith("```json"):
                        res_text = res_text[7:]
                    if res_text.endswith("```"):
                        res_text = res_text[:-3]
                    res_text = res_text.strip()
                    
                    new_words = json.loads(res_text)
                    cleaned_and_filled = []
                    seen = set()
                    
                    for w in new_words:
                        raw_w = w.get("word", "").strip()
                        raw_h = w.get("hint", "").strip()
                        
                        # Apply strict uppercase
                        if is_english:
                            w_upper = raw_w.upper()
                        else:
                            w_upper = to_tr_uppercase(raw_w)
                            
                        # Clean punctuation just in case
                        w_upper = re.sub(r"[^A-ZÇĞİÖŞÜ ]", "", w_upper).strip()
                        
                        if w_upper and raw_h and w_upper not in seen:
                            cleaned_and_filled.append({"word": w_upper, "hint": raw_h})
                            seen.add(w_upper)
                            
                    print(f"    -> Temizlendi ve Dolduruldu: {len(cleaned_and_filled)} kelime.")
                    
                    new_units.append({
                        "id": f"{subj_id}_u{u_num}",
                        "name": u_name,
                        "months": std_u["months"],
                        "words": cleaned_and_filled
                    })
                    modified = True
                    success = True
                    time.sleep(3.5)
                    
                except Exception as e:
                    err_msg = str(e)
                    is_quota = any(kw in err_msg.lower() for kw in ["429", "403", "quota", "exhausted", "limit"])
                    if is_quota:
                        rotate_key()
                    retries -= 1
                    print(f"    [HATA] {err_msg[:80]} | Yeniden deneniyor (Kalan: {retries})...")
                    time.sleep(8)
            
            if not success:
                # fallback to keeping existing cleaned words
                new_units.append({
                    "id": f"{subj_id}_u{u_num}",
                    "name": u_name,
                    "months": std_u["months"],
                    "words": existing_words_clean
                })
                print(f"    [UYARI] Gemini hatası sebebiyle mevcut kelimeler korundu.")
                
        if modified:
            subject_data["units"] = new_units
            with open(full_data_path, "w", encoding="utf-8") as f:
                json.dump(subject_data, f, ensure_ascii=False, indent=2)
            print(f"  [KAYDEDİLDİ] {grade_name} - {subj_name} güncellendi.")

print("\n====================================================")
print("İŞLEM TAMAMLANDI! Tüm veritabanı temizlendi ve MEB ile uyumlu hale getirildi.")
print("====================================================")
