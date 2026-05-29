import os
import json

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

def main():
    if not os.path.exists("meb_master.json"):
        print("Hata: meb_master.json bulunamadı. Lütfen önce build_meb_map.py çalıştırın.")
        return
        
    with open("meb_master.json", "r", encoding="utf-8") as f:
        meb_master = json.load(f)
        
    with open("../curriculum_index.json", "r", encoding="utf-8") as f:
        curriculum_index = json.load(f)
        
    base_dir = ".."
    total_files = 0
    
    for grade in curriculum_index.get("curriculum", []):
        g_num = str(grade["grade"])
        grade_name = grade["gradeName"]
        
        master_grade_curriculum = meb_master.get(g_num, {})
        
        for subject in grade.get("subjects", []):
            subj_id = subject["id"]
            subj_type = get_subject_type(subj_id)
            if not subj_type:
                continue
                
            standard_units = master_grade_curriculum.get(subj_type, [])
            if not standard_units:
                print(f"[UYARI] {grade_name} - {subj_type} için meb_master'da ünite bulunamadı!")
                continue
                
            data_file_path = os.path.join(base_dir, subject["dataFile"].replace("./", ""))
            if not os.path.exists(data_file_path):
                continue
                
            with open(data_file_path, "r", encoding="utf-8") as f:
                subject_data = json.load(f)
                
            existing_units = subject_data.get("units", [])
            new_units = []
            
            for std_u in standard_units:
                u_name = std_u.get("name", f"Ünite {std_u.get('num')}")
                
                # Check if we already have an existing unit with this EXACT name or very similar
                # If we do, we keep its words. If we don't, we create an empty one.
                # This ensures we don't keep garbage questions for incorrectly named units!
                matched_existing = next((u for u in existing_units if u.get("name", "").split(":")[0].strip() == u_name.split(":")[0].strip()), None)
                
                if matched_existing and len(matched_existing.get("words", [])) > 0:
                    new_units.append({
                        "id": f"{subj_id}_u{std_u.get('num')}",
                        "name": u_name,
                        "months": std_u.get("months", []),
                        "words": matched_existing["words"]
                    })
                else:
                    new_units.append({
                        "id": f"{subj_id}_u{std_u.get('num')}",
                        "name": u_name,
                        "months": std_u.get("months", []),
                        "words": []
                    })
                    
            subject_data["units"] = new_units
            
            with open(data_file_path, "w", encoding="utf-8") as f:
                json.dump(subject_data, f, ensure_ascii=False, indent=2)
            total_files += 1
            
    print(f"BAŞARILI: Toplam {total_files} JSON dosyası güncel MEB standartlarına uyarlandı ve hatalı üniteler temizlendi!")

if __name__ == "__main__":
    main()
