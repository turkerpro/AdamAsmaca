import os
from google import genai
from google.genai import types

def test_models():
    try:
        with open('api_keys.txt', 'r') as f:
            keys = [k.strip() for k in f if k.strip()]
    except Exception as e:
        print(f"Hata: {e}")
        return

    models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash']
    
    # We will test the first 5 keys
    for i in range(min(5, len(keys))):
        key = keys[i]
        print(f"\n--- Key {i+1} ({key[:10]}...) ---")
        client = genai.Client(api_key=key)
        for model in models:
            try:
                res = client.models.generate_content(
                    model=model,
                    contents='Say OK',
                    config=types.GenerateContentConfig(max_output_tokens=5)
                )
                print(f"  {model}: VALID (Response: {res.text.strip()})")
            except Exception as e:
                err = str(e).lower()
                if "429" in err or "quota" in err:
                    print(f"  {model}: 429 QUOTA EXCEEDED")
                elif "403" in err or "invalid" in err:
                    print(f"  {model}: 403 INVALID/EXPIRED")
                else:
                    print(f"  {model}: ERROR - {err[:80]}")

if __name__ == '__main__':
    test_models()
