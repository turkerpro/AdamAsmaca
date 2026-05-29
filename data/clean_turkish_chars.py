import os
import json
import glob

def clean_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # The buggy character sequences
    # 'i̇' (lowercase i with combining dot) and 'İ̇' (uppercase İ with combining dot)
    if 'i̇' in content or 'İ̇' in content or '\u0307' in content:
        # We replace the combining dot with empty string if it follows İ or I
        # Or just simply replace the known bad substrings
        content = content.replace("İ̇", "İ").replace("İ", "İ")
        content = content.replace("i̇", "i").replace("\u0307", "")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_files = glob.glob(os.path.join(base_dir, "grade_*", "*.json"))
    
    cleaned = 0
    for f in json_files:
        if clean_file(f):
            cleaned += 1
            print(f"Cleaned: {os.path.basename(f)}")
            
    print(f"Total files cleaned: {cleaned}/{len(json_files)}")

if __name__ == '__main__':
    main()
