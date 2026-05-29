import os
import json

def main():
    if not os.path.exists("curriculum_index.json") and os.path.exists("../curriculum_index.json"):
        index_path = "../curriculum_index.json"
    else:
        index_path = "curriculum_index.json"
        
    with open(index_path, "r", encoding="utf-8") as f:
        curriculum_data = json.load(f)
        
    base_dir = os.path.dirname(index_path)
    
    empty_or_low_units = []
    total_units = 0
    missing_files = []

    for grade_item in curriculum_data.get("curriculum", []):
        grade_name = grade_item.get("gradeName")
        
        for subject in grade_item.get("subjects", []):
            subj_name = subject.get("name")
            data_file_path = subject.get("dataFile")
            full_data_path = os.path.join(base_dir, data_file_path.replace("./", ""))
            
            if not os.path.exists(full_data_path):
                missing_files.append(full_data_path)
                continue
                
            with open(full_data_path, "r", encoding="utf-8") as f:
                subject_data = json.load(f)
                
            units = subject_data.get("units", [])
            for unit in units:
                total_units += 1
                q_count = len(unit.get("words", []))
                if q_count < 50:
                    empty_or_low_units.append({
                        "grade": grade_name,
                        "subject": subj_name,
                        "unit": unit.get("name"),
                        "count": q_count,
                        "file": full_data_path
                    })

    print(f"Denetim tamamlandi. Toplam {total_units} unite tarandi.")
    
    if missing_files:
        print("\n[HATA] Bulunamayan Dosyalar:")
        for mf in missing_files:
            print(f"  - {mf}")
            
    if empty_or_low_units:
        print(f"\n[UYARI] 50'den az kelimesi olan ({len(empty_or_low_units)} adet) unite tespit edildi:")
        for item in empty_or_low_units:
            print(f"  - {item['grade']} > {item['subject']} > {item['unit']} (Mevcut Soru: {item['count']})")
    else:
        print("\n[BASARILI] Mukemmel! Tum unitelerde en az 50 soru bulunmaktadir (Eksik yok).")

if __name__ == "__main__":
    main()
