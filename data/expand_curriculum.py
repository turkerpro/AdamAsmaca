import json
import os
import sys

CURRICULUM_INDEX_PATH = "../curriculum_index.json"
if not os.path.exists(CURRICULUM_INDEX_PATH) and os.path.exists("curriculum_index.json"):
    CURRICULUM_INDEX_PATH = "curriculum_index.json"

if not os.path.exists(CURRICULUM_INDEX_PATH):
    print("Hata: curriculum_index.json bulunamadı. Lütfen scripti proje kök dizininde veya 'data' klasöründe çalıştırın.")
    sys.exit(1)

with open(CURRICULUM_INDEX_PATH, "r", encoding="utf-8") as f:
    curriculum_data = json.load(f)

# Define standard MEB units for each subject type
MEB_CURRICULUM = {
    "matematik": [
        {"num": 1, "name": "Doğal Sayılar ve İşlemler", "months": [9, 10]},
        {"num": 2, "name": "Kesirler ve Bölünebilme", "months": [11, 12]},
        {"num": 3, "name": "Ondalık Gösterim ve Oran", "months": [1, 2]},
        {"num": 4, "name": "Cebirsel İfadeler ve Veri Analizi", "months": [3]},
        {"num": 5, "name": "Açılar ve Alan Ölçme", "months": [4, 5]},
        {"num": 6, "name": "Çember ve Geometrik Cisimler", "months": [6]}
    ],
    "turkce": [
        {"num": 1, "name": "Sözcükte Anlam ve Okuma", "months": [9, 10]},
        {"num": 2, "name": "Cümlede Anlam ve Yazım Kuralları", "months": [11, 12]},
        {"num": 3, "name": "Paragrafta Anlam ve Noktalama", "months": [1, 2]},
        {"num": 4, "name": "Metin Türleri ve Söz Sanatları", "months": [3, 4]},
        {"num": 5, "name": "Dil Bilgisi ve Ses Olayları", "months": [5]},
        {"num": 6, "name": "Sözlü İletişim ve Anlatım Bozuklukları", "months": [6]}
    ],
    "edebiyat": [
        {"num": 1, "name": "Edebiyata Giriş ve Metinlerin Sınıflandırılması", "months": [9, 10]},
        {"num": 2, "name": "Hikaye ve Anlatım Türleri", "months": [11, 12]},
        {"num": 3, "name": "Şiir Bilgisi ve Nazım Biçimleri", "months": [1, 2]},
        {"num": 4, "name": "Masal, Fabl ve Destan", "months": [3]},
        {"num": 5, "name": "Tiyatro ve Roman", "months": [4, 5]},
        {"num": 6, "name": "Öğretici Metinler ve Dil Bilgisi", "months": [6]}
    ],
    "hayat": [
        {"num": 1, "name": "Okulumuzda Hayat", "months": [9, 10]},
        {"num": 2, "name": "Evimizde Hayat", "months": [11, 12]},
        {"num": 3, "name": "Sağlıklı Hayat", "months": [1, 2]},
        {"num": 4, "name": "Güvenli Hayat", "months": [3]},
        {"num": 5, "name": "Ülkemizde Hayat", "months": [4, 5]},
        {"num": 6, "name": "Doğada Hayat", "months": [6]}
    ],
    "fen": [
        {"num": 1, "name": "Güneş, Dünya ve Ay Sistemi", "months": [9, 10]},
        {"num": 2, "name": "Vücudumuzdaki Sistemler", "months": [11, 12]},
        {"num": 3, "name": "Kuvvet ve Hareket", "months": [1, 2]},
        {"num": 4, "name": "Madde ve Isı İlişkisi", "months": [3]},
        {"num": 5, "name": "Işığın Yayılması ve Yansıması", "months": [4]},
        {"num": 6, "name": "İnsan ve Çevre Etkileşimi", "months": [5]},
        {"num": 7, "name": "Basit Elektrik Devreleri", "months": [6]}
    ],
    "fizik": [
        {"num": 1, "name": "Fizik Bilimine Giriş ve Vektörler", "months": [9, 10]},
        {"num": 2, "name": "Madde ve Özellikleri, Hareket ve Kuvvet", "months": [11, 12]},
        {"num": 3, "name": "İş, Enerji ve Güç", "months": [1, 2]},
        {"num": 4, "name": "Isı ve Sıcaklık, Elektrostatik", "months": [3, 4]},
        {"num": 5, "name": "Basınç ve Dalgalar", "months": [5]},
        {"num": 6, "name": "Optik ve Aydınlanma", "months": [6]}
    ],
    "kimya": [
        {"num": 1, "name": "Kimya Bilimi ve Güvenlik", "months": [9, 10]},
        {"num": 2, "name": "Atom, Periyodik Sistem ve Elementler", "months": [11, 12]},
        {"num": 3, "name": "Kimyasal Türler Arası Etkileşimler", "months": [1, 2]},
        {"num": 4, "name": "Maddenin Fiziksel Halleri", "months": [3, 4]},
        {"num": 5, "name": "Doğa, Kimya ve Karışımlar", "months": [5]},
        {"num": 6, "name": "Asitler, Bazlar, Tuzlar ve Kimya Her Yerde", "months": [6]}
    ],
    "biyoloji": [
        {"num": 1, "name": "Yaşam Bilimi Biyoloji ve Hücre", "months": [9, 10]},
        {"num": 2, "name": "Canlılar Dünyası ve Sınıflandırma", "months": [11, 12]},
        {"num": 3, "name": "Hücre Bölünmeleri ve Üreme", "months": [1, 2]},
        {"num": 4, "name": "Kalıtımın Temel İlkeleri", "months": [3, 4]},
        {"num": 5, "name": "Ekosistem Ekolojisi ve Çevre Sorunları", "months": [5]},
        {"num": 6, "name": "Genden Proteine ve Canlılarda Enerji Dönüşümleri", "months": [6]}
    ],
    "sosyal": [
        {"num": 1, "name": "Birey, Toplum, Hak ve Sorumluluklar", "months": [9, 10]},
        {"num": 2, "name": "Kültür, Miras ve Tarihi Uygarlıklar", "months": [11, 12]},
        {"num": 3, "name": "İnsanlar, Yerler ve Çevreler", "months": [1, 2]},
        {"num": 4, "name": "Bilim, Teknoloji ve Toplumsal Gelişim", "months": [3]},
        {"num": 5, "name": "Üretim, Dağıtım ve Tüketim Ekonomisi", "months": [4]},
        {"num": 6, "name": "Etkin Vatandaşlık ve Yönetim Şekilleri", "months": [5]},
        {"num": 7, "name": "Küresel Bağlantılar ve Uluslararası İlişkiler", "months": [6]}
    ],
    "tarih": [
        {"num": 1, "name": "Tarih ve Zaman Bilimi", "months": [9]},
        {"num": 2, "name": "İnsanlığın İlk Dönemleri ve Medeniyetler", "months": [10, 11]},
        {"num": 3, "name": "Orta Çağ'da Dünya ve Türk Dünyası", "months": [12, 1]},
        {"num": 4, "name": "İslam Medeniyetinin Doğuşu ve Yayılışı", "months": [2, 3]},
        {"num": 5, "name": "Türklerin İslamiyet'i Kabulü ve İlk Devletler", "months": [4, 5]},
        {"num": 6, "name": "Yerleşme, Devletleşme ve Beylikten Devlete", "months": [6]}
    ],
    "cografya": [
        {"num": 1, "name": "Doğal Sistemler ve Harita Bilgisi", "months": [9, 10, 11]},
        {"num": 2, "name": "Beşeri Sistemler, Nüfus ve Yerleşme", "months": [12, 1, 2]},
        {"num": 3, "name": "Küresel Ortam: Bölgeler ve Ülkeler", "months": [3, 4]},
        {"num": 4, "name": "Çevre ve Toplum, Doğal Afetler", "months": [5, 6]}
    ],
    "inkilap": [
        {"num": 1, "name": "Bir Kahraman Doğuyor (Atatürk'ün Hayatı)", "months": [9]},
        {"num": 2, "name": "Milli Uyanış: Bağımsızlık Yolunda Atılan Adımlar", "months": [10, 11]},
        {"num": 3, "name": "Ya İstiklal Ya Ölüm! (Kurtuluş Savaşı)", "months": [12, 1]},
        {"num": 4, "name": "Atatürkçülük ve Çağdaşlaşan Türkiye (İnkılaplar)", "months": [2, 3]},
        {"num": 5, "name": "Demokratikleşme Çabaları ve Dış Politika", "months": [4, 5]},
        {"num": 6, "name": "Atatürk'ün Ölümü ve İkinci Dünya Savaşı", "months": [6]}
    ],
    "ingilizce": [
        {"num": 1, "name": "Unit 1: Greeting and Friends", "months": [9]},
        {"num": 2, "name": "Unit 2: My Family and Home", "months": [10]},
        {"num": 3, "name": "Unit 3: In the Classroom", "months": [11]},
        {"num": 4, "name": "Unit 4: Numbers and Colors", "months": [12]},
        {"num": 5, "name": "Unit 5: Toys and Games", "months": [1]},
        {"num": 6, "name": "Unit 6: My Body and Clothes", "months": [2]},
        {"num": 7, "name": "Unit 7: Pets and Animals", "months": [3]},
        {"num": 8, "name": "Unit 8: My Daily Routine", "months": [4]},
        {"num": 9, "name": "Unit 9: Fruits and Food", "months": [5]},
        {"num": 10, "name": "Unit 10: Animal Shelter and Nature", "months": [6]}
    ]
}

def get_subject_type(subj_id):
    s = subj_id.lower()
    if "matematik" in s: return "matematik"
    if "turkce" in s: return "turkce"
    if "edebiyat" in s: return "edebiyat"
    if "hayat" in s: return "hayat"
    if "fen" in s: return "fen"
    if "fizik" in s: return "fizik"
    if "kimya" in s: return "kimya"
    if "biyoloji" in s: return "biyoloji"
    if "sosyal" in s: return "sosyal"
    if "tarih" in s: return "tarih"
    if "cografya" in s: return "cografya"
    if "inkilap" in s: return "inkilap"
    if "ingilizce" in s: return "ingilizce"
    return None

base_dir = os.path.dirname(CURRICULUM_INDEX_PATH)

total_files_updated = 0

for grade_item in curriculum_data.get("curriculum", []):
    grade_name = grade_item.get("gradeName")
    
    for subject in grade_item.get("subjects", []):
        subj_id = subject.get("id")
        subj_name = subject.get("name")
        data_file_path = subject.get("dataFile")
        
        subj_type = get_subject_type(subj_id)
        if not subj_type:
            # Fallback based on name if ID doesn't match
            subj_type = get_subject_type(subj_name)
            
        if not subj_type:
            print(f"[UYARI] Eşleşen MEB müfredatı bulunamadı: {grade_name} - {subj_name} ({subj_id})")
            continue
            
        full_data_path = os.path.join(base_dir, data_file_path.replace("./", ""))
        
        if not os.path.exists(full_data_path):
            print(f"[HATA] Dosya bulunamadı: {full_data_path}")
            continue
            
        with open(full_data_path, "r", encoding="utf-8") as f:
            subject_data = json.load(f)
            
        existing_units = subject_data.get("units", [])
        standard_units = MEB_CURRICULUM[subj_type]
        
        new_units = []
        
        # Merge logic:
        # We build exactly the standard units list.
        # For each standard unit, we check if there is an existing unit in this JSON
        # that corresponds to the same unit index (e.g. 1st unit matches 1st unit).
        # If yes, we keep the existing unit's words. If not, we create an empty unit.
        
        for std_u in standard_units:
            u_num = std_u["num"]
            u_name = f"{u_num}. Ünite: {std_u['name']}"
            if subj_type == "ingilizce":
                u_name = std_u["name"] # Keep standard Unit 1: ... for English
                
            # Try to match with existing unit by index
            matched_existing = None
            if u_num - 1 < len(existing_units):
                matched_existing = existing_units[u_num - 1]
            
            if matched_existing:
                # Keep existing words and metadata, but normalize the name prefix just in case
                words = matched_existing.get("words", [])
                # Update months and name to fit standard if needed, or keep existing
                new_unit = {
                    "id": f"{subj_id}_u{u_num}",
                    "name": matched_existing.get("name", u_name),
                    "months": std_u["months"],
                    "words": words
                }
            else:
                # Create a new empty unit
                new_unit = {
                    "id": f"{subj_id}_u{u_num}",
                    "name": u_name,
                    "months": std_u["months"],
                    "words": []
                }
            new_units.append(new_unit)
            
        subject_data["units"] = new_units
        
        with open(full_data_path, "w", encoding="utf-8") as f:
            json.dump(subject_data, f, ensure_ascii=False, indent=2)
            
        total_files_updated += 1
        print(f"  [GÜNCELLENDİ] {grade_name} - {subj_name}: {len(new_units)} üniteye genişletildi.")

print(f"\n====================================================")
print(f"İŞLEM TAMAMLANDI! {total_files_updated} ders dosyası MEB standartlarına genişletildi.")
print(f"====================================================")
