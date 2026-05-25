import os
import json
import time
import sys

# Turkish uppercase helper
def to_tr_uppercase(text):
    if not text:
        return ""
    # Map lowercase to uppercase for Turkish specifically
    maps = {
        'i': 'İ',
        'ı': 'I',
        'ğ': 'Ğ',
        'ü': 'Ü',
        'ş': 'Ş',
        'ö': 'Ö',
        'ç': 'Ç'
    }
    res = []
    for char in text.lower():
        res.append(maps.get(char, char.upper()))
    return "".join(res)

try:
    import google.generativeai as genai
except ImportError:
    print("Hata: 'google-generativeai' kütüphanesi yüklü değil.")
    print("Lütfen terminalde 'pip install google-generativeai' komutunu çalıştırın.")
    sys.exit(1)

# Get API Key
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

genai.configure(api_key=api_key)

# Model configuration
model = genai.GenerativeModel(
    "gemini-1.5-flash",
    generation_config={"response_mime_type": "application/json"}
)

CURRICULUM_INDEX_PATH = "../curriculum_index.json"
# We run from the data directory or project root. Let's resolve the path dynamically.
if not os.path.exists(CURRICULUM_INDEX_PATH) and os.path.exists("curriculum_index.json"):
    CURRICULUM_INDEX_PATH = "curriculum_index.json"

if not os.path.exists(CURRICULUM_INDEX_PATH):
    print(f"Hata: curriculum_index.json bulunamadı. Lütfen scripti proje kök dizininde veya 'data' klasöründe çalıştırın.")
    sys.exit(1)

# Load curriculum index
with open(CURRICULUM_INDEX_PATH, "r", encoding="utf-8") as f:
    curriculum_data = json.load(f)

print(f"Müfredat indeks dosyası yüklendi. Sınıflar taranıyor...")

total_generated = 0

for grade_item in curriculum_data.get("curriculum", []):
    grade_name = grade_item.get("gradeName")
    grade_num = grade_item.get("grade")
    print(f"\n>>> {grade_name} taranıyor...")
    
    for subject in grade_item.get("subjects", []):
        subj_name = subject.get("name")
        data_file_path = subject.get("dataFile")
        
        # Resolve data path relative to curriculum index
        base_dir = os.path.dirname(CURRICULUM_INDEX_PATH)
        full_data_path = os.path.join(base_dir, data_file_path.replace("./", ""))
        
        if not os.path.exists(full_data_path):
            print(f"  [UYARI] Dosya bulunamadı: {full_data_path}. Pas geçiliyor.")
            continue
            
        # Read subject JSON
        with open(full_data_path, "r", encoding="utf-8") as f:
            subject_data = json.load(f)
            
        modified = False
        for unit in subject_data.get("units", []):
            unit_id = unit.get("id")
            unit_name = unit.get("name")
            words_list = unit.get("words", [])
            current_count = len(words_list)
            
            if current_count >= 50:
                print(f"  - {subj_name} / {unit_name}: Zaten {current_count} soru var (Atlanıyor).")
                continue
                
            needed = 50 - current_count
            print(f"  - {subj_name} / {unit_name}: Mevcut: {current_count}, İhtiyaç: {needed} soru. Üretiliyor...")
            
            existing_words = [w.get("word") for w in words_list]
            
            # Prepare prompt
            prompt = f"""
            Sen eğitim odaklı bir Türkçe kelime ve soru üreticisisin.
            Sınıf Seviyesi: {grade_name}
            Ders: {subj_name}
            Ünite: {unit_name}

            Bu ünite ve sınıf seviyesine uygun, müfredatla birebir örtüşen, çocukların kelime dağarcığını geliştirecek en az {needed} adet farklı Türkçe kelime ve bunlara uygun eğitici/eğlenceli ipuçları üret.
            
            Kurallar:
            1. Üreteceğin kelimeler şu mevcut kelimelerden FARKLI olmalıdır (bunları tekrar üretme): {", ".join(existing_words)}
            2. Her nesne bir "word" ve bir "hint" (ipucu) içermelidir.
            3. İpuçları kısa, açıklayıcı, eğitici ve yaş grubuna uygun (örneğin ilkokul için daha basit, lise için daha bilimsel) olmalıdır.
            4. Kelimeler sadece tek kelime (veya yaygın birleşik kelime) olmalı, cümle olmamalıdır.
            5. Çıktı sadece JSON dizisi (array of objects) formatında olmalıdır.
            
            JSON Şeması:
            [
              {{"word": "KÜTLE", "hint": "Madde miktarının ölçüsü"}},
              ...
            ]
            """
            
            retries = 3
            success = False
            while retries > 0 and not success:
                try:
                    response = model.generate_content(prompt)
                    # Parse JSON
                    res_text = response.text.strip()
                    # Clean up code blocks if present
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
                        
                        # Validate word (no empty, no duplicates)
                        if w_word and w_hint and w_word not in existing_words:
                            words_list.append({"word": w_word, "hint": w_hint})
                            existing_words.append(w_word)
                            added += 1
                    
                    print(f"    -> Başarıyla {added} yeni soru eklendi (Toplam: {len(words_list)}).")
                    modified = True
                    success = True
                    total_generated += added
                    
                    # Sleep to prevent API rate limits (RPM)
                    time.sleep(2.5)
                    
                except Exception as e:
                    retries -= 1
                    print(f"    [HATA] API hatası oluştu: {str(e)}. Kalan deneme: {retries}")
                    time.sleep(5)
            
            if not success:
                print(f"    [UYARI] {unit_name} ünitesi için soru üretilemedi, sonraki üniteye geçiliyor.")
                
        # Save back if modified
        if modified:
            with open(full_data_path, "w", encoding="utf-8") as f:
                json.dump(subject_data, f, ensure_ascii=False, indent=2)
            print(f"  [KAYDEDİLDİ] {data_file_path} güncellendi.")

print(f"\n====================================================")
print(f"İŞLEM TAMAMLANDI! Toplam {total_generated} soru sisteme eklendi.")
print(f"====================================================")
