import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from word_check import check_nouns, tokenize_by_syllable

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WordCheckRequest(BaseModel):
    word: str

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/check-word")
async def check_word(request: WordCheckRequest):
    """
    Checks if a given word is a valid Thai noun and returns its syllables.
    """
    word = request.word.strip()
    
    if not word:
        raise HTTPException(status_code=400, detail="Word cannot be empty")
        
    is_noun = check_nouns(word)
    syllables = tokenize_by_syllable(word)
    
    return {
        "isNoun": is_noun,
        "syllables": syllables
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv('PORT', '8000')))
