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

TURKISH_CASING_MAP = {
    "İSİ": "ISI",
    "İŞİK": "IŞIK",
    "YİLDİZ": "YILDIZ",
    "SİVİ": "SIVI",
    "KİLİF": "KILIF",
    "SİCAKLİK": "SICAKLIK",
    "YANSİMA": "YANSIMA",
    "YALİTKAN": "YALITKAN",
    "AKİSKANLİK": "AKIŞKANLIK",
    "KATİLİK": "KATILIK",
    "BASKİ": "BASKI",
    "YAKİN": "YAKIN",
    "YALNİZ": "YALNIZ",
    "İRKÇİLİK": "IRKÇILIK",
    "SİCAK": "SICAK",
    "İŞİ": "IŞI",
    "İSİTMA": "ISITMA",
    "İSİNMA": "ISINMA",
    "KİRİLMA": "KIRILMA",
    "KİRİLMASİ": "KIRILMASI",
    "BASİNÇ": "BASINÇ",
    "YANKİ": "YANKI",
    "İRAKSAK": "IRAKSAK",
    "AÇİ": "AÇI",
    "MİKNATİS": "MIKNATIS",
    "KATI": "KATI",
    "İSİL": "ISIL",
    "KİRİLMALİ": "KIRILMALI",
}

def to_tr_uppercase(text):
    if not text:
        return ""
    text = text.replace("i", "İ").replace("ı", "I").replace("ş", "Ş").replace("ç", "Ç").replace("ğ", "Ğ").replace("ü", "Ü").replace("ö", "Ö")
    return text.upper()

def clean_word(word, is_english):
    if not word:
        return ""
    if is_english:
        word = word.upper()
        word = word.replace("İ", "I").replace("ı", "I").replace("Ş", "S").replace("Ç", "C").replace("Ğ", "G").replace("Ü", "U").replace("Ö", "O")
    else:
        word = to_tr_uppercase(word)
        if word in TURKISH_CASING_MAP:
            word = TURKISH_CASING_MAP[word]
        else:
            for k, v in TURKISH_CASING_MAP.items():
                if k in word:
                    word = word.replace(k, v)
    word = word.replace("-", " ").replace("_", " ").replace("/", " ")
    if is_english:
        word = re.sub(r"[^A-Z ]", "", word)
    else:
        word = re.sub(r"[^A-ZÇĞİÖŞÜ ]", "", word)
    word = re.sub(r"\s+", " ", word).strip()
    return word

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
                return keys
    return []

api_keys = load_api_keys()
if not api_keys:
    print("Hata: API anahtari bulunamadi.")
    sys.exit(1)

client = genai.Client(api_key=api_keys[0])
working_model_name = "gemini-2.5-flash"
generate_config = types.GenerateContentConfig(response_mime_type="application/json")

CURRICULUM_INDEX_PATH = "curriculum_index.json"
if not os.path.exists(CURRICULUM_INDEX_PATH):
    CURRICULUM_INDEX_PATH = "../curriculum_index.json"

MEB_MASTER_PATH = "data/meb_master.json"
if not os.path.exists(MEB_MASTER_PATH):
    MEB_MASTER_PATH = "meb_master.json"

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
subjects_to_rebuild = ["matematik", "fen", "turkce", "hayat", "sosyal"]

print("\n====================================================")
print("     HEDEFLENEN VERİTABANI YENİDEN YAPILANDIRMA  ")
print("====================================================\n")

for grade_item in curriculum_index.get("curriculum", []):
    g_num = str(grade_item["grade"])
    grade_name = grade_item["gradeName"]
    master_grade_curriculum = meb_master.get(g_num, {})
    
    for subject in grade_item.get("subjects", []):
        subj_id = subject["id"]
        subj_name = subject["name"]
        data_file_rel = subject["dataFile"].replace("./", "")
        full_data_path = os.path.normpath(os.path.join(base_dir, data_file_rel))
        
        subj_type = get_subject_type(subj_id)
        if not subj_type:
            continue
            
        standard_units = master_grade_curriculum.get(subj_type, [])
        if not standard_units or not os.path.exists(full_data_path):
            continue
            
        with open(full_data_path, "r", encoding="utf-8") as f:
            subject_data = json.load(f)
            
        existing_units = subject_data.get("units", [])
        
        # Decide if this file needs processing
        # Option A: It is one of the scrambled subjects
        is_scrambled_subject = (subj_type in subjects_to_rebuild)
        
        # Option B: It has a unit with fewer than 50 words
        has_low_count = any(len(u.get("words", [])) < 50 for u in existing_units)
        
        # Option C: Unit count mismatch
        has_unit_mismatch = (len(existing_units) != len(standard_units))
        
        if not (is_scrambled_subject or has_low_count or has_unit_mismatch):
            continue
            
        print(f"\n>>> İŞLENİYOR: {grade_name} - {subj_name} ({data_file_rel})")
        new_units = []
        file_modified = False
        
        for std_u in standard_units:
            u_num = std_u["num"]
            u_name = std_u["name"]
            
            # Find matched existing unit
            matched_existing = None
            for u in existing_units:
                prefix = f"{u_num}."
                if u.get("name", "").startswith(prefix) or u.get("id", "").endswith(f"_u{u_num}"):
                    matched_existing = u
                    break
                    
            existing_words = matched_existing.get("words", []) if matched_existing else []
            existing_words_clean = []
            
            # Filter and clean existing words
            for w_entry in existing_words:
                w_word = clean_word(w_entry.get("word", ""), subj_type == "ingilizce")
                w_hint = w_entry.get("hint", "").strip()
                if w_word and len(w_word) >= 2 and w_hint:
                    existing_words_clean.append({"word": w_word, "hint": w_hint})
            
            # If the subject is not scrambled, and the count is already 50+, we can skip Gemini call!
            if not is_scrambled_subject and len(existing_words_clean) >= 50:
                print(f"  - Ünite {u_num}: {u_name} (ATLANDI - Mevcut: {len(existing_words_clean)} kelime)")
                new_units.append({
                    "id": f"{subj_id}_u{u_num}",
                    "name": u_name,
                    "months": std_u["months"],
                    "words": existing_words_clean
                })
                continue
                
            print(f"  - Ünite {u_num}: {u_name} (Mevcut: {len(existing_words_clean)} -> Gemini ile güncelleniyor...)")
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
                1. Bu kelime listesinden ÜNİTE İLE ALAKASIZ/DIŞINDA olan tüm İngilizce kelimeleri FİLTRELE ve SİL. 
                   Sadece '{u_name}' konusuyla doğrudan ilişkili olan kelimeleri tut.
                2. Kalan kelimeleri en az 52 kelimeye tamamlayacak şekilde yeni İngilizce kelimeler ve Türkçe ipuçları üret.
                
                ZORUNLU KURALLAR:
                - İngilizce kelimeler (word) tamamen İngilizce olmalı ve ASLA Türkçe karakter (Ç, Ğ, İ, Ö, Ş, Ü) içermemelidir.
                - Kelimeler tamamen BÜYÜK HARFLE yazılmalıdır.
                - Kelimelerde kesme işareti ('), tire (-), nokta (.), soru işareti (?) gibi noktalama işaretleri KESİNLİKLE YASAKTIR! (Örn: I'M yerine IM).
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
                2. Kalan kelimeleri en az 52 kelimeye tamamlayacak şekilde yeni Türkçe kelimeler ve Türkçe ipuçları üret.
                
                ZORUNLU KURALLAR:
                - Türkçe kelimeler (word) tamamen Türkçe büyük harf kurallarına uygun olmalıdır (Örn: ISI, IŞIK, YILDIZ, SICAKLIK, YANSIMA, YALITKAN, AKIŞKANLIK, KATILIK, BASKI, YAKIN, YALNIZ).
                  Asla mixed-vowel hatası (İSİ, İŞİK, YİLDİZ, SİCAKLİK vb.) yapma! Pay close attention to 'I' (dotless) vs 'İ' (dotted).
                - Kelimelerde kesme işareti ('), tire (-), nokta (.), soru işareti (?) gibi noktalama işaretleri KESİNLİKLE YASAKTIR!
                - Çıktı sadece JSON formatında olmalıdır.
                
                JSON Formatı:
                [{{"word": "ÖNERME", "hint": "Doğru ya da yanlış kesin hüküm bildiren cümle."}}, ...]
                """
                
            success = False
            retries = 3
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
                        
                        cleaned_w = clean_word(raw_w, is_english)
                        
                        if cleaned_w and len(cleaned_w) >= 2 and raw_h and cleaned_w not in seen:
                            cleaned_and_filled.append({"word": cleaned_w, "hint": raw_h})
                            seen.add(cleaned_w)
                            
                    print(f"    -> Temizlendi ve Dolduruldu: {len(cleaned_and_filled)} kelime.")
                    
                    new_units.append({
                        "id": f"{subj_id}_u{u_num}",
                        "name": u_name,
                        "months": std_u["months"],
                        "words": cleaned_and_filled
                    })
                    file_modified = True
                    success = True
                    time.sleep(4.5)
                    
                except Exception as e:
                    retries -= 1
                    print(f"    [HATA] {str(e)[:80]} | Yeniden deneniyor (Kalan: {retries})...")
                    time.sleep(8)
            
            if not success:
                # Fallback
                new_units.append({
                    "id": f"{subj_id}_u{u_num}",
                    "name": u_name,
                    "months": std_u["months"],
                    "words": existing_words_clean
                })
                print(f"    [UYARI] Gemini hatası sebebiyle mevcut kelimeler korundu.")
                
        if file_modified:
            subject_data["units"] = new_units
            with open(full_data_path, "w", encoding="utf-8") as f:
                json.dump(subject_data, f, ensure_ascii=False, indent=2)
            print(f"  [KAYDEDİLDİ] {grade_name} - {subj_name} güncellendi.")

print("\n====================================================")
print("İŞLEM TAMAMLANDI! Hedeflenen üniteler başarıyla yeniden yapılandırıldı.")
print("====================================================")
