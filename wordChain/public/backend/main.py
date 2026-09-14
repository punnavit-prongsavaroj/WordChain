from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import whisper
import os
import uuid
import tempfile
import subprocess
from word_check import check_nouns, tokenize_by_syllable

# Check ffmpeg is available on startup
try:
    subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
    print("ffmpeg found ✅")
except (FileNotFoundError, subprocess.CalledProcessError):
    print("⚠️  WARNING: ffmpeg not found! Whisper will fail to process audio.")
    print("   Please install ffmpeg: winget install Gyan.FFmpeg")

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load whisper model (base model for balance of speed/accuracy)
print("Loading Whisper model...")
model = whisper.load_model("base")
print("Whisper model loaded.")

class WordCheckRequest(BaseModel):
    word: str

@app.post("/api/speech")
async def speech(file: UploadFile = File(...)):
    """
    Receives an audio file (webm), transcribes it to Thai text using Whisper,
    and returns the text.
    """
    try:
        audio = await file.read()

        # Use system temp directory so there are no permission issues
        tmp_dir = tempfile.gettempdir()
        temp_filename = os.path.join(tmp_dir, f"whisper_{uuid.uuid4().hex}.webm")
        
        with open(temp_filename, "wb") as f:
            f.write(audio)

        print(f"Saved temp audio to: {temp_filename} ({len(audio)} bytes)")
            
        # Transcribe with whisper, forcing Thai language
        result = model.transcribe(
            temp_filename,
            language="th"
        )
        
        # Clean up temp file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
            
        # Extract text and remove leading/trailing spaces
        text = result["text"].strip()
        print(f"Transcribed: '{text}'")
        
        return {
            "text": text
        }
        
    except Exception as e:
        print(f"Error processing speech: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
    uvicorn.run(app, host="0.0.0.0", port=8000)
