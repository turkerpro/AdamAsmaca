import os
import json
import sys

CURRICULUM_INDEX_PATH = "curriculum_index.json"
if not os.path.exists(CURRICULUM_INDEX_PATH):
    CURRICULUM_INDEX_PATH = "../curriculum_index.json"

MEB_MASTER_PATH = "data/meb_master.json"
if not os.path.exists(MEB_MASTER_PATH):
    MEB_MASTER_PATH = "meb_master.json"

with open(CURRICULUM_INDEX_PATH, "r", encoding="utf-8") as f:
    curriculum = json.load(f)

with open(MEB_MASTER_PATH, "r", encoding="utf-8") as f:
    meb_master = json.load(f)

def get_subject_type(subj_id):
    s = subj_id.lower()
    for key in ["matematik", "turkce", "edebiyat", "hayat", "fen", "fizik", "kimya", "biyoloji", "sosyal", "tarih", "cografya", "inkilap", "ingilizce"]:
        if key in s:
            return key
    return None

base_dir = os.path.dirname(CURRICULUM_INDEX_PATH)
mismatched_files = []
total_checked = 0

for grade_item in curriculum.get("curriculum", []):
    g_num = str(grade_item["grade"])
    grade_name = grade_item["gradeName"]
    master_grade_curriculum = meb_master.get(g_num, {})
    
    for subject in grade_item.get("subjects", []):
        subj_id = subject["id"]
        subj_name = subject["name"]
        data_file_rel = subject["dataFile"].replace("./", "")
        full_data_path = os.path.normpath(os.path.join(base_dir, data_file_rel))
        
        subj_type = get_subject_type(subj_id)
        if not subj_type:
            continue
            
        standard_units = master_grade_curriculum.get(subj_type, [])
        if not standard_units:
            continue
            
        if not os.path.exists(full_data_path):
            continue
            
        total_checked += 1
        with open(full_data_path, "r", encoding="utf-8") as f:
            try:
                subject_data = json.load(f)
            except Exception:
                continue
                
        existing_units = subject_data.get("units", [])
        
        # Check if unit count matches
        if len(existing_units) != len(standard_units):
            mismatched_files.append((data_file_rel, f"Unit count mismatch: expected {len(standard_units)}, got {len(existing_units)}"))
            continue
            
        # Check if unit names match standard names
        mismatch_found = False
        for std_u, ext_u in zip(standard_units, existing_units):
            std_name = std_u["name"]
            ext_name = ext_u.get("name", "")
            # check if names are close or match
            if std_name.strip().lower() != ext_name.strip().lower():
                mismatched_files.append((data_file_rel, f"Unit name mismatch: expected '{std_name}', got '{ext_name}'"))
                mismatch_found = True
                break
                
print(f"Total checked files: {total_checked}")
print(f"Mismatched files: {len(mismatched_files)}")
for file, reason in mismatched_files:
    print(f" - {file}: {reason}")
