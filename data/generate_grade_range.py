import os
import json
import time
import sys

# =============================================
# PARAMETRE: Hangi sinif araligini isleyecegiz?
# Komut satirindan: python generate_grade_range.py 1 3
# =============================================
if len(sys.argv) < 3:
    print("Kullanim: python generate_grade_range.py <baslangic_sinif> <bitis_sinif> [key_start] [key_end]")
    sys.exit(1)

GRADE_START = int(sys.argv[1])
GRADE_END   = int(sys.argv[2])
KEY_START   = int(sys.argv[3]) if len(sys.argv) > 3 else 0
KEY_END     = int(sys.argv[4]) if len(sys.argv) > 4 else None  # None = hepsini kullan

def to_tr_uppercase(text):
    if not text:
        return ""
    return text.replace("\u0130\u0307", "\u0130").replace("i", "\u0130").replace("\u0131", "I").upper()

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Hata: 'google-genai' kutuphanesi yuklu degil.")
    sys.exit(1)

def load_api_keys():
    keys = []
    for path in ["api_keys.txt", "../api_keys.txt"]:
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

all_keys = load_api_keys()
if not all_keys:
    print("Hata: API anahtari bulunamadi.")
    sys.exit(1)

# Her ajan farkli bir anahtar dilimini kullaniyor
if KEY_END is None:
    KEY_END = len(all_keys)
api_keys = all_keys[KEY_START:KEY_END]
if not api_keys:
    api_keys = all_keys  # fallback

print(f"[AJAN] Sinif araligi: {GRADE_START}-{GRADE_END} | Anahtar dilimi: {KEY_START}-{KEY_END} ({len(api_keys)} anahtar)")

current_key_index = 0
client = genai.Client(api_key=api_keys[0])

def rotate_key():
    global current_key_index, client
    if len(api_keys) <= 1:
        return False
    current_key_index = (current_key_index + 1) % len(api_keys)
    client = genai.Client(api_key=api_keys[current_key_index])
    print(f"  [ANAHTAR] -> Indeks {KEY_START + current_key_index} anahtarina gecildi.")
    return True

# Model testi
working_model_name = None
test_models = ["gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash-8b", "gemini-1.5-flash"]
attempts = 0
while not working_model_name and attempts < len(api_keys) * len(test_models):
    for model_name in test_models:
        try:
            client.models.generate_content(model=model_name, contents="test")
            working_model_name = model_name
            print(f"[SISTEM] Kullanilacak model: {working_model_name}")
            break
        except Exception as e:
            err = str(e)
            if "404" in err or "not found" in err.lower():
                continue
            attempts += 1
            rotate_key()
            time.sleep(1)
            break
    if working_model_name:
        break

if not working_model_name:
    print("Hata: Calisir model bulunamadi.")
    sys.exit(1)

generate_config = types.GenerateContentConfig(response_mime_type="application/json")

CURRICULUM_INDEX_PATH = "../curriculum_index.json"
if not os.path.exists(CURRICULUM_INDEX_PATH):
    CURRICULUM_INDEX_PATH = "curriculum_index.json"

with open(CURRICULUM_INDEX_PATH, "r", encoding="utf-8") as f:
    curriculum_data = json.load(f)

total_generated = 0
GRADE_LABEL_MAP = {i: f"{i}. S\u0131n\u0131f" for i in range(1, 13)}
TARGET_GRADES = set(f"{i}. S\u0131n\u0131f" for i in range(GRADE_START, GRADE_END + 1))

print(f"\n{'='*50}")
print(f"HEDEF SINIFLAR: {', '.join(sorted(TARGET_GRADES))}")
print(f"{'='*50}\n")

for grade_item in curriculum_data.get("curriculum", []):
    grade_name = grade_item.get("gradeName")
    if grade_name not in TARGET_GRADES:
        continue

    print(f"\n>>> {grade_name} taranıyor...")

    for subject in grade_item.get("subjects", []):
        subj_name = subject.get("name")
        data_file_path = subject.get("dataFile")
        base_dir = os.path.dirname(CURRICULUM_INDEX_PATH)
        full_data_path = os.path.join(base_dir, data_file_path.replace("./", ""))

        if not os.path.exists(full_data_path):
            print(f"  [UYARI] Dosya bulunamadı: {full_data_path}")
            continue

        with open(full_data_path, "r", encoding="utf-8") as f:
            subject_data = json.load(f)

        modified = False
        for unit in subject_data.get("units", []):
            unit_name = unit.get("name")
            words_list = unit.get("words", [])
            current_count = len(words_list)

            if current_count >= 50:
                print(f"  - {subj_name} / {unit_name}: {current_count} soru var (Atlanıyor).")
                continue

            needed = 50 - current_count
            print(f"  - {subj_name} / {unit_name}: Mevcut={current_count}, Eksik={needed}. Uretiliyor...")

            existing_words = [w.get("word") for w in words_list]
            is_english = "ingilizce" in data_file_path.lower()

            if is_english:
                prompt = f"""
                Sen eğitim odaklı bir İngilizce kelime ve Türkçe ipucu üreticisisin.
                Sınıf Seviyesi: {grade_name}
                Ünite: {unit_name}

                Bu ünite ve sınıf seviyesine uygun en az {needed} adet farklı kelime çifti üret.
                
                ZORUNLU KURALLAR:
                1. "word" ALANI KESİNLİKLE İNGİLİZCE bir kelime veya kelime öbeği olmalıdır. (Türkçe OLAMAZ!)
                2. "hint" ALANI bu İngilizce kelimenin TÜRKÇE çevirisi/açıklaması olmalıdır.
                3. Şu mevcut kelimelerden FARKLI olmalıdır: {", ".join(existing_words)}
                4. Çıktı SADECE JSON dizisi formatında olmalıdır.
                
                JSON Örneği:
                [{{"word": "APPLE", "hint": "Elma - kırmızı veya yeşil tatlı bir meyve"}}, {{"word": "FRIENDSHIP", "hint": "Arkadaşlık, dostluk"}}]
                """
            else:
                prompt = f"""
                Sen eğitim odaklı bir Türkçe kelime ve soru üreticisisin.
                Sınıf Seviyesi: {grade_name}
                Ders: {subj_name}
                Ünite: {unit_name}

                Bu ünite ve sınıf seviyesine uygun en az {needed} adet farklı Türkçe kelime ve bunlara uygun eğitici ipuçları üret.
                
                ZORUNLU KURALLAR:
                1. Şu mevcut kelimelerden FARKLI olmalıdır: {", ".join(existing_words)}
                2. Her nesne "word" ve "hint" içermelidir.
                3. İpuçları kısa, açıklayıcı ve yaş grubuna uygun olmalıdır.
                4. Çıktı SADECE JSON dizisi formatında olmalıdır.
                
                JSON Şeması:
                [{{"word": "KÜTLE", "hint": "Madde miktarının ölçüsü"}}, ...]
                """

            retries = 15
            success = False
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

                    new_questions = json.loads(res_text)
                    added = 0
                    for q in new_questions:
                        raw_word = q.get("word", "").strip()
                        w_word = raw_word.upper() if is_english else to_tr_uppercase(raw_word)
                        w_hint = q.get("hint", "").strip()
                        if w_word and w_hint and w_word not in existing_words:
                            words_list.append({"word": w_word, "hint": w_hint})
                            existing_words.append(w_word)
                            added += 1

                    print(f"    -> {added} yeni soru eklendi (Toplam: {len(words_list)}).")
                    modified = True
                    success = True
                    total_generated += added
                    time.sleep(3)

                except Exception as e:
                    err_msg = str(e)
                    is_quota_or_auth = any(kw in err_msg.lower() for kw in ["429", "403", "quota", "exhausted", "invalid", "limit"])
                    is_server_error = any(kw in err_msg for kw in ["503", "500", "UNAVAILABLE"])

                    if is_quota_or_auth:
                        if rotate_key():
                            time.sleep(2)
                            continue
                    
                    retries -= 1
                    wait_time = 15 if is_server_error else 8
                    print(f"    [HATA] {err_msg[:80]}... | Kalan={retries} | {wait_time}s bekleniyor...")
                    time.sleep(wait_time)

            if not success:
                print(f"    [UYARI] {unit_name} icin soru uretilemedi, devam ediliyor.")

        if modified:
            with open(full_data_path, "w", encoding="utf-8") as f:
                json.dump(subject_data, f, ensure_ascii=False, indent=2)
            print(f"  [KAYDEDILDI] {subj_name} guncellendi.")

print(f"\n{'='*50}")
print(f"TAMAMLANDI! Toplam {total_generated} yeni soru eklendi.")
print(f"{'='*50}")
