import os
import json
import re

CURRICULUM_INDEX_PATH = "curriculum_index.json"
if not os.path.exists(CURRICULUM_INDEX_PATH):
    CURRICULUM_INDEX_PATH = "../curriculum_index.json"

with open(CURRICULUM_INDEX_PATH, "r", encoding="utf-8") as f:
    curriculum = json.load(f)

BAD_WORDS = ["İSİ", "İŞİK", "İRAKSAK", "YİLDİZ", "SİCAKLİK", "YANSİMA", "YALİTKAN", "AKİSKANLİK", "KATİLİK", "BASKİ", "YAKİN", "YALNİZ", "İRKÇİLİK", "SİVİ", "KİLİF", "İSİTMA", "İSİNMA", "KİRİLMASİ", "BASİNÇ", "YANKİ"]

units_with_issues = []
total_units = 0

for grade_item in curriculum.get("curriculum", []):
    g_num = str(grade_item["grade"])
    grade_name = grade_item["gradeName"]
    
    for subject in grade_item.get("subjects", []):
        subj_id = subject["id"]
        subj_name = subject["name"]
        data_file_rel = subject["dataFile"].replace("./", "")
        full_data_path = os.path.join(os.path.dirname(CURRICULUM_INDEX_PATH), data_file_rel)
        
        if not os.path.exists(full_data_path):
            continue
            
        with open(full_data_path, "r", encoding="utf-8") as f:
            try:
                subject_data = json.load(f)
            except Exception:
                continue
                
        is_english = (subj_id.lower() == "ingilizce")
        
        for unit in subject_data.get("units", []):
            total_units += 1
            words = unit.get("words", [])
            unit_name = unit.get("name", "")
            
            issues = []
            
            # Check count
            if len(words) < 50:
                issues.append(f"Low count: {len(words)} words")
                
            # Check for bad casing/words
            bad_word_count = 0
            punctuation_count = 0
            number_count = 0
            
            for w_entry in words:
                w_word = w_entry.get("word", "").strip()
                if not w_word:
                    continue
                
                # Check for known bad casing
                if any(bad in w_word for bad in BAD_WORDS):
                    bad_word_count += 1
                
                # Check for punctuation in word
                # spaces are allowed
                if re.search(r"[^A-ZÇĞİÖŞÜa-zçğıüşö ]", w_word):
                    punctuation_count += 1
                    
                # Check if it has numbers
                if re.search(r"\d", w_word):
                    number_count += 1
            
            if bad_word_count > 0:
                issues.append(f"{bad_word_count} words with bad casing")
            if punctuation_count > 0:
                issues.append(f"{punctuation_count} words with punctuation/numbers")
                
            if issues:
                units_with_issues.append({
                    "grade": grade_name,
                    "subject": subj_name,
                    "unit": unit_name,
                    "file": data_file_rel,
                    "issues": issues,
                    "total_words": len(words)
                })

print(f"Total units scanned: {total_units}")
print(f"Units with issues: {len(units_with_issues)}")
for u in units_with_issues[:30]:
    print(f"[{u['grade']} - {u['subject']}] {u['unit']} ({u['file']})")
    print(f"  Issues: {', '.join(u['issues'])}")
