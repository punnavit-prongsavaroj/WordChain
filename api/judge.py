import os
import json
import requests
import urllib3
from pathlib import Path
from dotenv import load_dotenv

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv(Path(__file__).parent / ".env")
load_dotenv() # Also check root if present

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
  "semanticScore": 5,
  "reason": "อธิบายสั้นๆ 1-2 ประโยค ว่าเป็นคำนามหรือไม่"
}}
"""
    else:
        prompt = f"""คุณเป็นกรรมการตัดสินเกมต่อคำศัพท์ภาษาไทยที่เข้มงวดและมีหลักการ
คำก่อนหน้า: "{previous_word}"
คำปัจจุบัน: "{word}"

กติกาสำคัญ:
1. ชนิดของคำ: คำปัจจุบันต้องเป็นคำนามหรือคำประสม (ห้ามเป็นประโยค และห้ามเป็นคำกริยาล้วนๆ)
2. ความเชื่อมโยงทางความหมาย (สำคัญที่สุด - ต้องเชื่อมโยง 1 ขั้นโดยตรงเท่านั้น):
   - ต้องมีความเชื่อมโยงกันแบบ "1 ขั้นโดยตรง" (Direct 1-Step Association) เท่านั้น เช่น:
     • อยู่ในหมวดหมู่เดียวกันโดยตรง (เช่น ปืน กับ มีด = อาวุธ, ส้ม กับ กล้วย = ผลไม้)
     • ใช้งานคู่กันโดยตรง (เช่น ช้อน กับ ส้อม, แปรงสีฟัน กับ ยาสีฟัน)
     • เป็นส่วนประกอบ/องค์ประกอบของกันและกันโดยตรง (เช่น ทะเล กับ ทราย, ต้นไม้ กับ ใบไม้)
     • สถานที่กับบุคคล/หน้าที่หลักโดยตรง (เช่น โรงเรียน กับ ครู, โรงพยาบาล กับ หมอ)
   - ห้ามเชื่อมโยงแบบ "2 ขั้นขึ้นไป" โดยเด็ดขาด (No Multi-Hop / ห้ามแถผ่านตัวกลาง):
     • หากต้องอาศัยตัวกลาง กิจกรรมสมมติ หรือเรื่องเล่ามาเชื่อมโยงกัน ถือเป็น 2 ขั้นขึ้นไป ให้ปัดตกทันที!
     • ตัวอย่างที่ต้องปัดตก (2 ขั้น):
       - "น้ำตก" กับ "เสื้อ" -> ปัดตก! (อ้างว่าคนใส่เสื้อไปเที่ยวน้ำตก = 2 ขั้น: เสื้อ -> คน -> น้ำตก ไม่ใช่ความเชื่อมโยงโดยตรง)
       - "ตู้เย็น" กับ "ทะเล" -> ปัดตก! (อ้างว่าคนหยิบของจากตู้เย็นไปกินที่ทะเล = 2 ขั้น ไม่เชื่อมโยงโดยตรง)
       - "เตียง" กับ "สนามบอล" -> ปัดตก! (อ้างว่าเตะบอลแล้วมานอนเตียง = 2 ขั้น ไม่เชื่อมโยงโดยตรง)

เกณฑ์การตัดสิน:
- ให้ passWord = true ได้ก็ต่อเมื่อ isNoun = true และเชื่อมโยงแบบ "1 ขั้นโดยตรง" (related = true) เท่านั้น
- หากเป็นการเชื่อมโยง 2 ขั้นขึ้นไป หรือไม่เกี่ยวข้องกัน: ให้ passWord = false, related = false, semanticScore = 1 ถึง 2
- semanticScore:
  5 = เชื่อมโยง 1 ขั้นโดยตรงชัดเจนมาก (เช่น หมวดเดียวกัน/คู่กัน)
  4 = เชื่อมโยง 1 ขั้นโดยตรงในบริบทเฉพาะ
  3 = เชื่อมโยง 1 ขั้นแต่ห่างๆ
  1-2 = เชื่อมโยง 2 ขั้นขึ้นไป (มีตัวกลาง/แถ) หรือไม่เกี่ยวข้องกันเลย

จงตัดสินและตอบเป็น JSON format เท่านั้น:
{{
  "isNoun": true/false,
  "related": true/false,
  "passWord": true/false,
  "semanticScore": 1-5,
  "reason": "อธิบายสั้นๆ 1-2 ประโยค ว่าสองคำนี้เชื่อมโยง 1 ขั้นโดยตรงหรือไม่ หรือถ้าเป็น 2 ขั้นขึ้นไป ให้ระบุว่ามีตัวกลางใด"
}}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "thinkingConfig": {"thinkingBudget": 0}}
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
        raw_score = result.get("semanticScore")
        try:
            score = max(1, min(5, int(raw_score))) if raw_score is not None else (4 if result.get("passWord", False) else 1)
        except (ValueError, TypeError):
            score = 3 if result.get("passWord", False) else 1

        return {
            "pass": bool(result.get("passWord", False)),
            "semanticScore": score,
            "reason": result.get("reason", "ไม่มีเหตุผล")
        }
    except Exception as e:
        print("Gemini API Error:", e)
        return {
            "pass": True,
            "semanticScore": 4,
            "reason": "AI ขัดข้อง อนุญาตให้ผ่านชั่วคราว"
        }

