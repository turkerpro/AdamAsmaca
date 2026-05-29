import os
import json

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    curriculum_path = os.path.join(base_dir, "..", "curriculum_index.json")
    if not os.path.exists(curriculum_path):
        curriculum_path = os.path.join(base_dir, "curriculum_index.json")
        
    with open(curriculum_path, "r", encoding="utf-8") as f:
        curriculum = json.load(f)
        
    total_words = 0
    file_count = 0
    for grade_item in curriculum.get("curriculum", []):
        for subject in grade_item.get("subjects", []):
            data_file = subject.get("dataFile").replace("./", "")
            full_path = os.path.join(os.path.dirname(curriculum_path), data_file)
            if os.path.exists(full_path):
                file_count += 1
                with open(full_path, "r", encoding="utf-8") as f_subj:
                    data = json.load(f_subj)
                for unit in data.get("units", []):
                    total_words += len(unit.get("words", []))
                    
    print(f"Total files: {file_count}")
    print(f"Total words: {total_words}")

if __name__ == "__main__":
    main()
