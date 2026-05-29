import os
import json

path = "data/grade_3/matematik.json"
if not os.path.exists(path):
    path = "../data/grade_3/matematik.json"

with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"File: {path}")
print(f"Subject: {data.get('subject')}")
for u in data.get("units", []):
    words = u.get("words", [])
    print(f"\nUnit {u.get('id')} - {u.get('name')} (Total words: {len(words)})")
    print("Sample words:")
    for w in words[:10]:
        print(f"  - {w.get('word')}: {w.get('hint')}")
