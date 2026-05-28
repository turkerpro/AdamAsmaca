import os
import json
import re

CURRICULUM_INDEX_PATH = "curriculum_index.json"
if not os.path.exists(CURRICULUM_INDEX_PATH):
    CURRICULUM_INDEX_PATH = "../curriculum_index.json"

with open(CURRICULUM_INDEX_PATH, "r", encoding="utf-8") as f:
    curriculum = json.load(f)

TURKISH_CASING_MAP = {
    "İSİ": "ISI",
    "İŞİK": "IŞIK",
    "YİLDİZ": "YILDIZ",
    "SİVİ": "SIVI",
    "KİLİF": "KILIF",
    "SİCAKLİK": "SICAKLIK",
    "YANSİMA": "YANSIMA",
    "YALİTKAN": "YALITKAN",
    "AKİSKANLİK": "AKIŞKANLIK",
    "KATİLİK": "KATILIK",
    "BASKİ": "BASKI",
    "YAKİN": "YAKIN",
    "YALNİZ": "YALNIZ",
    "İRKÇİLİK": "IRKÇILIK",
    "SİCAK": "SICAK",
    "İŞİ": "IŞI",
    "İSİTMA": "ISITMA",
    "İSİNMA": "ISINMA",
    "KİRİLMA": "KIRILMA",
    "KİRİLMASİ": "KIRILMASI",
    "BASİNÇ": "BASINÇ",
    "YANKİ": "YANKI",
    "İRAKSAK": "IRAKSAK",
    "AÇİ": "AÇI",
    "MİKNATİS": "MIKNATIS",
    "KATI": "KATI",
    "İSİL": "ISIL",
    "KİRİLMALİ": "KIRILMALI",
}

def to_tr_uppercase(text):
    if not text:
        return ""
    text = text.replace("i", "İ").replace("ı", "I").replace("ş", "Ş").replace("ç", "Ç").replace("ğ", "Ğ").replace("ü", "Ü").replace("ö", "Ö")
    return text.upper()

def clean_word(word, is_english):
    if not word:
        return ""
    
    # 1. Normalize casing
    if is_english:
        word = word.upper()
        # Replace Turkish characters in English words just in case
        word = word.replace("İ", "I").replace("ı", "I").replace("Ş", "S").replace("Ç", "C").replace("Ğ", "G").replace("Ü", "U").replace("Ö", "O")
    else:
        word = to_tr_uppercase(word)
        # Apply Turkish casing map
        if word in TURKISH_CASING_MAP:
            word = TURKISH_CASING_MAP[word]
        else:
            for k, v in TURKISH_CASING_MAP.items():
                if k in word:
                    word = word.replace(k, v)
                    
    # 2. Replace hyphens, underscores, and slashes with space
    word = word.replace("-", " ").replace("_", " ").replace("/", " ")
    
    # 3. Strip any characters that are not letters or spaces
    if is_english:
        word = re.sub(r"[^A-Z ]", "", word)
    else:
        word = re.sub(r"[^A-ZÇĞİÖŞÜ ]", "", word)
        
    # 4. Clean up spaces
    word = re.sub(r"\s+", " ", word).strip()
    return word

base_dir = os.path.dirname(CURRICULUM_INDEX_PATH)
cleaned_files = 0
total_words_fixed = 0

for grade_item in curriculum.get("curriculum", []):
    grade_name = grade_item["gradeName"]
    
    for subject in grade_item.get("subjects", []):
        subj_id = subject["id"]
        subj_name = subject["name"]
        data_file_rel = subject["dataFile"].replace("./", "")
        full_data_path = os.path.normpath(os.path.join(base_dir, data_file_rel))
        
        if not os.path.exists(full_data_path):
            continue
            
        with open(full_data_path, "r", encoding="utf-8") as f:
            try:
                subject_data = json.load(f)
            except Exception:
                continue
                
        is_english = (subj_id.lower() == "ingilizce")
        modified = False
        
        for unit in subject_data.get("units", []):
            words = unit.get("words", [])
            new_words = []
            seen = set()
            
            for w_entry in words:
                raw_w = w_entry.get("word", "")
                raw_h = w_entry.get("hint", "")
                
                if not raw_w or not raw_h:
                    continue
                    
                cleaned_w = clean_word(raw_w, is_english)
                
                # Check if word is valid (contains at least one letter)
                if not cleaned_w or len(cleaned_w) < 2:
                    total_words_fixed += 1
                    modified = True
                    continue
                    
                if cleaned_w != raw_w:
                    total_words_fixed += 1
                    modified = True
                    
                if cleaned_w not in seen:
                    new_words.append({"word": cleaned_w, "hint": raw_h})
                    seen.add(cleaned_w)
                else:
                    total_words_fixed += 1
                    modified = True
                    
            unit["words"] = new_words
            
        if modified:
            with open(full_data_path, "w", encoding="utf-8") as f:
                json.dump(subject_data, f, ensure_ascii=False, indent=2)
            cleaned_files += 1

print(f"Programmatic cleanup complete.")
print(f"Total files updated: {cleaned_files}")
print(f"Total problematic words cleaned/removed: {total_words_fixed}")
