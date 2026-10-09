# Word Chain Voice: แผนพัฒนา

เวอร์ชัน 1.0 · 9 ต.ค. 2026 · React + Firebase (Spark) + FastAPI บน Render

## 1. สรุปการตัดสินใจ

| หัวข้อ | ข้อสรุป |
| --- | --- |
| รูปแบบเกม | โยงคำนามตามความหมาย ไม่มีกฎตัวอักษร ไม่มีหมวดหมู่ คำแรกพูดอะไรก็ได้ |
| คำซ้ำ | แยกพยางค์ทุกคำที่ผ่านแล้วเก็บไว้ คำใหม่ห้ามมีพยางค์ใดซ้ำกับที่เคยใช้ |
| ระบบตรวจอัตโนมัติ | เช็กแค่ 2 อย่าง: ไม่ใช่ประโยค และพยางค์ไม่ซ้ำ ส่วนความเชื่อมโยง/ความเป็นคำนามตัดสินผ่าน Challenge |
| ผู้คุมกติกา | Host client (ไม่ใช้ Cloud Functions จึงไม่ต้องผูกบัตร) พร้อมโอนสิทธิ์ Host อัตโนมัติ |
| Backend | FastAPI บน Render free tier (PyThaiNLP + Gemini) |
| Auth | Firebase Anonymous Auth |
| แพลตฟอร์ม | Chrome (Android/Desktop) เป็นหลัก เบราว์เซอร์อื่นแสดงคำเตือน |
| ผู้เล่น | สูงสุด 10 คน เล่นออนไลน์ เห็นข้อความที่ถอดเสียง |
| เสียง/กล้อง | เฟส 3 ด้วย LiveKit |

## 2. กติกาฉบับสุดท้าย

1. Host สร้างห้อง ส่งรหัสให้เพื่อน (สูงสุด 10 คน) ตั้งเวลาต่อเทิร์นได้ (ค่าเริ่มต้น 10 วินาที)
2. ผู้เล่นคนแรกพูดคำนามอะไรก็ได้ คนถัดไปพูดคำนามที่เชื่อมโยงกับคำก่อนหน้าทางความหมาย
3. ต้องเป็นคำนามเดี่ยวหรือคำประสม ห้ามพูดเป็นประโยค
4. ห้ามมีพยางค์ซ้ำกับพยางค์ของคำที่ผ่านแล้วในรอบนั้น (เทียบโดยตัดวรรณยุกต์ออก)
5. ระบบฟังไม่ออกหรือคำไม่ผ่านเงื่อนไขข้อ 3-4 ไม่ถูกคัดออก พูดแก้ได้จนกว่าเวลาจะหมด
6. เวลาหมดก่อนพูดคำที่ผ่าน ถูกคัดออก คนสุดท้ายที่เหลือชนะ
7. คำที่ไม่อยู่ในพจนานุกรมให้ผ่านถ้าไม่ใช่ประโยค แล้วรอ Challenge

### Challenge

- ท้าได้เฉพาะ **คำล่าสุดที่ผ่าน** และท้าได้จนกว่าคำถัดไปจะถูกรับ ผู้ท้าต้องเป็นผู้เล่นที่ยังรอด และท้าคำตัวเองไม่ได้
- เกมหยุดชั่วคราว ทุกคนยกเว้นผู้พูดโหวต ✅/❌ ภายใน 10 วินาที (ผู้ที่ตายแล้วโหวตได้) ผู้ท้านับเป็น ❌ อัตโนมัติ
- Gemini เป็น 1 เสียงโหวต เปิดคะแนนทีละคนแล้วโชว์ผล AI และผลรวม
- ❌ มากกว่าหรือเท่ากับ ✅: **ผู้พูดตาย** คำนั้นถูกยกเลิก (พยางค์ถูกคืนให้ใช้ได้) คนถัดไปต่อจากคำล่าสุดที่ผ่านก่อนหน้า ด้วยเวลาเต็ม
- ✅ มากกว่า: **ผู้ท้าตาย** เกมเดินต่อ ผู้ที่ถูกจับเวลาอยู่เล่นต่อด้วยเวลาที่เหลือ

## 3. สถาปัตยกรรม

```
Browser (React/Zustand)  <--onSnapshot-->  Firestore (สถานะเกม)
   |   |                                   RTDB (presence + server time offset)
   |   +-- Web Speech API (เฉพาะผู้ที่ถึงตา)
   +-- HTTPS + Firebase ID token --> FastAPI (Render)
                                       |- /api/check-word  (PyThaiNLP)
                                       |- /api/ai-judge    (Gemini)
                                       |- /api/livekit-token (เฟส 3)
Host client = ผู้เขียนสถานะเกมลง Firestore (ไม่เก็บ state ส่วนตัว)
```

หลักสำคัญ: **Host ไม่ถือ state ใดๆ ไว้ในเครื่อง** ทุกอย่างอยู่ใน Firestore ดังนั้นเมื่อ Host หลุด ผู้เล่นคนอื่นรับช่วงต่อได้ทันที

## 4. โครงสร้างโปรเจกต์

```
word-chain-voice/
  web/                     # Vite + React + TypeScript + Tailwind
    src/
      services/ firebase.ts, roomService.ts, apiClient.ts, presence.ts
      store/    gameStore.ts (Zustand)
      hooks/    useSpeechRecognition.ts, useCountdown.ts, useHostLoop.ts
      host/     turnEngine.ts, challengeEngine.ts, hostMigration.ts
      pages/    Home, Lobby, Game, Result
      components/ PlayerRing, TurnTimer, WordChain, ChallengeModal, VoteReveal
  api/                     # FastAPI
    main.py, auth.py (verify Firebase ID token)
    thai_check.py, judge.py, tests/
  firestore.rules, database.rules.json, firebase.json
```

การเชื่อม Firebase ทำที่จุดเดียว: `roomService` subscribe `onSnapshot` ที่ระดับบนสุดของหน้า Game แล้วเขียนเข้า Zustand ส่วน Component ใช้ selector ดึงเฉพาะส่วนที่ต้องใช้ (แก้ปัญหา Render Loop ตามข้อ 5.4 ใน GDD)

## 5. Data Model

### Firestore

```
rooms/{roomId}
  code, hostUid, status: lobby|playing|challenge|finished
  settings: { turnSeconds, maxPlayers }
  turnId (int), turnPlayerUid, turnEndTime (Timestamp)
  pausedRemainingMs (null เมื่อไม่หยุด)
  usedSyllables: string[]   // เพิ่มด้วย arrayUnion
  lastPassedWordIdx, winnerUid

rooms/{roomId}/players/{uid}
  name, alive, joinedAt, order

rooms/{roomId}/words/{idx}
  uid, text, syllables[], status: passed|void, createdAt

rooms/{roomId}/submissions/{turnId}
  uid, text, syllables[], submittedAt (serverTimestamp)

rooms/{roomId}/challenge/current
  challengerUid, wordIdx, speakerUid, phase: voting|revealed
  aiVote: {pass, reason} | null
  result: {passCount, failCount, outcome} | null
rooms/{roomId}/challenge/current/votes/{uid}
  pass: boolean   // เขียนได้ครั้งเดียว
```

### Realtime Database (ฟรีบน Spark)

- `presence/{roomId}/{uid}` ใช้ `onDisconnect` ตรวจผู้เล่นหลุด (Firestore ทำ presence เองไม่ได้ดี)
- `.info/serverTimeOffset` ใช้คำนวณเวลาเซิร์ฟเวอร์ฝั่งเครื่องนั้นๆ ตรงตามที่ GDD ต้องการ

## 6. Flow ของเทิร์น

1. **Host เริ่มเทิร์น** (transaction): ตั้ง `turnPlayerUid`, `turnId+1`, `turnEndTime = serverNow + turnSeconds` ครั้งเดียวต่อเทิร์น
2. ทุกเครื่องนับถอยหลังเองด้วย `turnEndTime - serverNow` (ใช้ offset จาก RTDB) ไม่มีการเขียนทุกวินาที
3. เฉพาะเครื่องผู้ถึงตาเปิดไมค์ (คนอื่นปิด ป้องกันเสียงปนกัน) เมื่อได้ผลถอดเสียงสุดท้าย:
   - ตรวจฝั่ง client ก่อน: ไม่ว่าง ไม่ยาวเกิน แล้วเรียก `/api/check-word` พร้อมส่ง `usedSyllables` ปัจจุบันไปด้วย (API ไม่เก็บ state)
   - ไม่ผ่าน: แสดงเหตุผล ฟังต่อ ผู้เล่นพูดใหม่ได้
   - ผ่าน: เขียน `submissions/{turnId}`
4. **Host** รับ submission ตรวจว่า `submittedAt <= turnEndTime` และ `turnId` ตรง แล้ว commit ด้วย transaction เดียว: เพิ่ม `words/{idx}`, `arrayUnion` ลง `usedSyllables`, เลื่อนไปผู้เล่นที่รอดคนถัดไป, ตั้ง `turnEndTime` ใหม่
5. **หมดเวลา**: Host ตั้ง timeout ภายในเครื่องตาม `turnEndTime` เมื่อถึงเวลาและ `turnId` ยังเดิม ให้ตั้ง `alive=false` แล้วเริ่มเทิร์นถัดไป ถ้าเหลือ 1 คน `status=finished`
6. **การชิงกัน**: ถ้า submission มาถึงพร้อมการหมดเวลา transaction เช็ก `turnId` อีกครั้ง ฝ่ายที่มาก่อนชนะ

ประมาณการ: 1 เทิร์นใช้ราว 3 writes และ 30 reads (ห้อง 10 คน) เกมยาว 60 เทิร์นใช้ราว 2,000 reads ดังนั้นโควต้าฟรีของ Spark (50k reads/วัน) รองรับได้ประมาณ 20-25 เกมเต็มห้องต่อวัน เพียงพอสำหรับเล่นกับเพื่อน

## 7. Flow ของ Challenge

1. ผู้ท้ากดปุ่ม ➜ transaction ตรวจ: มีคำล่าสุดที่ผ่าน, ยังไม่มี challenge ค้าง, ผู้ท้ารอดอยู่และไม่ใช่ผู้พูด เขียน `challenge/current` และ `status=challenge`
2. Host บันทึก `pausedRemainingMs = turnEndTime - serverNow` เพื่อหยุดนาฬิกา แล้วเรียก `/api/ai-judge` ทันทีขนานไปกับการโหวต (timeout 8 วินาที ไม่ตอบถือเป็นงดออกเสียง)
3. ผู้มีสิทธิ์โหวตเขียน `votes/{uid}` ของตัวเอง ครบทุกคนหรือครบ 10 วินาที Host ปิดโหวต
4. Host คำนวณผลแล้วเขียน `result` **ครั้งเดียว** ฝั่ง client เล่นอนิเมชันเปิดคะแนนทีละคนจากข้อมูลก้อนนั้น (ไม่ต้องเขียน Firestore หลายครั้ง)
5. ผลลัพธ์:
   - **ไม่ผ่าน**: ผู้พูดตาย, `words/{idx}.status=void`, ลบพยางค์ของคำนั้นออกจาก `usedSyllables`, เริ่มเทิร์นให้ผู้เล่นที่รอดคนถัดไปด้วยเวลาเต็ม
   - **ผ่าน**: ผู้ท้าตาย, ตั้ง `turnEndTime = serverNow + pausedRemainingMs` ให้ผู้ที่ถึงตาเล่นต่อ ถ้าผู้ท้าเป็นคนที่ถึงตาอยู่และตาย ให้ข้ามไปคนถัดไปด้วยเวลาเต็ม
   - ถ้าเหลือผู้เล่น 1 คนหลังตัดสิน จบเกมทันที

## 8. API Spec (FastAPI)

ทุก endpoint ต้องแนบ `Authorization: Bearer <Firebase ID token>` และจำกัด CORS เฉพาะโดเมนเว็บ มี rate limit ต่อ uid

### GET /health

ใช้ปลุกเซิร์ฟเวอร์ (ดูข้อ 11)

### POST /api/check-word

```json
// request
{ "text": "ต้นไม้", "usedSyllables": ["แมว", "น้ำ"] }
// response
{ "ok": true, "syllables": ["ต้น", "ไม้"], "normalized": ["ตน", "ไม"],
  "reason": null }
// reason: "sentence" | "repeated_syllable:<พยางค์>" | "empty"
```

ขั้นตอนใน `thai_check.py`:

1. ทำความสะอาด: ตัดช่องว่าง/อักขระพิเศษ ความยาวเกิน 30 ตัวอักษรถือว่าไม่ผ่าน
2. **เช็กประโยค**: ถ้าทั้งสตริงอยู่ใน `thai_words()` ผ่านเลย ถ้าไม่ ให้ `word_tokenize` แล้วไม่ผ่านเมื่อพบคำใน `thai_stopwords()` (เช่น ผม, คือ, เป็น, ที่) หรือแตกเป็นเกิน 4 คำ ส่วนคำนอกพจนานุกรมที่เหลือถือว่าผ่าน
3. `syllable_tokenize` ➜ ตัดวรรณยุกต์ (่ ้ ๊ ๋) และ ๆ ➜ เทียบกับ `usedSyllables` และเทียบกันเองภายในคำ

ค่าในข้อ 2 (ความยาว, จำนวนคำ, stopword) เป็นค่าปรับจูนได้ ต้องทดสอบกับคำจริงหลายร้อยคำ

### POST /api/ai-judge

```json
// request
{ "previousWord": "ทะเล", "word": "ปลา" }
// response
{ "isNoun": true, "related": true, "pass": true, "reason": "ปลาอาศัยอยู่ในทะเล" }
```

กำหนดให้ Gemini ตอบ JSON เท่านั้น (response schema) พร้อมคำสั่งให้ตัดสินแบบใจกว้างพอสมควร: ผ่านเมื่อเป็นคำนามและมีความสัมพันธ์ที่อธิบายได้ (หมวดเดียวกัน ส่วนประกอบ ที่อยู่ สิ่งที่ใช้คู่กัน เหตุ-ผล) `pass = isNoun && related` ใส่ข้อความ prompt ไว้ในไฟล์เดียวเพื่อปรับแก้ง่าย เก็บ API key ใน env ของ Render เท่านั้น

## 9. Hook ระบบรับเสียง

`useSpeechRecognition({ active, onFinal })` สำหรับ Chrome:

- `lang="th-TH"`, `continuous=true`, `interimResults=true`, `maxAlternatives=3` เมื่อได้ผลสุดท้าย ลองตรวจทีละ alternative ใช้อันแรกที่ผ่าน ช่วยลดปัญหาถอดเสียงผิด
- **Auto-restart**: เมื่อเกิด `onend` ขณะ `active=true` เริ่มใหม่ทันที ถ้าล้มเหลวติดกันใช้ backoff (200ms, 500ms, 1s) และเมื่อ error ชนิด `not-allowed` ให้แสดง UI ให้กดอนุญาตไมค์ใหม่
- เริ่มรับเสียงใหม่ทุกต้นเทิร์นเพื่อล้างบัฟเฟอร์เก่า และหยุดทันทีเมื่อหมดตาหรือส่งคำแล้ว
- หน้า Lobby มีปุ่ม "อนุญาตไมค์" และทดสอบเสียง ผู้เล่นที่ยังไม่พร้อมจะไม่ถูกนับว่าพร้อม
- ตรวจ `window.webkitSpeechRecognition` ถ้าไม่มี แสดงข้อความแนะนำให้ใช้ Chrome

## 10. Timer, Presence และการโอน Host

- **Timer**: ทุกเครื่องใช้ `serverNow = Date.now() + serverTimeOffset` (จาก RTDB) และ `useCountdown` ใช้ `setInterval` ขนาด 100ms อัปเดตเฉพาะ state ภายในคอมโพเนนต์
- **Presence**: `onDisconnect` ตั้งสถานะ offline ผู้เล่นที่หลุดระหว่างเกมและเกินเวลาที่ตั้ง (เช่น 15 วินาที) ถือว่าถูกคัดออก ถ้าหลุดตอนถึงตาตัวเอง Host คัดออกตามหมดเวลาปกติ
- **โอน Host**: เมื่อ presence ของ `hostUid` offline เกิน 5 วินาที ผู้เล่นที่ยังออนไลน์ที่มี `order` น้อยที่สุดรันทรานแซกชัน `if hostUid == oldHost then hostUid = me` (ทรานแซกชันจึงรับประกันว่ามีผู้ชนะคนเดียว) Host ใหม่เริ่ม `useHostLoop` จากสถานะใน Firestore ทันที ถ้าเกมอยู่ในช่วง challenge ให้ Host ใหม่เริ่มขั้นตอนต่อจาก `phase` ปัจจุบัน

## 11. ความปลอดภัยและข้อจำกัดของแผน Spark

- **Firestore Rules** บังคับได้เท่านี้: สมาชิกห้องอ่านได้, เขียน `players/{uid}` ของตัวเอง, เฉพาะ `hostUid` เขียนฟิลด์สถานะเกมใน `rooms`, เฉพาะผู้ถึงตาเขียน `submissions`, โหวตเขียนได้ครั้งเดียวและเฉพาะ uid ตัวเอง
- **ข้อจำกัดที่ยอมรับ**: เมื่อ Host เป็น client ได้ Host ที่โกงโค้ดได้ในทางทฤษฎี เหมาะกับเกมปาร์ตี้เพื่อนเล่นกัน ถ้าจะเปิดสาธารณะต้องย้ายไป Cloud Functions ในภายหลัง (โครงสร้าง `host/*Engine.ts` ถูกแยกไว้เพื่อให้ย้ายตรรกะนี้ได้ง่าย)
- **Render free หลับเมื่อไม่มีการใช้งานและตื่นช้าราว 30-60 วินาที** วิธีรับมือ: เรียก `/health` ตอนเปิดหน้า Lobby และปุ่ม "เริ่มเกม" ของ Host ถูกล็อกจนกว่า API ตอบ ระหว่างเกมไม่มีปัญหาเพราะมีการใช้งานต่อเนื่อง
- Gemini ใช้ free tier ของ Google AI Studio มี rate limit เกมนี้เรียกเฉพาะตอน Challenge จึงพอ แต่ต้องมี fallback เมื่อโดน limit (AI งดออกเสียง)
- Anonymous Auth ใช้ได้บน Spark เซิร์ฟเวอร์ Python ตรวจ ID token ด้วย `firebase-admin` (service account เก็บใน env)
- Hosting เว็บ: Firebase Hosting (ฟรี)

## 12. Milestones

ระยะเวลาเป็นค่าประมาณสำหรับนักพัฒนา 1 คน

### เฟส 0: วางโครง (2-3 วัน)

- สร้าง repo, Vite + Tailwind + Zustand, Firebase project (Auth, Firestore, RTDB, Hosting), FastAPI deploy บน Render
- เกณฑ์ผ่าน: เปิดเว็บแล้ว login anonymous ได้ และเรียก `/health` ผ่าน token ได้

### เฟส 1: เล่นได้ครบหนึ่งเกม (2 สัปดาห์)

- ห้อง/Lobby/รหัสห้อง/สถานะพร้อม, Firestore rules, presence
- `/api/check-word` พร้อม unit test ชุดคำภาษาไทยจริง (ผ่าน/ประโยค/พยางค์ซ้ำ)
- `useSpeechRecognition`, `useCountdown`, turn engine ของ Host, elimination, หน้าผลชนะ
- โอน Host อัตโนมัติ
- เกณฑ์ผ่าน: เพื่อน 4-5 คนบน Chrome เล่นจนมีผู้ชนะ และเมื่อปิดแท็บ Host เกมไม่ค้าง

### เฟส 2: Challenge + AI Judge (1-1.5 สัปดาห์)

- ปุ่ม Challenge, หยุด/เดินเวลาต่อ, โหวต, `/api/ai-judge`, Game Show Reveal
- ทดสอบกรณีขอบ: ผู้ท้าเป็นคนที่ถึงตา, ท้าซ้อน, ผู้โหวตหลุดกลางทาง, เหลือ 2 คน
- เกณฑ์ผ่าน: ผลตัดสินถูกต้องทุกกรณีใน test matrix และเวลาเดินต่อถูกต้อง

### เฟส 3: เสียงและกล้องด้วย LiveKit (1-2 สัปดาห์)

- `/api/livekit-token`, ห้องเสียง/วิดีโอ, ปุ่มเปิด-ปิด
- **ต้องทดสอบก่อนตัดสินใจ**: การใช้ไมค์พร้อมกันระหว่าง LiveKit กับ Web Speech API บนมือถือ Android อาจชนกัน ถ้าชน ให้ใช้ audio ของ LiveKit เฉพาะ Desktop หรือใช้การถอดเสียงจากสตรีมแทน
- เกณฑ์ผ่าน: 10 คนได้ยินกัน ไม่มี CPU spike จนแครช

### เฟส 4: ขัดเกลา (1 สัปดาห์)

- ปรับจูนกฎเช็กประโยค, เสียง/เอฟเฟกต์, หน้าตา UI, ข้อความ error ภาษาไทย, ตรวจโควต้า

## 13. ความเสี่ยงสำคัญ

| ความเสี่ยง | ผลกระทบ | วิธีรับมือ |
| --- | --- | --- |
| ถอดเสียงภาษาไทยผิดบ่อย | ผู้เล่นหงุดหงิด | ใช้ 3 alternatives, ให้ลองพูดซ้ำ, แสดงข้อความที่ได้ยินให้เห็น |
| ตัวตรวจประโยคผิดพลาด (ตัดคำถูก/ปล่อยประโยค) | เกมไม่แฟร์ | ชุดทดสอบ, ปรับค่าได้ใน config, ปล่อยให้ Challenge เป็นตัวตัดสินสุดท้าย |
| Gemini ตัดสินความเชื่อมโยงไม่ตรงใจผู้เล่น | ไม่พอใจผลโหวต | prompt ใจกว้าง, AI มีแค่ 1 เสียง, แสดงเหตุผลตอน Reveal |
| Host หลุดกลางช่วง Challenge | เกมค้าง | state อยู่ใน Firestore, Host ใหม่ต่อจาก `phase` |
| Render หลับ/ช้า | ตรวจคำไม่ได้ | ล็อกปุ่มเริ่มเกมจนกว่าตื่น, แสดงสถานะ "กำลังเตรียมระบบ" |
| โควต้า Spark หมด | เกมหยุดกลางคัน | อัปเดตแบบ batch/transaction, แสดงแค่ผลสุดท้ายของคำพูด, มีหน้าแจ้งเตือน |
| ไมค์ชนกันระหว่างเสียงกับถอดเสียง | เฟส 3 ใช้ไม่ได้บางเครื่อง | ทดสอบตั้งแต่เริ่มเฟส 3 |

## 14. สมมติฐานที่ผมตั้งเอง (แก้ได้)

1. ใช้ TypeScript ฝั่งเว็บ
2. เฉพาะผู้เล่นที่ยังรอดกด Challenge ได้
3. ผู้ท้านับเป็น ❌ อัตโนมัติและเปลี่ยนไม่ได้
4. ผู้โหวตที่ไม่โหวตภายในเวลานับเป็นงดออกเสียง และ AI ที่ไม่ตอบก็งดออกเสียงเช่นกัน
5. เมื่อคำถูกตัดสินว่าไม่ผ่าน พยางค์ของคำนั้นถูกคืนให้ใช้ได้
6. เทียบพยางค์โดยตัดเฉพาะวรรณยุกต์ (น้ำ = นำ)
7. ผู้เล่นเริ่มกลางเกมไม่ได้ (ล็อกห้องเมื่อเริ่ม) ผู้ที่ออกกลางเกมถือว่าตาย
8. แสดงเฉพาะข้อความสุดท้ายที่ถอดได้ให้ผู้เล่นอื่นเห็น (ไม่ส่ง interim) เพื่อประหยัดโควต้า
9. ลำดับเทิร์นตามลำดับที่เข้าห้อง (`order`) วนซ้ำ ข้ามคนที่ตายแล้ว
