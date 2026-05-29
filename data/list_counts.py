import os, json, sys

def count_questions(unit):
    return len(unit.get('words', []))

def main(data_root='data'):
    root = os.path.abspath(data_root)
    for grade_name in sorted([d for d in os.listdir(root) if d.startswith('grade_')]):
        grade_path = os.path.join(root, grade_name)
        print(f"{grade_name}:")
        for subj_file in sorted([f for f in os.listdir(grade_path) if f.endswith('.json')]):
            subj_path = os.path.join(grade_path, subj_file)
            with open(subj_path, encoding='utf-8') as f:
                data = json.load(f)
            subject_name = data.get('subject', subj_file.replace('.json',''))
            print(f"  {subject_name}:")
            units = data.get('units', [])
            for unit in units:
                unit_name = unit.get('name', 'Unnamed')
                q_count = count_questions(unit)
                print(f"    {unit_name}: {q_count} soru")
        print()

if __name__ == '__main__':
    main()
