import os
import json

CURRICULUM_INDEX_PATH = "curriculum_index.json"

# Normative lists to be added
# Format: (grade_num, subj_id, subj_name, file_name, units)
MISSING_SUBJECTS = []

GORSEL_UNITS = [
    {"num": 1, "name": "1. Ünite: Görsel Sanatlara Giriş", "months": [9, 10]},
    {"num": 2, "name": "2. Ünite: Çizgi ve Şekil", "months": [11, 12]},
    {"num": 3, "name": "3. Ünite: Renk", "months": [1, 2]},
    {"num": 4, "name": "4. Ünite: Doku ve Biçim", "months": [3, 4]},
    {"num": 5, "name": "5. Ünite: Mekan ve Perspektif", "months": [5, 6]}
]
GORSEL_WORDS = [
    {"word": "RESİM", "hint": "Çizgi ve boyalarla yapılan görsel sanat eseri."},
    {"word": "PERSPEKTİF", "hint": "Nesneleri üç boyutlu olarak düzleme aktarma yöntemi."}
]

MUZIK_UNITS = [
    {"num": 1, "name": "1. Ünite: Sesler ve Müzik", "months": [9, 10]},
    {"num": 2, "name": "2. Ünite: Ritim ve Tempo", "months": [11, 12]},
    {"num": 3, "name": "3. Ünite: Melodi ve Türküler", "months": [1, 2]},
    {"num": 4, "name": "4. Ünite: Müzik Aletleri", "months": [3, 4]},
    {"num": 5, "name": "5. Ünite: Dans ve Müzik", "months": [5, 6]}
]
MUZIK_WORDS = [
    {"word": "RİTİM", "hint": "Seslerin düzenli aralıklarla tekrarlanması."},
    {"word": "MELODİ", "hint": "Belli bir duygu uyandıran ses dizisi, ezgi."}
]

DIN_UNITS = [
    {"num": 1, "name": "1. Ünite: İnanç Temelleri", "months": [9, 10]},
    {"num": 2, "name": "2. Ünite: İbadet ve Temizlik", "months": [11, 12]},
    {"num": 3, "name": "3. Ünite: Hz. Muhammed ve Güzel Ahlak", "months": [1, 2]},
    {"num": 4, "name": "4. Ünite: Kuran ve Sünnet", "months": [3, 4]},
    {"num": 5, "name": "5. Ünite: Din ve Toplum", "months": [5, 6]}
]
DIN_WORDS = [
    {"word": "İBADET", "hint": "Allah'ın rızasını kazanmak için yapılan kulluk görevleri."},
    {"word": "AHLAK", "hint": "İnsanın iyi veya kötü olarak nitelendirilmesine yol açan manevi nitelikler."}
]

FELSEFE_UNITS = [
    {"num": 1, "name": "1. Ünite: Felsefeye Giriş", "months": [9, 10]},
    {"num": 2, "name": "2. Ünite: Bilgi Felsefesi", "months": [11, 12]},
    {"num": 3, "name": "3. Ünite: Varlık Felsefesi", "months": [1, 2]},
    {"num": 4, "name": "4. Ünite: Ahlak Felsefesi", "months": [3, 4]},
    {"num": 5, "name": "5. Ünite: Siyaset Felsefesi", "months": [5, 6]}
]
FELSEFE_WORDS = [
    {"word": "BİLGİ", "hint": "Özne ile nesne arasındaki ilişkiden doğan zihinsel ürün."},
    {"word": "DÜŞÜNCE", "hint": "Aklın bir konu üzerinde yürüttüğü muhakeme süreci."}
]

BEDEN_UNITS = [
    {"num": 1, "name": "1. Ünite: Temel Hareket Becerileri", "months": [9, 10]},
    {"num": 2, "name": "2. Ünite: Aktif ve Sağlıklı Hayat", "months": [11, 12]},
    {"num": 3, "name": "3. Ünite: Spor Kültürü ve Olimpiyatlar", "months": [1, 2]},
    {"num": 4, "name": "4. Ünite: İş Birliği ve Sosyal Beceriler", "months": [3, 4]},
    {"num": 5, "name": "5. Ünite: Ritim ve Dans Etkinlikleri", "months": [5, 6]}
]
BEDEN_WORDS = [
    {"word": "KOŞU", "hint": "Adımların hızlı atılmasıyla yapılan atletizm hareketi."},
    {"word": "SPOR", "hint": "Belli kurallara göre yapılan, fiziksel gelişimi sağlayan etkinlikler."}
]

BILISIM_UNITS = [
    {"num": 1, "name": "1. Ünite: Bilişim Teknolojileri ve Etik", "months": [9, 10]},
    {"num": 2, "name": "2. Ünite: İşletim Sistemleri ve Dosyalar", "months": [11, 12]},
    {"num": 3, "name": "3. Ünite: Kelime İşlemci ve Sunum Programları", "months": [1, 2]},
    {"num": 4, "name": "4. Ünite: İnternet Güvenliği ve Sosyal Medya", "months": [3, 4]},
    {"num": 5, "name": "5. Ünite: Kodlama ve Algoritmaya Giriş", "months": [5, 6]}
]
BILISIM_WORDS = [
    {"word": "ALGORİTMA", "hint": "Bir sorunu çözmek için izlenen sıralı işlem adımları."},
    {"word": "YAZILIM", "hint": "Bilgisayarda donanımı yöneten ve işleri yapan programlar bütünü."}
]

REHBERLIK_UNITS = [
    {"num": 1, "name": "1. Ünite: Kendini Tanıma ve Uyum", "months": [9, 10]},
    {"num": 2, "name": "2. Ünite: Etkili Ders Çalışma Yöntemleri", "months": [11, 12]},
    {"num": 3, "name": "3. Ünite: İletişim ve Arkadaşlık İlişkileri", "months": [1, 2]},
    {"num": 4, "name": "4. Ünite: Meslekleri Tanıma ve İlgi Alanları", "months": [3, 4]},
    {"num": 5, "name": "5. Ünite: Problem Çözme ve Karar Verme", "months": [5, 6]}
]
REHBERLIK_WORDS = [
    {"word": "İLGİ", "hint": "Belli bir işe veya konuya yönelen zihinsel dikkat ve eğilim."},
    {"word": "MESLEK", "hint": "Geçim sağlamak amacıyla yürütülen kurallı uzmanlık alanı."}
]

SAGLIK_UNITS = [
    {"num": 1, "name": "1. Ünite: Sağlıklı Yaşam ve Hijyen", "months": [9, 10]},
    {"num": 2, "name": "2. Ünite: Beslenme ve Fiziksel Aktivite", "months": [11, 12]},
    {"num": 3, "name": "3. Ünite: İlk Yardım Temel İlkeleri", "months": [1, 2]},
    {"num": 4, "name": "4. Ünite: Trafik Kuralları ve Güvenliği", "months": [3, 4]},
    {"num": 5, "name": "5. Ünite: Çevre ve Toplumsal Trafik Kültürü", "months": [5, 6]}
]
SAGLIK_WORDS = [
    {"word": "HİJYEN", "hint": "Sağlığı korumak amacıyla yapılan temizlik uygulamaları."},
    {"word": "İLKYARDIM", "hint": "Kaza anında yapılan ilk tıbbi müdahale."}
]

# Populate missing subjects to add
# 2. Sınıf
MISSING_SUBJECTS.append((2, "gorselsanat", "Görsel Sanatlar", "gorsel_sanatlar.json", GORSEL_UNITS, GORSEL_WORDS))
MISSING_SUBJECTS.append((2, "muzik", "Müzik", "muzik.json", MUZIK_UNITS, MUZIK_WORDS))
MISSING_SUBJECTS.append((2, "oyunfiziki", "Oyun ve Fiziki Etkinlikler", "oyun_fiziki.json", BEDEN_UNITS, BEDEN_WORDS))

# 3. Sınıf
MISSING_SUBJECTS.append((3, "din", "Din Kültürü ve Ahlak Bilgisi", "din.json", DIN_UNITS, DIN_WORDS))
MISSING_SUBJECTS.append((3, "gorselsanat", "Görsel Sanatlar", "gorsel_sanatlar.json", GORSEL_UNITS, GORSEL_WORDS))
MISSING_SUBJECTS.append((3, "muzik", "Müzik", "muzik.json", MUZIK_UNITS, MUZIK_WORDS))
MISSING_SUBJECTS.append((3, "bedenegitimi", "Beden Eğitimi ve Spor", "beden_egitimi.json", BEDEN_UNITS, BEDEN_WORDS))

# 4. Sınıf
MISSING_SUBJECTS.append((4, "din", "Din Kültürü ve Ahlak Bilgisi", "din.json", DIN_UNITS, DIN_WORDS))
MISSING_SUBJECTS.append((4, "gorselsanat", "Görsel Sanatlar", "gorsel_sanatlar.json", GORSEL_UNITS, GORSEL_WORDS))
MISSING_SUBJECTS.append((4, "muzik", "Müzik", "muzik.json", MUZIK_UNITS, MUZIK_WORDS))
MISSING_SUBJECTS.append((4, "bedenegitimi", "Beden Eğitimi ve Spor", "beden_egitimi.json", BEDEN_UNITS, BEDEN_WORDS))

# 5. Sınıf
MISSING_SUBJECTS.append((5, "din", "Din Kültürü ve Ahlak Bilgisi", "din.json", DIN_UNITS, DIN_WORDS))
MISSING_SUBJECTS.append((5, "gorselsanat", "Görsel Sanatlar", "gorsel_sanatlar.json", GORSEL_UNITS, GORSEL_WORDS))
MISSING_SUBJECTS.append((5, "muzik", "Müzik", "muzik.json", MUZIK_UNITS, MUZIK_WORDS))
MISSING_SUBJECTS.append((5, "bedenegitimi", "Beden Eğitimi ve Spor", "beden_egitimi.json", BEDEN_UNITS, BEDEN_WORDS))
MISSING_SUBJECTS.append((5, "bilisim", "Bilişim Teknolojileri ve Yazılım", "bilisim_teknolojileri.json", BILISIM_UNITS, BILISIM_WORDS))
MISSING_SUBJECTS.append((5, "rehberlik", "Rehberlik ve Yönlendirme", "rehberlik.json", REHBERLIK_UNITS, REHBERLIK_WORDS))

# 6. Sınıf
MISSING_SUBJECTS.append((6, "din", "Din Kültürü ve Ahlak Bilgisi", "din.json", DIN_UNITS, DIN_WORDS))
MISSING_SUBJECTS.append((6, "gorselsanat", "Görsel Sanatlar", "gorsel_sanatlar.json", GORSEL_UNITS, GORSEL_WORDS))
MISSING_SUBJECTS.append((6, "muzik", "Müzik", "muzik.json", MUZIK_UNITS, MUZIK_WORDS))
MISSING_SUBJECTS.append((6, "bedenegitimi", "Beden Eğitimi ve Spor", "beden_egitimi.json", BEDEN_UNITS, BEDEN_WORDS))
MISSING_SUBJECTS.append((6, "bilisim", "Bilişim Teknolojileri ve Yazılım", "bilisim_teknolojileri.json", BILISIM_UNITS, BILISIM_WORDS))
MISSING_SUBJECTS.append((6, "rehberlik", "Rehberlik ve Yönlendirme", "rehberlik.json", REHBERLIK_UNITS, REHBERLIK_WORDS))

# 7. Sınıf
MISSING_SUBJECTS.append((7, "din", "Din Kültürü ve Ahlak Bilgisi", "din.json", DIN_UNITS, DIN_WORDS))
MISSING_SUBJECTS.append((7, "gorselsanat", "Görsel Sanatlar", "gorsel_sanatlar.json", GORSEL_UNITS, GORSEL_WORDS))
MISSING_SUBJECTS.append((7, "muzik", "Müzik", "muzik.json", MUZIK_UNITS, MUZIK_WORDS))
MISSING_SUBJECTS.append((7, "bedenegitimi", "Beden Eğitimi ve Spor", "beden_egitimi.json", BEDEN_UNITS, BEDEN_WORDS))
MISSING_SUBJECTS.append((7, "bilisim", "Bilişim Teknolojileri ve Yazılım", "bilisim_teknolojileri.json", BILISIM_UNITS, BILISIM_WORDS))
MISSING_SUBJECTS.append((7, "rehberlik", "Rehberlik ve Yönlendirme", "rehberlik.json", REHBERLIK_UNITS, REHBERLIK_WORDS))

# 8. Sınıf
MISSING_SUBJECTS.append((8, "din", "Din Kültürü ve Ahlak Bilgisi", "din.json", DIN_UNITS, DIN_WORDS))
MISSING_SUBJECTS.append((8, "gorselsanat", "Görsel Sanatlar", "gorsel_sanatlar.json", GORSEL_UNITS, GORSEL_WORDS))
MISSING_SUBJECTS.append((8, "muzik", "Müzik", "muzik.json", MUZIK_UNITS, MUZIK_WORDS))
MISSING_SUBJECTS.append((8, "bedenegitimi", "Beden Eğitimi ve Spor", "beden_egitimi.json", BEDEN_UNITS, BEDEN_WORDS))
MISSING_SUBJECTS.append((8, "bilisim", "Bilişim Teknolojileri ve Yazılım", "bilisim_teknolojileri.json", BILISIM_UNITS, BILISIM_WORDS))
MISSING_SUBJECTS.append((8, "rehberlik", "Rehberlik ve Yönlendirme", "rehberlik.json", REHBERLIK_UNITS, REHBERLIK_WORDS))

# 9. Sınıf
MISSING_SUBJECTS.append((9, "din", "Din Kültürü ve Ahlak Bilgisi", "din.json", DIN_UNITS, DIN_WORDS))
MISSING_SUBJECTS.append((9, "bedenegitimi", "Beden Eğitimi ve Spor", "beden_egitimi.json", BEDEN_UNITS, BEDEN_WORDS))
MISSING_SUBJECTS.append((9, "gorselsanat", "Görsel Sanatlar", "gorsel_sanatlar.json", GORSEL_UNITS, GORSEL_WORDS))
MISSING_SUBJECTS.append((9, "muzik", "Müzik", "muzik.json", MUZIK_UNITS, MUZIK_WORDS))
MISSING_SUBJECTS.append((9, "saglik", "Sağlık Bilgisi ve Trafik Kültürü", "saglik_bilgisi.json", SAGLIK_UNITS, SAGLIK_WORDS))
MISSING_SUBJECTS.append((9, "rehberlik", "Rehberlik ve Yönlendirme", "rehberlik.json", REHBERLIK_UNITS, REHBERLIK_WORDS))

# 10. Sınıf
MISSING_SUBJECTS.append((10, "din", "Din Kültürü ve Ahlak Bilgisi", "din.json", DIN_UNITS, DIN_WORDS))
MISSING_SUBJECTS.append((10, "bedenegitimi", "Beden Eğitimi ve Spor", "beden_egitimi.json", BEDEN_UNITS, BEDEN_WORDS))
MISSING_SUBJECTS.append((10, "felsefe", "Felsefe", "felsefe.json", FELSEFE_UNITS, FELSEFE_WORDS))
MISSING_SUBJECTS.append((10, "rehberlik", "Rehberlik ve Yönlendirme", "rehberlik.json", REHBERLIK_UNITS, REHBERLIK_WORDS))

# 11. Sınıf
MISSING_SUBJECTS.append((11, "din", "Din Kültürü ve Ahlak Bilgisi", "din.json", DIN_UNITS, DIN_WORDS))
MISSING_SUBJECTS.append((11, "bedenegitimi", "Beden Eğitimi ve Spor", "beden_egitimi.json", BEDEN_UNITS, BEDEN_WORDS))
MISSING_SUBJECTS.append((11, "felsefe", "Felsefe", "felsefe.json", FELSEFE_UNITS, FELSEFE_WORDS))
MISSING_SUBJECTS.append((11, "rehberlik", "Rehberlik ve Yönlendirme", "rehberlik.json", REHBERLIK_UNITS, REHBERLIK_WORDS))

# 12. Sınıf
MISSING_SUBJECTS.append((12, "din", "Din Kültürü ve Ahlak Bilgisi", "din.json", DIN_UNITS, DIN_WORDS))
MISSING_SUBJECTS.append((12, "bedenegitimi", "Beden Eğitimi ve Spor", "beden_egitimi.json", BEDEN_UNITS, BEDEN_WORDS))
MISSING_SUBJECTS.append((12, "felsefe", "Felsefe", "felsefe.json", FELSEFE_UNITS, FELSEFE_WORDS))
MISSING_SUBJECTS.append((12, "rehberlik", "Rehberlik ve Yönlendirme", "rehberlik.json", REHBERLIK_UNITS, REHBERLIK_WORDS))

# Read curriculum_index.json
with open(CURRICULUM_INDEX_PATH, "r", encoding="utf-8") as f:
    ci = json.load(f)

grade_map = {str(g["grade"]): g for g in ci["curriculum"]}

print("Generating placeholders and updating curriculum_index...")
ci_changed = False

for (grade_num, subj_id, subj_name, file_name, units, mock_words) in MISSING_SUBJECTS:
    gs = str(grade_num)
    g_item = grade_map.get(gs)
    if not g_item:
        continue

    # Check if already exists in curriculum_index
    existing_ids = [s["id"] for s in g_item.get("subjects", [])]
    if subj_id in existing_ids:
        continue

    # Create target directory and write JSON file
    target_dir = f"data/grade_{grade_num}"
    os.makedirs(target_dir, exist_ok=True)
    full_path = os.path.join(target_dir, file_name)
    
    # Check if target JSON already exists, if so load it or create new
    if os.path.exists(full_path):
        with open(full_path, "r", encoding="utf-8") as f:
            subject_data = json.load(f)
    else:
        # Build placeholder units
        all_units = []
        for u in units:
            all_units.append({
                "id": f"{subj_id}_u{u['num']}",
                "name": u["name"],
                "months": u["months"],
                "words": mock_words
            })
        subject_data = {"subject": subj_name, "units": all_units}
        with open(full_path, "w", encoding="utf-8") as f:
            json.dump(subject_data, f, ensure_ascii=False, indent=2)
        print(f"  Created placeholder: {full_path}")

    # Add to curriculum_index.json subjects list
    g_item["subjects"].append({
        "id": subj_id,
        "name": subj_name,
        "dataFile": f"./data/grade_{grade_num}/{file_name}"
    })
    ci_changed = True

# Write updated curriculum_index.json
if ci_changed:
    with open(CURRICULUM_INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(ci, f, ensure_ascii=False, indent=2)
    print("\nSuccessfully updated curriculum_index.json with missing subjects!")
else:
    print("\nNo changes made to curriculum_index.json.")
