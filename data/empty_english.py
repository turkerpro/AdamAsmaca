import os
import json

root = os.path.abspath('data')
total_emptied = 0

for grade_name in sorted([d for d in os.listdir(root) if d.startswith('grade_')]):
    grade_path = os.path.join(root, grade_name)
    eng_path = os.path.join(grade_path, 'ingilizce.json')
    
    if os.path.exists(eng_path):
        with open(eng_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        modified = False
        for unit in data.get('units', []):
            if len(unit.get('words', [])) > 0:
                unit['words'] = []
                modified = True
                total_emptied += 1
                
        if modified:
            with open(eng_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
print(f"Toplam {total_emptied} İngilizce ünitesi tamamen boşaltıldı.")
