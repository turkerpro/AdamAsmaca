import os
import json
import time
import sys

def to_tr_uppercase(text):
    if not text:
        return ""
    # "İ̇" gibi bozuk karakterleri baştan önle, i'leri çevirip standart upper() kullan
    return text.replace("İ̇", "İ").replace("i", "İ").replace("ı", "I").upper()

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Hata: 'google-genai' kütüphanesi yüklü değil.")
    print("Lütfen terminalde 'pip install google-genai' komutunu çalıştırın.")
    sys.exit(1)

def load_api_keys():
    keys = []
    # Check current directory and parent directory for api_keys.txt
    for path in ["api_keys.txt", "../api_keys.txt"]:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    k = line.strip()
                    if k and not k.startswith("#"):
                        keys.append(k)
            if keys:
                print(f"[SİSTEM] {path} dosyasından {len(keys)} adet API anahtarı yüklendi.")
                return keys
    return []

api_keys = load_api_keys()
if not api_keys:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("====================================================")
        print("           GEMINI SORU ÜRETME SİSTEMİ               ")
        print("====================================================")
        print("Lütfen Google AI Studio'dan aldığınız ücretsiz API anahtarını girin.")
        api_key = input("API Key: ").strip()
    if api_key:
        api_keys = [api_key]

if not api_keys:
    print("Hata: API anahtarı bulunamadı.")
    sys.exit(1)

current_key_index = 0
client = genai.Client(api_key=api_keys[current_key_index])

def rotate_key():
    global current_key_index, client
    if len(api_keys) <= 1:
        return False
    current_key_index = (current_key_index + 1) % len(api_keys)
    next_key = api_keys[current_key_index]
    print(f"\n[SİSTEM] Kota limiti veya hata nedeniyle sıradaki API anahtarına geçiliyor (İndeks: {current_key_index})...")
    client = genai.Client(api_key=next_key)
    return True

# Kullanılabilir modelleri listele ve çalışanı bul
working_model_name = None
test_success = False

while not test_success:
    print(f"Kullanılabilir yapay zeka modelleri test ediliyor (Mevcut Anahtar İndeksi: {current_key_index})...")
    test_models = ["gemini-1.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"]
    for model_name in test_models:
        print(f"Deneniyor: {model_name}...")
        try:
            test_response = client.models.generate_content(
                model=model_name,
                contents="test"
            )
            working_model_name = model_name
            print(f"-> Başarılı! Kullanılacak model: {working_model_name}")
            test_success = True
            break
        except Exception as e:
            print(f"-> Başarısız (Hata: {str(e)})")
            
    if not test_success:
        print("[UYARI] Mevcut API anahtarı ile test başarısız oldu.")
        if len(api_keys) > 1 and current_key_index + 1 < len(api_keys):
            rotate_key()
        else:
            print("Hata: Çalışan hiçbir API anahtarı veya model bulunamadı.")
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

            is_english = "ingilizce" in data_file_path.lower()
            
            if is_english:
                prompt = f"""
                Sen eğitim odaklı bir İngilizce kelime ve Türkçe ipucu üreticisisin.
                Sınıf Seviyesi: {grade_name}
                Ünite: {unit_name}

                Bu ünite ve sınıf seviyesine uygun, müfredatla birebir örtüşen, çocukların kelime dağarcığını geliştirecek en az {needed} adet farklı kelime çifti üret.
                
                Kurallar:
                1. "word" ALANI KESİNLİKLE İNGİLİZCE BİR KELİME VEYA KELİME ÖBEĞİ OLMALIDIR. (Türkçe olamaz!)
                2. "hint" ALANI BU İNGİLİZCE KELİMENİN TÜRKÇE ÇEVİRİSİ VEYA AÇIKLAMASI OLMALIDIR.
                3. Şu mevcut kelimelerden FARKLI olmalıdır: {", ".join(existing_words)}
                4. Her nesne "word" ve "hint" içermelidir.
                5. Kelimeler tek kelime (veya yaygın birleşik kelime) olmalı, uzun cümle olmamalıdır.
                6. Çıktı sadece JSON dizisi formatında olmalıdır.
                
                JSON Şeması Örneği:
                [{{"word": "APPLE", "hint": "Kırmızı veya yeşil renkli, tatlı bir meyve (Elma)"}}, {{"word": "FRIENDSHIP", "hint": "Arkadaşlık, dostluk"}}]
                """
            else:
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

            retries = 10
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
                        if is_english:
                            w_word = raw_word.upper() # English standard uppercase (i -> I)
                        else:
                            w_word = to_tr_uppercase(raw_word) # Turkish uppercase (i -> İ)
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
                    err_msg = str(e)
                    print(f"    [HATA] {err_msg}")
                    
                    # Check if we should rotate the key
                    is_quota_or_auth = any(kw in err_msg.lower() for kw in ["429", "403", "quota", "exhausted", "invalid", "limit"])
                    if is_quota_or_auth and len(api_keys) > 1:
                        if rotate_key():
                            print("    -> Yeni anahtar ile yeniden deneniyor...")
                            time.sleep(2)
                            continue
                            
                    retries -= 1
                    print(f"    -> Kalan deneme: {retries} (Sunucu mesgul, 10 saniye bekleniyor...)")
                    time.sleep(10)

            if not success:
                print(f"    [UYARI] {unit_name} için soru üretilemedi, sonraki üniteye geçiliyor.")

        if modified:
            with open(full_data_path, "w", encoding="utf-8") as f:
                json.dump(subject_data, f, ensure_ascii=False, indent=2)
            print(f"  [KAYDEDİLDİ] {data_file_path} güncellendi.")

print(f"\n====================================================")
print(f"İŞLEM TAMAMLANDI! Toplam {total_generated} soru sisteme eklendi.")
print(f"====================================================")