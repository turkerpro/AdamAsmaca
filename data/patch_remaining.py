import json
import os

patches = [
    {
        "file": "grade_5/fen.json",
        "unit_match": "8.",
        "words": [{"word": "PİLYATAĞI", "hint": "Pillerin devrede düzgün durması için yerleştirildiği bölme"}]
    },
    {
        "file": "grade_6/sosyal.json",
        "unit_match": "2.",
        "words": [{"word": "ÇOĞULCULUK", "hint": "Farklı görüş ve düşüncelerin yönetimde temsil edilmesi"}]
    },
    {
        "file": "grade_7/sosyal.json",
        "unit_match": "2.",
        "words": [{"word": "KAMUOYU", "hint": "Bir konu hakkında halkın genel düşüncesi ve ortak fikri"}]
    },
    {
        "file": "grade_7/ingilizce.json",
        "unit_match": "2.",
        "words": [{"word": "ECOSYSTEM", "hint": "A biological community of interacting organisms and their physical environment"}]
    },
    {
        "file": "grade_11/matematik.json",
        "unit_match": "1.",
        "words": [{"word": "ANLIKHIZ", "hint": "Bir hareketlinin belirli bir andaki yer değiştirme oranı"}]
    },
    {
        "file": "grade_11/cografya.json",
        "unit_match": "1.",
        "words": [
            {"word": "BİYOÇEŞİTLİLİK", "hint": "Bir bölgedeki gen, tür ve ekosistemlerin oluşturduğu yaşam çeşitliliği"},
            {"word": "AEROSOL", "hint": "Rüzgarlarla atmosfere taşınan ve yağışlarla toprağa düşen deniz tuzu tanecikleri"}
        ]
    }
]

for p in patches:
    file_path = p["file"]
    unit_match = p["unit_match"]
    words_to_add = p["words"]
    
    if not os.path.exists(file_path):
        print(f"Dosya bulunamadı: {file_path}")
        continue
        
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    modified = False
    for unit in data.get("units", []):
        unit_name = unit.get("name", "").strip()
        # Match by prefix (e.g. startswith("8."))
        if unit_name.startswith(unit_match):
            # Normalize existing words comparison to ignore minor character deviations
            existing_words = [w["word"].upper().replace("I\u0307", "İ").replace("\u0307", "") for w in unit.get("words", [])]
            for w in words_to_add:
                word_up = w["word"].upper()
                if word_up not in existing_words:
                    unit["words"].append(w)
                    print(f"Eklendi: {file_path} -> {w['word']}")
                    modified = True
                    
    if modified:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
print("Patch tamamlandı.")
