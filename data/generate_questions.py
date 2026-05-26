import os
import json
import time
import sys

def to_tr_uppercase(text):
    if not text:
        return ""
    maps = {
        'i': 'İ', 'ı': 'I', 'ğ': 'Ğ',
        'ü': 'Ü', 'ş': 'Ş', 'ö': 'Ö', 'ç': 'Ç'
    }
    res = []
    for char in text.lower():
        res.append(maps.get(char, char.upper()))
    return "".join(res)

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Hata: 'google-genai' kütüphanesi yüklü değil.")
    print("Lütfen terminalde 'pip install google-genai' komutunu çalıştırın.")
    sys.exit(1)

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("====================================================")
    print("           GEMINI SORU ÜRETME SİSTEMİ               ")
    print("====================================================")
    print("Lütfen Google AI Studio'dan aldığınız ücretsiz API anahtarını girin.")
    api_key = input("API Key: ").strip()

if not api_key:
    print("Hata: API anahtarı boş bırakılamaz.")
    sys.exit(1)

# Yeni SDK: Client nesnesi oluştur
client = genai.Client(api_key=api_key)

# Kullanılabilir modelleri listele ve çalışanı bul
print("Kullanılabilir yapay zeka modelleri test ediliyor...")
available_models = []
try:
    for m in client.models.list():
        if hasattr(m, 'name'):
            model_id = m.name.replace("models/", "")
            available_models.append(model_id)
except Exception as e:
    print(f"[UYARI] Modeller listelenemedi (Hata: {str(e)})")
    # Güncel fallback modeller
    available_models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]

def model_priority(model_name):
    name = model_name.lower()
    if "gemini-2.5-flash-lite" in name: return 0
    if "gemini-2.5-flash" in name: return 1
    if "gemini-2.0-flash" in name: return 2
    if "gemini-2.5-pro" in name: return 3
    return 99

available_models.sort(key=model_priority)

working_model_name = None
for model_name in available_models:
    print(f"Deneniyor: {model_name}...")
    try:
        test_response = client.models.generate_content(
            model=model_name,
            contents="test"
        )
        working_model_name = model_name
        print(f"-> Başarılı! Kullanılacak model: {working_model_name}")
        break
    except Exception as e:
        print(f"-> Başarısız (Hata: {str(e)})")

if not working_model_name:
    print("Hata: Çalışan hiçbir model bulunamadı. API Key yetkilerini veya internet bağlantınızı kontrol edin.")
    sys.exit(1)

# JSON response config (yeni SDK'da types.GenerateContentConfig kullanılır)
generate_config = types.GenerateContentConfig(
    response_mime_type="application/json"
)

CURRICULUM_INDEX_PATH = "../curriculum_index.json"
if not os.path.exists(CURRICULUM_INDEX_PATH) and os.path.exists("curriculum_index.json"):
    CURRICULUM_INDEX_PATH = "curriculum_index.json"

if not os.path.exists(CURRICULUM_INDEX_PATH):
    print("Hata: curriculum_index.json bulunamadı.")
    sys.exit(1)

with open(CURRICULUM_INDEX_PATH, "r", encoding="utf-8") as f:
    curriculum_data = json.load(f)

print("Müfredat indeks dosyası yüklendi. Sınıflar taranıyor...")

total_generated = 0

for grade_item in curriculum_data.get("curriculum", []):
    grade_name = grade_item.get("gradeName")
    print(f"\n>>> {grade_name} taranıyor...")

    for subject in grade_item.get("subjects", []):
        subj_name = subject.get("name")
        data_file_path = subject.get("dataFile")

        base_dir = os.path.dirname(CURRICULUM_INDEX_PATH)
        full_data_path = os.path.join(base_dir, data_file_path.replace("./", ""))

        if not os.path.exists(full_data_path):
            print(f"  [UYARI] Dosya bulunamadı: {full_data_path}. Pas geçiliyor.")
            continue

        with open(full_data_path, "r", encoding="utf-8") as f:
            subject_data = json.load(f)

        modified = False
        for unit in subject_data.get("units", []):
            unit_name = unit.get("name")
            words_list = unit.get("words", [])
            current_count = len(words_list)

            if current_count >= 50:
                print(f"  - {subj_name} / {unit_name}: Zaten {current_count} soru var (Atlanıyor).")
                continue

            needed = 50 - current_count
            print(f"  - {subj_name} / {unit_name}: Mevcut: {current_count}, İhtiyaç: {needed}. Üretiliyor...")

            existing_words = [w.get("word") for w in words_list]

            prompt = f"""
            Sen eğitim odaklı bir Türkçe kelime ve soru üreticisisin.
            Sınıf Seviyesi: {grade_name}
            Ders: {subj_name}
            Ünite: {unit_name}

            Bu ünite ve sınıf seviyesine uygun, müfredatla birebir örtüşen, çocukların kelime dağarcığını geliştirecek en az {needed} adet farklı Türkçe kelime ve bunlara uygun eğitici/eğlenceli ipuçları üret.
            
            Kurallar:
            1. Şu mevcut kelimelerden FARKLI olmalıdır: {", ".join(existing_words)}
            2. Her nesne "word" ve "hint" içermelidir.
            3. İpuçları kısa, açıklayıcı ve yaş grubuna uygun olmalıdır.
            4. Kelimeler tek kelime (veya yaygın birleşik kelime) olmalı, cümle olmamalıdır.
            5. Çıktı sadece JSON dizisi formatında olmalıdır.
            
            JSON Şeması:
            [{{"word": "KÜTLE", "hint": "Madde miktarının ölçüsü"}}, ...]
            """

            retries = 3
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
                        w_word = to_tr_uppercase(q.get("word", "").strip())
                        w_hint = q.get("hint", "").strip()
                        if w_word and w_hint and w_word not in existing_words:
                            words_list.append({"word": w_word, "hint": w_hint})
                            existing_words.append(w_word)
                            added += 1

                    print(f"    -> {added} yeni soru eklendi (Toplam: {len(words_list)}).")
                    modified = True
                    success = True
                    total_generated += added
                    time.sleep(2.5)

                except Exception as e:
                    retries -= 1
                    print(f"    [HATA] {str(e)}. Kalan deneme: {retries}")
                    time.sleep(5)

            if not success:
                print(f"    [UYARI] {unit_name} için soru üretilemedi, sonraki üniteye geçiliyor.")

        if modified:
            with open(full_data_path, "w", encoding="utf-8") as f:
                json.dump(subject_data, f, ensure_ascii=False, indent=2)
            print(f"  [KAYDEDİLDİ] {data_file_path} güncellendi.")

print(f"\n====================================================")
print(f"İŞLEM TAMAMLANDI! Toplam {total_generated} soru sisteme eklendi.")
print(f"====================================================")