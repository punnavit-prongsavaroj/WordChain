import sys
import json
from pythainlp.tag import pos_tag
from pythainlp.tokenize import syllable_tokenize

def process_word(word):
    # 1. เช็คว่าเป็นคำนามหรือไม่ (ใช้ corpus 'orchid' หรือ 'pud')
    # tag จะออกมาเป็น list เช่น [('แมว', 'NCMN')]
    tags = pos_tag([word], corpus='orchid')
    
    # เช็คว่า tag เริ่มต้นด้วย 'N' (Noun) หรือไม่
    is_noun = any(tag.startswith('N') for w, tag in tags)
    
    # 2. แยกพยางค์
    syllables = syllable_tokenize(word)
    
    # คืนค่ากลับเป็น JSON String เพื่อให้ Node.js อ่านง่ายๆ
    result = {
        "word": word,
        "isNoun": is_noun,
        "syllables": syllables
    }
    print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        process_word(sys.argv[1])