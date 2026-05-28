import os
import json
import time
import sys
import re
from google import genai
from google.genai import types

# Standard Turkish casing mapping to fix mixed-vowel errors
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
    "İŞI": "IŞI",
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

def filter_working_keys(keys):
    print("API anahtarları doğrulanıyor...")
    working = []
    for idx, key in enumerate(keys):
        try:
            client = genai.Client(api_key=key)
            # Make a tiny request
            client.models.generate_content(
                model='gemini-2.5-flash',
                contents='Say OK',
                config=types.GenerateContentConfig(max_output_tokens=5)
            )
            print(f"  Key {idx+1}/{len(keys)} ({key[:10]}...): AKTİF")
            working.append(key)
        except Exception:
            # Silent ignore since we already ran diagnostics
            pass
    print(f"Toplam çalışan anahtar sayısı: {len(working)}")
    return working

def main():
    api_keys = load_api_keys()
    if not api_keys:
        print("Hata: api_keys.txt dosyası bulunamadı.")
        sys.exit(1)
        
    working_keys = filter_working_keys(api_keys)
    if not working_keys:
        print("Hata: Çalışan hiçbir API anahtarı bulunamadı.")
        sys.exit(1)
        
    cur_key_idx = 0
    client = genai.Client(api_key=working_keys[cur_key_idx])
    
    def rotate_key():
        nonlocal cur_key_idx, client
        if len(working_keys) < 2:
            return False
        cur_key_idx = (cur_key_idx + 1) % len(working_keys)
        client = genai.Client(api_key=working_keys[cur_key_idx])
        print(f"\n  [ANAHTAR ROTASYONU] -> {cur_key_idx+1}. çalışan anahtara geçildi ({working_keys[cur_key_idx][:10]}...)")
        return True

    CURRICULUM_INDEX_PATH = "curriculum_index.json"
    if not os.path.exists(CURRICULUM_INDEX_PATH):
        CURRICULUM_INDEX_PATH = "../curriculum_index.json"
        
    with open(CURRICULUM_INDEX_PATH, "r", encoding="utf-8") as f:
        curriculum_index = json.load(f)
        
    base_dir = os.path.dirname(CURRICULUM_INDEX_PATH)
    
    print("\n====================================================")
    print("      EKSİK VERİLERİ OTOMATİK TAMAMLAMA SÜRECİ      ")
    print("====================================================\n")
    
    generate_config = types.GenerateContentConfig(response_mime_type="application/json")
    
    for grade_item in curriculum_index.get("curriculum", []):
        g_num = str(grade_item["grade"])
        grade_name = grade_item["gradeName"]
        
        # Skip Past Exams (Grade 99) as it is already built offline
        if g_num == "99":
            continue
            
        for subject in grade_item.get("subjects", []):
            subj_id = subject["id"]
            subj_name = subject["name"]
            data_file_rel = subject["dataFile"].replace("./", "")
            full_data_path = os.path.normpath(os.path.join(base_dir, data_file_rel))
            
            if not os.path.exists(full_data_path):
                # If file doesn't exist, skip (should already exist as placeholders)
                continue
                
            with open(full_data_path, "r", encoding="utf-8") as f:
                try:
                    subject_data = json.load(f)
                except Exception as e:
                    print(f"  [HATA] Dosya okunurken hata oluştu: {full_data_path} ({e})")
                    continue
                    
            existing_units = subject_data.get("units", [])
            has_low_count = any(len(u.get("words", [])) < 50 for u in existing_units)
            
            if not has_low_count:
                continue
                
            print(f"\n>>> GÜNCELLENİYOR: {grade_name} - {subj_name} ({data_file_rel})")
            new_units = []
            file_modified = False
            
            for u in existing_units:
                u_name = u.get("name", "")
                u_id = u.get("id", "")
                u_months = u.get("months", [9, 10, 11, 12, 1, 2, 3, 4, 5, 6])
                existing_words = u.get("words", [])
                
                # Pre-clean existing words
                is_english = (subj_id.lower() == "ingilizce")
                cleaned_existing_words = []
                seen_words = set()
                
                for w_entry in existing_words:
                    w_word = clean_word(w_entry.get("word", ""), is_english)
                    w_hint = w_entry.get("hint", "").strip()
                    if w_word and len(w_word) >= 2 and w_hint and w_word not in seen_words:
                        cleaned_existing_words.append({"word": w_word, "hint": w_hint})
                        seen_words.add(w_word)
                
                # If already has 50+ clean words, skip Gemini generation
                if len(cleaned_existing_words) >= 50:
                    print(f"  - Ünite '{u_name}': TAM (Mevcut: {len(cleaned_existing_words)} kelime)")
                    new_units.append({
                        "id": u_id,
                        "name": u_name,
                        "months": u_months,
                        "words": cleaned_existing_words
                    })
                    continue
                    
                print(f"  - Ünite '{u_name}': EKSİK (Mevcut: {len(cleaned_existing_words)} -> Dolduruluyor...)")
                existing_json_str = json.dumps(cleaned_existing_words, ensure_ascii=False)
                
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
                retries = len(working_keys) * 2 # Allow retrying each key twice
                
                while retries > 0 and not success:
                    try:
                        response = client.models.generate_content(
                            model='gemini-2.5-flash',
                            contents=prompt,
                            config=generate_config
                        )
                        res_text = response.text.strip()
                        if res_text.startswith("```json"):
                            res_text = res_text[7:]
                        if res_text.endswith("```"):
                            res_text = res_text[:-3]
                        res_text = res_text.strip()
                        
                        generated_words = json.loads(res_text)
                        cleaned_and_filled = []
                        seen = set()
                        
                        for w in generated_words:
                            raw_w = w.get("word", "").strip()
                            raw_h = w.get("hint", "").strip()
                            
                            cleaned_w = clean_word(raw_w, is_english)
                            
                            if cleaned_w and len(cleaned_w) >= 2 and raw_h and cleaned_w not in seen:
                                cleaned_and_filled.append({"word": cleaned_w, "hint": raw_h})
                                seen.add(cleaned_w)
                                
                        if len(cleaned_and_filled) < 48:
                            # If Gemini returned too few words, treat as failure to retry or fill more
                            raise ValueError(f"Gemini returned only {len(cleaned_and_filled)} valid words.")
                            
                        print(f"    -> Temizlendi ve Dolduruldu: {len(cleaned_and_filled)} kelime.")
                        
                        new_units.append({
                            "id": u_id,
                            "name": u_name,
                            "months": u_months,
                            "words": cleaned_and_filled
                        })
                        file_modified = True
                        success = True
                        # Sleep 4.5 seconds to stay below the 15 RPM rate limit (1 request every 4 seconds)
                        time.sleep(4.5)
                        
                    except Exception as e:
                        retries -= 1
                        err_msg = str(e)
                        print(f"    [HATA] {err_msg[:90]} | Kalan Deneme: {retries}")
                        
                        # If it's a quota/rate limit error, rotate key immediately
                        is_quota = any(kw in err_msg.lower() for kw in ["429", "quota", "exhausted", "limit", "rate"])
                        if is_quota:
                            rotate_key()
                        
                        # Wait a bit longer on error
                        time.sleep(6)
                
                if not success:
                    # Fallback to keeping existing cleaned words
                    new_units.append({
                        "id": u_id,
                        "name": u_name,
                        "months": u_months,
                        "words": cleaned_existing_words
                    })
                    print(f"    [UYARI] Gemini hatası sebebiyle üniteye işlem yapılamadı, mevcut kelimeler korundu.")
            
            if file_modified:
                subject_data["units"] = new_units
                with open(full_data_path, "w", encoding="utf-8") as f:
                    json.dump(subject_data, f, ensure_ascii=False, indent=2)
                print(f"  [KAYDEDİLDİ] {grade_name} - {subj_name} dosyası başarıyla güncellendi.")
                
    print("\n====================================================")
    print("İŞLEM TAMAMLANDI! Tüm eksik üniteler dolduruldu.")
    print("====================================================")

if __name__ == '__main__':
    main()
