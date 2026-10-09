import pythainlp
from pythainlp.tag import pos_tag
from pythainlp.tokenize import word_tokenize, subword_tokenize

def is_valid_word(text: str, used_syllables: list) -> dict:
    # 0. Remove spaces
    text = text.replace(" ", "").replace("\u200b", "")

    # 1. Tokenize words
    words = word_tokenize(text, engine='newmm')
    
    # 2. Check if it's a sentence (Heuristic)
    tags = pos_tag(words, corpus='orchid')
    
    # Simple sentence check: Starts with Pronoun + Verb
    if len(tags) >= 2 and tags[0][1] in ['NPRP', 'PPRS'] and tags[1][1].startswith('V'):
        return {"valid": False, "reason": "is_sentence"}
        
    # Check if it is a verb alone (like "วิ่ง" or "นอน")
    # If it's a single word and it's a verb, reject it.
    if len(tags) == 1 and tags[0][1].startswith('V'):
        return {"valid": False, "reason": "not_a_noun"}

    # --- Blacklist for common verbs that PyThaiNLP orchid corpus incorrectly tags as Noun ---
    verb_blacklist = ['ตื่น', 'นอน', 'กิน', 'เดิน', 'วิ่ง', 'นั่ง', 'กระโดด', 'ร้องไห้', 'ยิ้ม', 'หัวเราะ', 'หายใจ', 'ตาย', 'เกิด', 'เล่น', 'เตะ', 'ต่อย', 'มอง', 'ดู', 'เห็น', 'ไป', 'มา']
    if text in verb_blacklist:
        return {"valid": False, "reason": "not_a_noun"}

    # 3. Check for repeated syllables
    # Tones matter! "น้ำ" != "นำ"
    # subword_tokenize(dict) breaks it down into syllables correctly
    syllables = subword_tokenize(text, engine='dict')
    
    for s in syllables:
        if s in used_syllables:
            return {"valid": False, "reason": f"พยางค์ '{s}' ซ้ำ"}
            
    return {"valid": True, "syllables": syllables}
