from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WordRequest(BaseModel):
    word: str
    usedSyllables: list[str] = []

@app.get("/health")
def health_check():
    return {"status": "ok"}

from thai_check import is_valid_word
from judge import judge_word_ai

class JudgeRequest(BaseModel):
    previousWord: str
    word: str

@app.post("/api/ai-judge")
def ai_judge(req: JudgeRequest):
    result = judge_word_ai(req.previousWord, req.word)
    return result

@app.post("/api/check-word")
def check_word(req: WordRequest):
    # Call PyThaiNLP logic
    result = is_valid_word(req.word, req.usedSyllables)
    if result["valid"]:
        return {"valid": True, "word": req.word, "syllables": result["syllables"]}
    else:
        return {"valid": False, "reason": result["reason"]}

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
