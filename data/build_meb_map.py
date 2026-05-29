import os
import json
import time
from google import genai
from google.genai import types

with open('api_keys.txt', 'r') as f:
    keys = [k.strip() for k in f if k.strip()]

current_key = 0

def get_client():
    return genai.Client(api_key=keys[current_key])

def rotate_key():
    global current_key
    current_key = (current_key + 1) % len(keys)
    print(f"API Degisti: {current_key}")

def get_curriculum(grade_name, grade_level, subjects):
    prompt = f"""
Sen Türkiye MEB müfredatı uzmanısın.
Bana {grade_name} ({grade_level}. sınıf) seviyesindeki şu derslerin GÜNCEL (2024-2025) resmi MEB müfredat ünitelerini JSON formatında döndür.
Derslerin listesi: {', '.join(subjects)}

Lütfen ünite isimlerini '1. Ünite: Mantık' şeklinde formatla. İngilizce dersi için 'Unit 1: Greeting' gibi kullan.
Her ders (anahtar) için bir liste olsun. Liste içinde 'num' (tam sayı), 'name' (string) ve 'months' (tam sayı dizisi, 1-12) bulunsun.

Örnek format:
{{
  "matematik": [
    {{"num": 1, "name": "1. Ünite: Mantık", "months": [9, 10]}},
    {{"num": 2, "name": "2. Ünite: Kümeler", "months": [11, 12]}}
  ],
  "fizik": [
    {{"num": 1, "name": "1. Ünite: Fizik Bilimine Giriş", "months": [9]}}
  ]
}}
"""
    while True:
        try:
            client = get_client()
            res = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json"
                )
            )
            return json.loads(res.text.strip())
        except Exception as e:
            err = str(e).lower()
            if "429" in err or "quota" in err or "403" in err:
                rotate_key()
            else:
                print(f"Hata ({grade_level}. sinif): {e}")
                time.sleep(2)

def main():
    with open("../curriculum_index.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        
    master_map = {}
    
    for grade in data.get("curriculum", []):
        g_num = grade["grade"]
        g_name = grade["gradeName"]
        print(f"Üretiliyor: {g_name}...")
        
        subjects = []
        for s in grade.get("subjects", []):
            subj_id = s["id"].split("_")[0]
            if subj_id not in subjects:
                subjects.append(subj_id)
                
        c_data = get_curriculum(g_name, g_num, subjects)
        master_map[str(g_num)] = c_data
        time.sleep(1)
        
    with open("meb_master.json", "w", encoding="utf-8") as f:
        json.dump(master_map, f, ensure_ascii=False, indent=2)
        
    print("Master Curriculum Mapping Tamamlandı! meb_master.json oluşturuldu.")

if __name__ == '__main__':
    main()
