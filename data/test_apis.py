import os
from google import genai
from google.genai import types

def test_keys():
    try:
        with open('api_keys.txt', 'r') as f:
            keys = [k.strip() for k in f if k.strip()]
    except Exception as e:
        print(f"Hata: {e}")
        return

    valid_keys = 0
    for i, key in enumerate(keys):
        try:
            client = genai.Client(api_key=key)
            # Make a tiny request
            res = client.models.generate_content(
                model='gemini-2.5-flash',
                contents='Say hi',
                config=types.GenerateContentConfig(max_output_tokens=5)
            )
            print(f"Key {i+1}/{len(keys)}: VALID")
            valid_keys += 1
        except Exception as e:
            err = str(e).lower()
            if "429" in err or "quota" in err:
                print(f"Key {i+1}/{len(keys)}: QUOTA EXCEEDED (429)")
            elif "403" in err or "invalid" in err:
                print(f"Key {i+1}/{len(keys)}: INVALID/EXPIRED")
            else:
                print(f"Key {i+1}/{len(keys)}: ERROR - {e}")
    print(f"\nKalan aktif API sayısı: {valid_keys}")

if __name__ == '__main__':
    test_keys()
