from pythainlp.tag import pos_tag; from pythainlp.tokenize import word_tokenize; words = word_tokenize("การตื่น", engine="newmm"); print(pos_tag(words, corpus="orchid"))
