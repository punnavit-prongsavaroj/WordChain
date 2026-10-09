import os
import json
import requests
import urllib3
from dotenv import load_dotenv

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()

def judge_word_ai(previous_word: str, word: str) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key == "DUMMY_KEY":
        return {"pass": True, "reason": "AI ขัดข้อง อนุญาตให้ผ่านชั่วคราว (ไม่มี API Key)"}

    if not previous_word:
        prompt = f"""คุณเป็นกรรมการตัดสินเกมต่อคำศัพท์ภาษาไทย
คำปัจจุบัน: "{word}"

กติกา:
1. คำปัจจุบันต้องเป็นคำนามหรือคำประสม (ห้ามเป็นประโยค และห้ามเป็นคำกริยาล้วนๆ)

จงตัดสินว่าคำปัจจุบันให้ผ่านหรือไม่ โดยตอบเป็น JSON format เท่านั้น:
{{
  "isNoun": true/false,
  "passWord": true/false,
  "reason": "อธิบายสั้นๆ 1-2 ประโยค ว่าเป็นคำนามหรือไม่"
}}
"""
    else:
        prompt = f"""คุณเป็นกรรมการตัดสินเกมต่อคำศัพท์ภาษาไทย
คำก่อนหน้า: "{previous_word}"
คำปัจจุบัน: "{word}"

กติกา:
1. คำปัจจุบันต้องเป็นคำนามหรือคำประสม (ห้ามเป็นประโยค และห้ามเป็นคำกริยาล้วนๆ)
2. คำปัจจุบันต้องมีความเกี่ยวโยงทางความหมายกับคำก่อนหน้า (อิงจากบริบทใดก็ได้ ขอแค่มีเหตุผลรองรับ)

จงตัดสินว่าคำปัจจุบันให้ผ่านหรือไม่ โดยตอบเป็น JSON format เท่านั้น:
{{
  "isNoun": true/false,
  "related": true/false,
  "passWord": true/false,
  "reason": "อธิบายสั้นๆ 1-2 ประโยค ว่าสองคำนี้มีความเกี่ยวข้องกันอย่างไร หรือถ้าไม่เกี่ยว ให้บอกเหตุผลที่ปัดตก (รวมถึงถ้าไม่ใช่คำนามก็ให้ระบุด้วย)"
}}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2}
    }

    try:
        # Ignore SSL verification for local dev (bypasses Antivirus/Proxy SSL issues)
        response = requests.post(url, headers=headers, json=payload, verify=False, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        text = data['candidates'][0]['content']['parts'][0]['text']
        
        # Extract JSON from markdown if needed
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        
        result = json.loads(text.strip())
        return {
            "pass": result.get("passWord", False),
            "reason": result.get("reason", "ไม่มีเหตุผล")
        }
    except Exception as e:
        print("Gemini API Error:", e)
        return {
            "pass": True,
            "reason": "AI ขัดข้อง อนุญาตให้ผ่านชั่วคราว"
        }

