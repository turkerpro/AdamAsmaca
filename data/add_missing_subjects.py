"""
add_missing_subjects.py
Eksik MEB derslerini (Görsel Sanatlar 2-8, Müzik 2-8,
Din Kültürü 1-12, Felsefe 9-12) Gemini ile üretip oyuna ekler.
"""
import os, json, time, sys, re
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Hata: google-genai kurulu degil."); sys.exit(1)

# ── API ──────────────────────────────────────────────────────────────────────
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

# Model seçimi
MODEL = None
for m in ["gemini-2.5-flash","gemini-2.0-flash","gemini-2.0-flash-lite","gemini-1.5-flash"]:
    try:
        client.models.generate_content(model=m, contents="hi")
        MODEL = m; print(f"[MODEL] {MODEL}"); break
    except: rotate()

if not MODEL: print("Çalışan model bulunamadı!"); sys.exit(1)

CFG = types.GenerateContentConfig(response_mime_type="application/json")

# ── Türkçe büyük harf yardımcısı ─────────────────────────────────────────────
def tr_upper(t):
    return t.replace("i","İ").replace("ı","I").replace("ş","Ş")\
            .replace("ç","Ç").replace("ğ","Ğ").replace("ü","Ü")\
            .replace("ö","Ö").upper()

def clean_word(w, eng):
    if eng:
        w = w.upper().replace("İ","I").replace("ı","I")
        w = re.sub(r"[^A-Z ]","",w)
    else:
        w = tr_upper(w)
        w = re.sub(r"[^A-ZÇĞİÖŞÜ ]","",w)
    return re.sub(r"\s+"," ",w).strip()

# ── Gemini'den kelime üret ────────────────────────────────────────────────────
def generate_words(grade_name, subj_name, unit_name, is_eng, retries=5):
    if is_eng:
        prompt = f"""
Sen bir eğitim uzmanısın. Sınıf: {grade_name}, Ders: {subj_name}, Ünite: {unit_name}
Bu üniteye uygun 55 İngilizce kelime ve Türkçe ipuçları üret.
KURALLAR:
- word alanı TAMAMEN BÜYÜK HARF İngilizce olmalı, Türkçe karakter (Ç Ğ İ Ö Ş Ü) YASAK
- Kesme işareti ('), tire (-), nokta (.), soru işareti (?) YASAK
- hint Türkçe olmalı
- Sadece JSON dizisi döndür: [{{"word":"FRIEND","hint":"Arkadaş"}}]
"""
    else:
        prompt = f"""
Sen bir eğitim uzmanısın. Sınıf: {grade_name}, Ders: {subj_name}, Ünite: {unit_name}
Bu üniteye uygun 55 Türkçe kelime ve Türkçe ipuçları üret.
KURALLAR:
- word TAMAMEN BÜYÜK HARF Türkçe (ISI IŞIK YILDIZ gibi, İSİ/YİLDİZ gibi yanlış yazım YASAK)
- Kesme işareti ('), tire (-), nokta (.), soru işareti (?) YASAK
- Sadece JSON dizisi döndür: [{{"word":"RENK","hint":"Gözle algılanan ışık özelliği"}}]
"""
    for attempt in range(retries):
        try:
            res = client.models.generate_content(model=MODEL, contents=prompt, config=CFG)
            txt = res.text.strip().lstrip("```json").rstrip("```").strip()
            raw = json.loads(txt)
            seen, out = set(), []
            for item in raw:
                w = clean_word(item.get("word",""), is_eng)
                h = item.get("hint","").strip()
                if w and len(w)>=2 and h and w not in seen:
                    out.append({"word":w,"hint":h}); seen.add(w)
            if len(out) >= 50:
                return out
            print(f"    [UYARI] Yeterli kelime üretilemedi ({len(out)}), tekrar...")
        except Exception as e:
            err = str(e)
            print(f"    [HATA] {err[:100]}")
            if "429" in err or "quota" in err.lower():
                rotate()
            time.sleep(8)
    return []

# ── Müfredat verileri ─────────────────────────────────────────────────────────
GORSEL_UNITS = {
    "2": [
        {"num":1,"name":"1. Ünite: Görsel Sanatlara Giriş","months":[9,10]},
        {"num":2,"name":"2. Ünite: Çizgi ve Şekil","months":[11,12]},
        {"num":3,"name":"3. Ünite: Renk","months":[1,2]},
        {"num":4,"name":"4. Ünite: Doku ve Biçim","months":[3,4]},
        {"num":5,"name":"5. Ünite: Mekan ve Perspektif","months":[5,6]},
    ],
    "3": [
        {"num":1,"name":"1. Ünite: Sanat Eserleri ve Sanatçılar","months":[9,10]},
        {"num":2,"name":"2. Ünite: Çizgi, Doku ve Renk","months":[11,12]},
        {"num":3,"name":"3. Ünite: Şekil ve Form","months":[1,2]},
        {"num":4,"name":"4. Ünite: Geleneksel Sanatlar","months":[3,4]},
        {"num":5,"name":"5. Ünite: Sanat ve Doğa","months":[5,6]},
    ],
    "4": [
        {"num":1,"name":"1. Ünite: Görsel İletişim","months":[9,10]},
        {"num":2,"name":"2. Ünite: Resim Teknikleri","months":[11,12]},
        {"num":3,"name":"3. Ünite: Heykel ve Seramik","months":[1,2]},
        {"num":4,"name":"4. Ünite: Mimarlık ve Tasarım","months":[3,4]},
        {"num":5,"name":"5. Ünite: Türk ve Dünya Sanatından Örnekler","months":[5,6]},
    ],
    "5": [
        {"num":1,"name":"1. Ünite: Sanat Eleştirisi","months":[9,10]},
        {"num":2,"name":"2. Ünite: Çizgi ve Anlatım","months":[11,12]},
        {"num":3,"name":"3. Ünite: Renk Teorisi","months":[1,2]},
        {"num":4,"name":"4. Ünite: Grafik Tasarım","months":[3,4]},
        {"num":5,"name":"5. Ünite: Halk Sanatları","months":[5,6]},
    ],
    "6": [
        {"num":1,"name":"1. Ünite: Sanat Akımları","months":[9,10]},
        {"num":2,"name":"2. Ünite: Perspektif ve Kompozisyon","months":[11,12]},
        {"num":3,"name":"3. Ünite: Fotoğraf ve Dijital Sanat","months":[1,2]},
        {"num":4,"name":"4. Ünite: Türk Süsleme Sanatları","months":[3,4]},
        {"num":5,"name":"5. Ünite: Müze ve Sanat Kurumları","months":[5,6]},
    ],
    "7": [
        {"num":1,"name":"1. Ünite: Görsel Kültür","months":[9,10]},
        {"num":2,"name":"2. Ünite: Baskı ve Gravür Teknikleri","months":[11,12]},
        {"num":3,"name":"3. Ünite: Seramik ve Cam Sanatı","months":[1,2]},
        {"num":4,"name":"4. Ünite: Karikatür ve Çizgi Roman","months":[3,4]},
        {"num":5,"name":"5. Ünite: Çağdaş Türk Sanatı","months":[5,6]},
    ],
    "8": [
        {"num":1,"name":"1. Ünite: Sanat Tarihi","months":[9,10]},
        {"num":2,"name":"2. Ünite: Empresyonizm ve Modernizm","months":[11,12]},
        {"num":3,"name":"3. Ünite: Özgün Baskı","months":[1,2]},
        {"num":4,"name":"4. Ünite: Mesleki Sanat Alanları","months":[3,4]},
        {"num":5,"name":"5. Ünite: Kültürel Miras ve Koruma","months":[5,6]},
    ],
}

MUZIK_UNITS = {
    "2": [
        {"num":1,"name":"1. Ünite: Sesler ve Müzik","months":[9,10]},
        {"num":2,"name":"2. Ünite: Ritim ve Tempo","months":[11,12]},
        {"num":3,"name":"3. Ünite: Melodi ve Türküler","months":[1,2]},
        {"num":4,"name":"4. Ünite: Müzik Aletleri","months":[3,4]},
        {"num":5,"name":"5. Ünite: Dans ve Müzik","months":[5,6]},
    ],
    "3": [
        {"num":1,"name":"1. Ünite: Nota ve Ölçü","months":[9,10]},
        {"num":2,"name":"2. Ünite: Ses Yüksekliği ve Dinamik","months":[11,12]},
        {"num":3,"name":"3. Ünite: Türk Halk Müziği","months":[1,2]},
        {"num":4,"name":"4. Ünite: Müzik Aletleri Grupları","months":[3,4]},
        {"num":5,"name":"5. Ünite: Müzik ve Duygu","months":[5,6]},
    ],
    "4": [
        {"num":1,"name":"1. Ünite: Müzikal Biçimler","months":[9,10]},
        {"num":2,"name":"2. Ünite: Keman ve Yaylı Çalgılar","months":[11,12]},
        {"num":3,"name":"3. Ünite: Türk Sanat Müziği","months":[1,2]},
        {"num":4,"name":"4. Ünite: Koronun Elemanları","months":[3,4]},
        {"num":5,"name":"5. Ünite: Dünya Müzikleri","months":[5,6]},
    ],
    "5": [
        {"num":1,"name":"1. Ünite: Müzik Teorisi Temelleri","months":[9,10]},
        {"num":2,"name":"2. Ünite: Nefesli Çalgılar","months":[11,12]},
        {"num":3,"name":"3. Ünite: Çokseslilik","months":[1,2]},
        {"num":4,"name":"4. Ünite: Müzik ve Şiir","months":[3,4]},
        {"num":5,"name":"5. Ünite: Türk Müziği Makamları","months":[5,6]},
    ],
    "6": [
        {"num":1,"name":"1. Ünite: Müzik Tarihi","months":[9,10]},
        {"num":2,"name":"2. Ünite: Vurmalı Çalgılar","months":[11,12]},
        {"num":3,"name":"3. Ünite: Piyano ve Klavye Çalgılar","months":[1,2]},
        {"num":4,"name":"4. Ünite: Opera ve Tiyatro","months":[3,4]},
        {"num":5,"name":"5. Ünite: Müzik Eleştirisi","months":[5,6]},
    ],
    "7": [
        {"num":1,"name":"1. Ünite: Müzik Akımları","months":[9,10]},
        {"num":2,"name":"2. Ünite: Orkestra","months":[11,12]},
        {"num":3,"name":"3. Ünite: Caz ve Pop Müzik","months":[1,2]},
        {"num":4,"name":"4. Ünite: Müzik ve Teknoloji","months":[3,4]},
        {"num":5,"name":"5. Ünite: Türkiye'de Çağdaş Müzik","months":[5,6]},
    ],
    "8": [
        {"num":1,"name":"1. Ünite: Müzik ve Toplum","months":[9,10]},
        {"num":2,"name":"2. Ünite: 20. Yüzyıl Müziği","months":[11,12]},
        {"num":3,"name":"3. Ünite: Türk Klasik Müziği Ustaları","months":[1,2]},
        {"num":4,"name":"4. Ünite: Müzik Meslekleri","months":[3,4]},
        {"num":5,"name":"5. Ünite: Müzik Mirası ve Koruma","months":[5,6]},
    ],
}

DIN_UNITS = {
    "1": [
        {"num":1,"name":"1. Ünite: Dinimizi Öğreniyoruz","months":[9,10]},
        {"num":2,"name":"2. Ünite: Temizlik ve İbadet","months":[11,12]},
        {"num":3,"name":"3. Ünite: Allah'ı Tanıyorum","months":[1,2]},
        {"num":4,"name":"4. Ünite: Hz. Muhammed'i Tanıyorum","months":[3,4]},
        {"num":5,"name":"5. Ünite: Güzel Ahlak","months":[5,6]},
    ],
    "2": [
        {"num":1,"name":"1. Ünite: Kur'an-ı Kerim'i Tanıyorum","months":[9,10]},
        {"num":2,"name":"2. Ünite: İman Esasları","months":[11,12]},
        {"num":3,"name":"3. Ünite: İbadetlerimiz","months":[1,2]},
        {"num":4,"name":"4. Ünite: Hz. Muhammed'in Hayatı","months":[3,4]},
        {"num":5,"name":"5. Ünite: Birlikte Yaşamak","months":[5,6]},
    ],
    "3": [
        {"num":1,"name":"1. Ünite: Allah İnancı","months":[9,10]},
        {"num":2,"name":"2. Ünite: Kur'an-ı Kerim ve Sünnet","months":[11,12]},
        {"num":3,"name":"3. Ünite: Namaz","months":[1,2]},
        {"num":4,"name":"4. Ünite: Hz. Peygamber'in Örnek Ahlakı","months":[3,4]},
        {"num":5,"name":"5. Ünite: Din ve Hayat","months":[5,6]},
    ],
    "4": [
        {"num":1,"name":"1. Ünite: Kader ve Alınyazısı","months":[9,10]},
        {"num":2,"name":"2. Ünite: Zekat ve Oruç","months":[11,12]},
        {"num":3,"name":"3. Ünite: Hac ve Kurban","months":[1,2]},
        {"num":4,"name":"4. Ünite: Peygamberler Tarihi","months":[3,4]},
        {"num":5,"name":"5. Ünite: Ahlak ve Değerler","months":[5,6]},
    ],
    "5": [
        {"num":1,"name":"1. Ünite: İslam'ın Temel Kavramları","months":[9,10]},
        {"num":2,"name":"2. Ünite: Melekler ve Ahiret","months":[11,12]},
        {"num":3,"name":"3. Ünite: İslam'da Aile","months":[1,2]},
        {"num":4,"name":"4. Ünite: Dünya Dinleri","months":[3,4]},
        {"num":5,"name":"5. Ünite: Sosyal Yardımlaşma","months":[5,6]},
    ],
    "6": [
        {"num":1,"name":"1. Ünite: Kur'an-ı Kerim'in Mesajı","months":[9,10]},
        {"num":2,"name":"2. Ünite: İslam Medeniyeti","months":[11,12]},
        {"num":3,"name":"3. Ünite: İbadetlerin Anlamı","months":[1,2]},
        {"num":4,"name":"4. Ünite: Ahlak Felsefesi","months":[3,4]},
        {"num":5,"name":"5. Ünite: Din ve Bilim","months":[5,6]},
    ],
    "7": [
        {"num":1,"name":"1. Ünite: Tevhit İnancı","months":[9,10]},
        {"num":2,"name":"2. Ünite: Hz. Muhammed ve İslam","months":[11,12]},
        {"num":3,"name":"3. Ünite: İslam'da Hukuk","months":[1,2]},
        {"num":4,"name":"4. Ünite: Kültürlerarası Diyalog","months":[3,4]},
        {"num":5,"name":"5. Ünite: Çevre Ahlakı","months":[5,6]},
    ],
    "8": [
        {"num":1,"name":"1. Ünite: Gençlik ve Din","months":[9,10]},
        {"num":2,"name":"2. Ünite: İslam'da Bireysel Özgürlük","months":[11,12]},
        {"num":3,"name":"3. Ünite: Dini Metinleri Okumak","months":[1,2]},
        {"num":4,"name":"4. Ünite: Laiklik ve Din","months":[3,4]},
        {"num":5,"name":"5. Ünite: Sevgi ve Hoşgörü","months":[5,6]},
    ],
    "9": [
        {"num":1,"name":"1. Ünite: Din Nedir?","months":[9,10]},
        {"num":2,"name":"2. Ünite: İslam'ın Temel Kaynakları","months":[11,12]},
        {"num":3,"name":"3. Ünite: İnanç Esasları","months":[1,2]},
        {"num":4,"name":"4. Ünite: İbadet ve Anlam","months":[3,4]},
        {"num":5,"name":"5. Ünite: Din ve Toplumsal Hayat","months":[5,6]},
    ],
    "10": [
        {"num":1,"name":"1. Ünite: Kelam İlmi","months":[9,10]},
        {"num":2,"name":"2. Ünite: İslam Düşünce Ekolleri","months":[11,12]},
        {"num":3,"name":"3. Ünite: Tasavvuf","months":[1,2]},
        {"num":4,"name":"4. Ünite: İslam Ahlakı","months":[3,4]},
        {"num":5,"name":"5. Ünite: Din ve Çağdaş Sorunlar","months":[5,6]},
    ],
    "11": [
        {"num":1,"name":"1. Ünite: İslam Fıkhı","months":[9,10]},
        {"num":2,"name":"2. Ünite: İslam'da Ekonomi","months":[11,12]},
        {"num":3,"name":"3. Ünite: İslam Medeniyetinin Mirası","months":[1,2]},
        {"num":4,"name":"4. Ünite: Din ve Sanat","months":[3,4]},
        {"num":5,"name":"5. Ünite: Küresel Dinler Diyaloğu","months":[5,6]},
    ],
    "12": [
        {"num":1,"name":"1. Ünite: İslam ve İnsan Hakları","months":[9,10]},
        {"num":2,"name":"2. Ünite: Dini Metinlerin Yorumlanması","months":[11,12]},
        {"num":3,"name":"3. Ünite: İslam ve Bilim","months":[1,2]},
        {"num":4,"name":"4. Ünite: Çağdaş Dünyada Din","months":[3,4]},
        {"num":5,"name":"5. Ünite: Manevi Rehberlik","months":[5,6]},
    ],
}

FELSEFE_UNITS = {
    "9": [
        {"num":1,"name":"1. Ünite: Felsefeye Giriş","months":[9,10]},
        {"num":2,"name":"2. Ünite: Bilgi Felsefesi (Epistemoloji)","months":[11,12]},
        {"num":3,"name":"3. Ünite: Varlık Felsefesi (Ontoloji)","months":[1,2]},
        {"num":4,"name":"4. Ünite: Ahlak Felsefesi (Etik)","months":[3,4]},
        {"num":5,"name":"5. Ünite: Siyaset Felsefesi","months":[5,6]},
    ],
    "10": [
        {"num":1,"name":"1. Ünite: Mantık","months":[9,10]},
        {"num":2,"name":"2. Ünite: Metafizik","months":[11,12]},
        {"num":3,"name":"3. Ünite: Hukuk Felsefesi","months":[1,2]},
        {"num":4,"name":"4. Ünite: Sanat Felsefesi (Estetik)","months":[3,4]},
        {"num":5,"name":"5. Ünite: Din Felsefesi","months":[5,6]},
    ],
    "11": [
        {"num":1,"name":"1. Ünite: Antik Yunan Felsefesi","months":[9,10]},
        {"num":2,"name":"2. Ünite: Ortaçağ ve Rönesans Felsefesi","months":[11,12]},
        {"num":3,"name":"3. Ünite: Modern Felsefe","months":[1,2]},
        {"num":4,"name":"4. Ünite: Çağdaş Felsefe Akımları","months":[3,4]},
        {"num":5,"name":"5. Ünite: Türk-İslam Felsefesi","months":[5,6]},
    ],
    "12": [
        {"num":1,"name":"1. Ünite: Bilim Felsefesi","months":[9,10]},
        {"num":2,"name":"2. Ünite: Toplum Felsefesi","months":[11,12]},
        {"num":3,"name":"3. Ünite: İnsan Felsefesi (Antropoloji)","months":[1,2]},
        {"num":4,"name":"4. Ünite: Özgürlük ve Sorumluluk","months":[3,4]},
        {"num":5,"name":"5. Ünite: Felsefe ve Gelecek","months":[5,6]},
    ],
}

# ── Eklenecek derslerin tam listesi ──────────────────────────────────────────
# Format: (grade_num, subj_id, subj_name, file_name, units_dict, is_eng)
TO_ADD = []

for g in range(2, 9):
    gs = str(g)
    TO_ADD.append((g, "gorselsanat", "Görsel Sanatlar",
                   f"gorsel_sanatlar.json", GORSEL_UNITS[gs], False))
    TO_ADD.append((g, "muzik", "Müzik",
                   f"muzik.json", MUZIK_UNITS[gs], False))

for g in range(1, 13):
    gs = str(g)
    TO_ADD.append((g, "din", "Din Kültürü ve Ahlak Bilgisi",
                   f"din.json", DIN_UNITS[gs], False))

for g in range(9, 13):
    gs = str(g)
    TO_ADD.append((g, "felsefe", "Felsefe",
                   f"felsefe.json", FELSEFE_UNITS[gs], False))

# ── curriculum_index.json yükle ───────────────────────────────────────────────
CI_PATH = "curriculum_index.json"
with open(CI_PATH, "r", encoding="utf-8") as f:
    ci = json.load(f)

grade_map = {str(g["grade"]): g for g in ci["curriculum"]}

# ── Ana döngü ─────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("   EKSİK DERSLER ÜRETME BAŞLIYOR")
print("="*60 + "\n")

ci_changed = False

for (grade_num, subj_id, subj_name, file_name, units, is_eng) in TO_ADD:
    gs = str(grade_num)
    g_item = grade_map.get(gs)
    if not g_item:
        print(f"[ATLA] Grade {grade_num} curriculum_index'te yok!"); continue

    grade_name = g_item["gradeName"]

    # Zaten ekli mi?
    existing_ids = [s["id"] for s in g_item.get("subjects", [])]
    if subj_id in existing_ids:
        print(f"[ATLA] {grade_name} - {subj_name} zaten mevcut.")
        continue

    data_file = f"./data/grade_{grade_num}/{file_name}"
    full_path  = f"data/grade_{grade_num}/{file_name}"

    print(f"\n>>> {grade_name} - {subj_name}")

    all_units = []
    for u in units:
        u_num  = u["num"]
        u_name = u["name"]
        print(f"  Ünite {u_num}: {u_name}  ", end="", flush=True)

        words = generate_words(grade_name, subj_name, u_name, is_eng)
        print(f"-> {len(words)} kelime")

        all_units.append({
            "id":     f"{subj_id}_u{u_num}",
            "name":   u_name,
            "months": u["months"],
            "words":  words
        })
        time.sleep(3)   # rate-limit koruması

    # JSON kaydet
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        json.dump({"subject": subj_name, "units": all_units},
                  f, ensure_ascii=False, indent=2)
    print(f"  [KAYDEDİLDİ] {full_path}")

    # curriculum_index güncelle
    g_item["subjects"].append({
        "id":       subj_id,
        "name":     subj_name,
        "dataFile": data_file
    })
    ci_changed = True

# ── curriculum_index.json yaz ─────────────────────────────────────────────────
if ci_changed:
    with open(CI_PATH, "w", encoding="utf-8") as f:
        json.dump(ci, f, ensure_ascii=False, indent=2)
    print("\n[curriculum_index.json güncellendi]")

print("\n" + "="*60)
print("TAMAMLANDI!")
print("="*60)
