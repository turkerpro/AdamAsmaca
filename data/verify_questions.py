import os
import json
import sys

CURRICULUM_INDEX_PATH = "../curriculum_index.json"
if not os.path.exists(CURRICULUM_INDEX_PATH) and os.path.exists("curriculum_index.json"):
    CURRICULUM_INDEX_PATH = "curriculum_index.json"

if not os.path.exists(CURRICULUM_INDEX_PATH):
    print("Hata: curriculum_index.json bulunamadı. Lütfen scripti proje kök dizininde veya 'data' klasöründe çalıştırın.")
    sys.exit(1)

with open(CURRICULUM_INDEX_PATH, "r", encoding="utf-8") as f:
    curriculum_data = json.load(f)

print("====================================================")
print("            MÜFREDAT SORU DOĞRULAMA                  ")
print("====================================================")

total_units = 0
complete_units = 0
incomplete_units = 0

issues = []

for grade_item in curriculum_data.get("curriculum", []):
    grade_name = grade_item.get("gradeName")
    
    for subject in grade_item.get("subjects", []):
        subj_name = subject.get("name")
        data_file_path = subject.get("dataFile")
        
        base_dir = os.path.dirname(CURRICULUM_INDEX_PATH)
        full_data_path = os.path.join(base_dir, data_file_path.replace("./", ""))
        
        if not os.path.exists(full_data_path):
            issues.append(f"[KRİTİK] Dosya bulunamadı: {data_file_path} ({grade_name} - {subj_name})")
            continue
            
        with open(full_data_path, "r", encoding="utf-8") as f:
            try:
                subject_data = json.load(f)
            except Exception as e:
                issues.append(f"[BOZUK JSON] {data_file_path} okunamadı: {str(e)}")
                continue
                
        for unit in subject_data.get("units", []):
            unit_name = unit.get("name")
            words = unit.get("words", [])
            count = len(words)
            total_units += 1
            
            if count >= 50:
                complete_units += 1
            else:
                incomplete_units += 1
                issues.append(f"[{grade_name} - {subj_name}] {unit_name}: {count} kelime var (Eksik: {50 - count})")

# Print Report
if issues:
    print(f"\n{len(issues)} sorun bulundu:")
    for issue in issues:
        print("  " + issue)
else:
    print("\n[TEBRİKLER] Tüm sınıfların tüm ünitelerinde en az 50 soru var. Sistem kusursuz çalışıyor!")

print(f"\nÖzet:")
print(f"  Toplam Taranan Ünite: {total_units}")
print(f"  Hedefe Ulaşan Ünite (50+ Soru): {complete_units}")
print(f"  Eksik Kalan Ünite: {incomplete_units}")
print("====================================================")
