import os
import json

def has_mixed_vowels(word):
    # Check if word contains 'İ' and any of 'A', 'I', 'O', 'U'
    word = word.upper()
    has_i_dotted = 'İ' in word
    has_back_vowels = any(c in word for c in ['A', 'I', 'O', 'U'])
    return has_i_dotted and has_back_vowels

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    curriculum_path = os.path.join(base_dir, "..", "curriculum_index.json")
    if not os.path.exists(curriculum_path):
        curriculum_path = os.path.join(base_dir, "curriculum_index.json")
        
    with open(curriculum_path, "r", encoding="utf-8") as f:
        curriculum = json.load(f)
        
    suspicious_words = []
    
    for grade_item in curriculum.get("curriculum", []):
        for subject in grade_item.get("subjects", []):
            subj_name = subject.get("name")
            data_file = subject.get("dataFile").replace("./", "")
            # Skip English words, but check English hints? Let's skip English files for now
            if "ingilizce" in data_file.lower():
                continue
                
            full_path = os.path.normpath(os.path.join(os.path.dirname(curriculum_path), data_file))
            if os.path.exists(full_path):
                with open(full_path, "r", encoding="utf-8") as f_subj:
                    data = json.load(f_subj)
                for unit in data.get("units", []):
                    for w_entry in unit.get("words", []):
                        word = w_entry.get("word", "")
                        if has_mixed_vowels(word):
                            suspicious_words.append({
                                "grade": grade_item.get("gradeName"),
                                "subject": subj_name,
                                "unit": unit.get("name"),
                                "word": word,
                                "hint": w_entry.get("hint"),
                                "file": data_file
                            })
                            
    print(f"Total suspicious words found: {len(suspicious_words)}")
    # Print the first 100 suspicious words to see them
    for item in suspicious_words[:150]:
        print(f"[{item['grade']}][{item['subject']}] {item['word']} (Hint: {item['hint']})")

if __name__ == "__main__":
    main()
