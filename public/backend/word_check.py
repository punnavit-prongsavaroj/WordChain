from pythainlp.tag import pos_tag
from pythainlp.tokenize import word_tokenize, subword_tokenize

def check_nouns(text):
    """
    Check if the given text is a noun based on pythainlp pos_tag.
    Uses 'orchid' corpus. NCMN = Common Noun, NPRN = Proper Noun.
    """
    if not text or not text.strip():
        return False
        
    # Tag the word
    tagged_words = pos_tag([text.strip()], corpus="orchid")
    
    if not tagged_words:
        return False
        
    tag = tagged_words[0][1]
    
    # NCMN: Noun, NPRN: Proper Noun
    return tag in ['NCMN', 'NPRN']

def tokenize_text(text):
    """
    Tokenize text into words.
    """
    words = word_tokenize(text, engine="newmm")
    return words

def tokenize_by_syllable(text):
    """
    Tokenize text into syllables using subword_tokenize.
    Returns a flat list of syllables.
    """
    syllables = subword_tokenize(text, engine="dict")
    return [s for s in syllables if s.strip()]  # filter out empty
