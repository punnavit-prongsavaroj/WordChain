# Word Chain Voice - Backend Architecture Documentation

เอกสารนี้รวบรวมสถาปัตยกรรมฝั่ง Backend และ Database ทั้งหมดที่ใช้อยู่ในปัจจุบัน เพื่อให้ AI หรือทีมนักพัฒนาชุดอื่นสามารถนำไปใช้ออกแบบหรือสร้าง Frontend ตัวใหม่มาเชื่อมต่อได้ทันทีโดยไม่ต้องแก้ไขโค้ดฝั่งหลังบ้าน

## 1. Tech Stack Overview
ระบบหลังบ้านแบ่งออกเป็น 2 ส่วนหลักๆ ซึ่งทำหน้าที่แยกจากกันอย่างชัดเจน:
1. **Firebase (State & Sync):** ทำหน้าที่เป็น Game Server เก็บสถานะเกมทั้งหมดแบบ Realtime
   - **Firestore:** เก็บข้อมูลห้อง (Rooms) และผู้เล่น (Players)
   - **Authentication:** ใช้แบบ Anonymous (ผู้เล่นไม่ต้องสมัครสมาชิก)
2. **FastAPI (Stateless Validation):** ทำหน้าที่เป็นตัวตรวจคำศัพท์ (Judge) ไม่มีการเก็บ State ใดๆ รับ Request เข้ามาแล้วตอบกลับทันที
   - ใช้ **PyThaiNLP** ในการตัดคำและเช็คชนิดคำ
   - ใช้ **Google Gemini API** ในการช่วยตัดสินความเกี่ยวโยงของคำ

---

## 2. FastAPI Endpoints (วิ่งที่ `http://localhost:8000`)

### 2.1 ตรวจสอบคำศัพท์ (Check Word)
**Endpoint:** `POST /api/check-word`
**หน้าที่:** ตรวจสอบว่าคำที่ส่งมาเป็นคำประสม/คำนามที่ถูกต้อง และไม่ได้ใช้พยางค์ซ้ำกับที่เคยใช้ไปแล้ว

**Request Body (JSON):**
```json
{
  "word": "ยาสีฟัน",
  "usedSyllables": ["ยา", "ดม", "พัด", "ลม"]
}
```

**Response (JSON) - กรณีผ่าน:**
```json
{
  "valid": true,
  "reason": "OK",
  "syllables": ["ยา", "สี", "ฟัน"]
}
```

**Response (JSON) - กรณีไม่ผ่าน:**
```json
{
  "valid": false,
  "reason": "พยางค์ 'ยา' ซ้ำ" 
  // หรือ "is_sentence" (ถ้าตรวจพบว่าเป็นประโยค เช่น ฉันวิ่ง)
  // หรือ "not_a_noun" (ถ้าไม่ใช่คำนาม)
}
```
*Note:* การตัดคำใช้ `subword_tokenize(engine='dict')` ของ PyThaiNLP และจะเช็คระดับ "พยางค์" โดยถือว่ารูปวรรณยุกต์และสระต้องตรงกันเป๊ะๆ (เช่น น้ำ != นำ)

### 2.2 AI กรรมการตัดสิน (AI Judge)
**Endpoint:** `POST /api/ai-judge`
**หน้าที่:** ตรวจสอบว่าคำปัจจุบัน มีความเกี่ยวโยงทางความหมายกับคำก่อนหน้าหรือไม่ (ใช้ในโหมด Challenge)

**Request Body (JSON):**
```json
{
  "previousWord": "โรงเรียน",
  "word": "กระดานดำ"
}
```

**Response (JSON):**
```json
{
  "pass": true,
  "reason": "กระดานดำเป็นสิ่งของที่พบได้ทั่วไปในโรงเรียน"
}
```

---

## 3. Firebase Architecture (Firestore)

โครงสร้าง Database ถูกออกแบบให้แบน (Flat) เพื่อให้ง่ายต่อการดึงข้อมูลและทำ Real-time Snapshot

### 3.1 Collection: `rooms`
เก็บสถานะหลักของห้องเกม 
**Document ID:** (Auto-generated) = `roomId`

**Fields:**
*   `code` *(string)*: รหัสเข้าห้อง 6 หลัก
*   `hostUid` *(string)*: UID ของผู้สร้างห้อง (ใช้อ้างอิงว่าเครื่องใครต้องรัน Turn Engine)
*   `status` *(string)*: สถานะห้อง ปัจจุบันมี 4 ค่า `lobby` | `playing` | `challenge` | `finished`
*   `createdAt` *(timestamp)*: เวลาสร้างห้อง
*   `usedSyllables` *(array of string)*: พยางค์ทั้งหมดที่ถูกพูดไปแล้วในเกมนี้
*   `words` *(array of string)*: คำศัพท์ทั้งหมดที่ถูกพูดเรียงตามลำดับ
*   `turnUid` *(string | null)*: UID ของคนที่ต้องพูดในเทิร์นนี้
*   `turnEndTime` *(number | null)*: Timestamp (Date.now()) ของเวลาที่จะหมดเทิร์น (ปกติคือ +15 วินาที)
*   `challenge` *(object | null)*: เก็บสถานะหากมีการประท้วงเกิดขึ้น (ดูโครงสร้างด้านล่าง)

**โครงสร้าง Object `challenge`:**
```json
{
  "challengerUid": "uid_ของคนประท้วง",
  "speakerUid": "uid_ของคนที่ถูกประท้วง",
  "phase": "voting" | "revealed",
  "endTime": 1711234567890, // เวลาหมดโหวต (3 นาที)
  "votes": {
     "uid_1": true,  // true = ให้ผ่าน, false = ปัดตก
     "uid_2": false
  },
  "nextTurnUid": "uid_คนที่ต้องเล่นต่อ",
  "resumeTime": 1711234567890,
  "result": null, // จะถูกเติมเมื่อ phase เป็น revealed { passCount, failCount, outcome }
  "aiVote": null // จะถูกเติมจากการเรียก /api/ai-judge ทันทีที่เกิด Challenge
}
```

### 3.2 Subcollection: `rooms/{roomId}/players`
เก็บข้อมูลผู้เล่นที่อยู่ในห้องนั้นๆ
**Document ID:** `uid` (จาก Firebase Anonymous Auth)

**Fields:**
*   `name` *(string)*: ชื่อผู้เล่น
*   `alive` *(boolean)*: สถานะการรอดชีวิต (ถ้าเวลาหมด หรือถูกโหวตปัดตก จะกลายเป็น false)
*   `joinedAt` *(number)*: Timestamp ตอนเข้าห้อง
*   `order` *(number)*: คิวในการเล่น (0, 1, 2...) อิงจากลำดับการเข้าห้อง
*   `isSpectator` *(boolean, optional)*: ถ้าเข้าห้องตอน `status !== 'lobby'` จะเป็น true
*   `peerId` *(string, optional)*: ID สำหรับต่อ WebRTC (PeerJS) หากต้องการทำระบบ Video Call

---

## 4. Game Logic Executions (ข้อควรระวังสำหรับ Frontend)
เนื่องจากระบบไม่มี Server-side Node.js มาคอยนั่งรัน `setInterval` โลจิกควบคุมเกมจึง **"ต้องทำงานอยู่บน Frontend ของ Host"** (ผู้เล่นที่เป็น `hostUid`)

**Frontend ใหม่จะต้องเขียน Engine 2 ตัวนี้ไปรันเงียบๆ บนฝั่ง Host:**
1. **Turn Engine:** ใช้ `setInterval` เช็คว่า `Date.now() >= turnEndTime` หรือไม่ ถ้าใช่ ให้เปลี่ยนค่าใน Firestore ปรับให้คนนั้น `alive: false` แล้วเด้งเทิร์นหาคนถัดไป
2. **Challenge Engine:** เมื่อ `status === 'challenge'` ให้ Host รันเวลานับถอยหลัง 3 นาที เมื่อครบกำหนด ให้คำนวณคะแนนใน `challenge.votes` รวมกับ `challenge.aiVote` แล้วสรุปผลลง Firestore เพื่อปรับผู้แพ้ให้ `alive: false` และปรับ `status` กลับเป็น `playing`
