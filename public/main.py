from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pythainlp.tokenize import word_tokenize, syllable_tokenize
from pythainlp.tag import pos_tag

app = FastAPI()

# อนุญาตให้ Frontend เรียกข้าม Domain ได้
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WordRequest(BaseModel):
    word: str

@app.post("/api/check-word")
def check_word(req: WordRequest):
    text = req.word.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty word")

    # 1. เช็คคำนาม (ใช้ corpus orchid ตาม Requirement)
    tagged_words = pos_tag([text], corpus="orchid")
    tag = tagged_words[0][1]
    is_noun = tag in ['NCMN', 'NPRN']

    # 2. แยกพยางค์
    words = word_tokenize(text, engine="newmm")
    all_syllables = []
    for w in words:
        all_syllables.extend(syllable_tokenize(w))

    return {
        "isNoun": is_noun,
        "syllables": all_syllables
    }

# รันด้วยคำสั่ง: uvicorn main:app --reload --port 8000