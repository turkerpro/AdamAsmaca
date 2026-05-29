"""
generate_exams.py
Sınavlarda Çıkmış Sorular (LGS, YKS, KPSS) için kelime listeleri üretir.
Grade 99 olarak curriculum_index'e eklenmiştir.
"""
import os, json, time, sys, re
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Hata: google-genai kurulu degil."); sys.exit(1)

def load_keys():
    for p in ["api_keys.txt","data/api_keys.txt","../api_keys.txt"]:
        if os.path.exists(p):
            keys = [l.strip() for l in open(p) if l.strip() and not l.startswith("#")]
            if keys: return keys
    return []

api_keys = load_keys()
if not api_keys: print("API anahtarı yok!"); sys.exit(1)

cur_key = 0
client  = genai.Client(api_key=api_keys[0])

def rotate():
    global cur_key, client
    if len(api_keys) < 2: return False
    cur_key = (cur_key+1) % len(api_keys)
    client  = genai.Client(api_key=api_keys[cur_key])
    print(f"  [ANAHTAR] -> {cur_key} numaralı anahtara geçildi.")
    return True

MODEL = "gemini-2.5-flash"
CFG = types.GenerateContentConfig(response_mime_type="application/json")

def tr_upper(t):
    return t.replace("i","İ").replace("ı","I").replace("ş","Ş")\
            .replace("ç","Ç").replace("ğ","Ğ").replace("ü","Ü")\
            .replace("ö","Ö").upper()

def clean_word(w):
    w = tr_upper(w)
    w = re.sub(r"[^A-ZÇĞİÖŞÜ ]","",w)
    return re.sub(r"\s+"," ",w).strip()

def generate_exam_words(exam_name, subject_name, retries=5):
    prompt = f"""
Sen Türkiye'deki sınav sistemine (LGS, YKS, KPSS) hakim bir eğitim uzmanısın.
Adam Asmaca oyunu için "{exam_name}" sınavının "{subject_name}" testinde çıkmış olan, öğrencilerin bilmesi gereken en önemli 55 farklı Türkçe terim/kavram ve bunların kısa açıklayıcı ipuçlarını üret.
KURALLAR:
- word TAMAMEN BÜYÜK HARF Türkçe (Örn: ISI, IŞIK, YILDIZ. İSİ/YİLDİZ gibi yanlış yazım YASAK)
- Kelimelerde kesme işareti ('), tire (-), nokta (.), soru işareti (?) YASAK
- Sadece JSON dizisi döndür: [{{"word":"PARAGRAF","hint":"Bir düşünceyi anlatan cümleler topluluğu"}}]
"""
    for attempt in range(retries):
        try:
            res = client.models.generate_content(model=MODEL, contents=prompt, config=CFG)
            txt = res.text.strip().lstrip("```json").rstrip("```").strip()
            raw = json.loads(txt)
            seen, out = set(), []
            for item in raw:
                w = clean_word(item.get("word",""))
                h = item.get("hint","").strip()
                if w and len(w)>=2 and h and w not in seen:
                    out.append({"word":w,"hint":h}); seen.add(w)
            if len(out) >= 50:
                return out
            print(f"    [UYARI] Yeterli kelime üretilemedi ({len(out)}), tekrar...")
        except Exception as e:
            err = str(e)
            print(f"    [HATA] {err[:100]}")
            if "429" in err or "quota" in err.lower() or "503" in err:
                rotate()
            time.sleep(8)
    return []

EXAMS = {
    "lgs": {
        "title": "LGS Sınavı",
        "units": [
            {"num": 1, "name": "LGS Türkçe"},
            {"num": 2, "name": "LGS Matematik"},
            {"num": 3, "name": "LGS Fen Bilimleri"},
            {"num": 4, "name": "LGS İnkılap Tarihi"},
            {"num": 5, "name": "LGS Din Kültürü"}
        ]
    },
    "yks": {
        "title": "YKS Sınavı",
        "units": [
            {"num": 1, "name": "TYT Türkçe"},
            {"num": 2, "name": "TYT Temel Matematik"},
            {"num": 3, "name": "TYT Sosyal Bilimler"},
            {"num": 4, "name": "TYT Fen Bilimleri"},
            {"num": 5, "name": "AYT Edebiyat ve Sosyal"},
            {"num": 6, "name": "AYT Matematik ve Fen"}
        ]
    },
    "kpss": {
        "title": "KPSS Sınavı",
        "units": [
            {"num": 1, "name": "KPSS Türkçe"},
            {"num": 2, "name": "KPSS Matematik"},
            {"num": 3, "name": "KPSS Tarih"},
            {"num": 4, "name": "KPSS Coğrafya"},
            {"num": 5, "name": "KPSS Vatandaşlık"}
        ]
    }
}

os.makedirs("data/exams", exist_ok=True)

print("=== ÇIKMIŞ SORULAR (EXAMS) ÜRETİLİYOR ===")
for exam_id, exam_data in EXAMS.items():
    exam_title = exam_data["title"]
    print(f"\n>>> Sınav: {exam_title}")
    
    output_path = f"data/exams/{exam_id}.json"
    
    # Mevcut dosyayı yükle (zaten varsa üzerine yazmayıp atlamak veya eklemek için)
    existing_units = []
    if os.path.exists(output_path):
        with open(output_path, "r", encoding="utf-8") as f:
            try:
                existing_data = json.load(f)
                existing_units = existing_data.get("units", [])
            except: pass
    
    existing_unit_names = [u["name"] for u in existing_units]
    all_units = list(existing_units)
    file_modified = False
    
    for u in exam_data["units"]:
        u_num = u["num"]
        u_name = u["name"]
        
        if u_name in existing_unit_names:
            print(f"  [ATLANDI] {u_name} zaten mevcut.")
            continue
            
        print(f"  Üretiyor: {u_name} ...", end="", flush=True)
        words = generate_exam_words(exam_title, u_name)
        print(f" -> {len(words)} kelime.")
        
        all_units.append({
            "id": f"{exam_id}_u{u_num}",
            "name": u_name,
            "months": [1, 2, 3, 4, 5, 6, 9, 10, 11, 12], # Tüm aylar aktif
            "words": words
        })
        file_modified = True
        time.sleep(3)
        
    if file_modified:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump({"subject": exam_title, "units": all_units}, f, ensure_ascii=False, indent=2)
        print(f"  [KAYDEDİLDİ] {output_path}")

print("\n=== TAMAMLANDI ===")
