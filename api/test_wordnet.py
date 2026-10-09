from pythainlp.corpus import wordnet; import nltk; nltk.download("omw-1.4"); nltk.download("wordnet"); syns = wordnet.synsets("ตื่น"); print("POS for ตื่น:", set([s.pos() for s in syns]))
