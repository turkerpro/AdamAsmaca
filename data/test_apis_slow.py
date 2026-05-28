import os
import time
from google import genai
from google.genai import types

def test_keys():
    try:
        with open('api_keys.txt', 'r') as f:
            keys = [k.strip() for k in f if k.strip()]
    except Exception as e:
        print(f"Hata: {e}")
        return

    valid_keys = []
    quota_keys = []
    invalid_keys = []
    
    for i, key in enumerate(keys):
        try:
            client = genai.Client(api_key=key)
            res = client.models.generate_content(
                model='gemini-2.5-flash',
                contents='Say OK',
                config=types.GenerateContentConfig(max_output_tokens=5)
            )
            print(f"Key {i+1}/{len(keys)} ({key[:10]}...): VALID")
            valid_keys.append((i+1, key))
            time.sleep(2.0) # sleep to avoid hitting transient rate limits
        except Exception as e:
            err = str(e).lower()
            if "429" in err or "quota" in err:
                print(f"Key {i+1}/{len(keys)} ({key[:10]}...): QUOTA EXCEEDED (429)")
                quota_keys.append(i+1)
            elif "403" in err or "invalid" in err:
                print(f"Key {i+1}/{len(keys)} ({key[:10]}...): INVALID/EXPIRED (403)")
                invalid_keys.append(i+1)
            else:
                print(f"Key {i+1}/{len(keys)} ({key[:10]}...): ERROR - {e}")
                invalid_keys.append(i+1)
            time.sleep(1.0)
            
    print(f"\n--- SONUÇLAR ---")
    print(f"Aktif/Çalışan Key Sayısı: {len(valid_keys)}")
    print(f"Aktif Key İndeksleri: {[k[0] for k in valid_keys]}")
    print(f"Kota Aşan Key İndeksleri: {quota_keys}")
    print(f"Geçersiz/Hatalı Key İndeksleri: {invalid_keys}")

if __name__ == '__main__':
    test_keys()
