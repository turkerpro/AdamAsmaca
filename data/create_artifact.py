import os
import json
import codecs

def count_questions(unit):
    return len(unit.get('words', []))

def main():
    root = os.path.abspath('data')
    output_lines = ["# Tm Snflar ve Mfredat Soru Saylar Raporu\n"]
    output_lines.append("Aada 1. Snftan 12. Snfa kadar tm dersler, niteler ve sahip olduklar soru saylar listelenmitir.\n")
    output_lines.append("```text")
    
    for grade_name in sorted([d for d in os.listdir(root) if d.startswith('grade_')], key=lambda x: int(x.split('_')[1])):
        grade_path = os.path.join(root, grade_name)
        output_lines.append(f"{grade_name.replace('grade_', '')}. SINIF")
        output_lines.append("-" * 40)
        
        for subj_file in sorted([f for f in os.listdir(grade_path) if f.endswith('.json')]):
            subj_path = os.path.join(grade_path, subj_file)
            with open(subj_path, encoding='utf-8') as f:
                data = json.load(f)
            subject_name = data.get('subject', subj_file.replace('.json',''))
            output_lines.append(f"  DERS: {subject_name.upper()}")
            
            units = data.get('units', [])
            for unit in units:
                unit_name = unit.get('name', 'Adsz nite')
                q_count = count_questions(unit)
                output_lines.append(f"    - {unit_name}: {q_count} soru")
        output_lines.append("\n")
        
    output_lines.append("```")
    
    artifact_path = r"C:\Users\tt\.gemini\antigravity\brain\9bb0811e-6bb9-4953-8b46-b60478593258\mufredat_raporu.md"
    
    with codecs.open(artifact_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(output_lines))
        
    print("Artifact created at", artifact_path)

if __name__ == '__main__':
    main()
