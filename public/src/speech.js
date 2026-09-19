// ===== Speech Module using Web Speech API (Google) =====
// ใช้ Web Speech API ที่ฝังอยู่ใน Chrome/Edge
// รองรับภาษาไทยได้ดีและฟรี ไม่ต้องใช้ Backend

// Backend API URL — change this after deploying to Render/Koyeb/Cloud Run
const DEPLOYED_API_URL = "https://wordchain-backend-ikar.onrender.com/api"; 
const LOCAL_API_URL = "http://127.0.0.1:8000/api";
// ใช้ Render.com API เสมอ ตามที่ผู้ใช้ต้องการ
const API_BASE_URL = DEPLOYED_API_URL;

let recognition = null;
let isRecognizing = false;

/**
 * ตรวจสอบว่า Browser รองรับ Web Speech API และอยู่ใน Secure Context หรือไม่
 */
function checkBrowserSupport() {
    // ต้องเป็น HTTPS หรือ localhost เท่านั้น
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        throw new Error('กรุณาเปิดเว็บด้วย HTTPS (ไม่รองรับ HTTP)');
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        throw new Error('กรุณาใช้ Chrome หรือ Edge เท่านั้น (ไม่รองรับ Firefox/Safari)');
    }
}

/**
 * สร้าง SpeechRecognition instance พร้อมตั้งค่าสำหรับภาษาไทย
 */
function createRecognition() {
    checkBrowserSupport();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = 'th-TH';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    return rec;
}

/**
 * ขอ Permission Microphone
 */
export async function requestMicrophonePermission() {
    try {
        checkBrowserSupport();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (e) {
        console.error("Microphone permission denied", e);
        return false;
    }
}

/**
 * เริ่มฟังเสียงและแปลงเป็นข้อความทันที (Promise-based)
 * Timeout อัตโนมัติหลังจาก maxMs มิลลิวินาที
 */
export function speechToTextLive(maxMs = 4000) {
    return new Promise((resolve, reject) => {
        try {
            recognition = createRecognition();
        } catch (e) {
            return reject(e);
        }

        let resolved = false;

        // ได้ยินคำแล้ว
        recognition.onresult = (event) => {
            if (resolved) return;
            resolved = true;
            const transcript = event.results[0][0].transcript.trim();
            console.log(`[Speech] ได้ยิน: "${transcript}"`);
            resolve(transcript);
        };

        // เกิด Error
        recognition.onerror = (event) => {
            if (resolved) return;
            resolved = true;
            console.error("[Speech] Error:", event.error);

            const errorMessages = {
                'not-allowed':         'กรุณาอนุญาตไมโครโฟนในเบราว์เซอร์ก่อนครับ (คลิกไอคอน 🔒 ที่ Address Bar)',
                'service-not-allowed': 'เบราว์เซอร์บล็อกไมโครโฟน กรุณาเปิด Settings → Privacy → Microphone',
                'no-speech':           '', // ไม่ได้ยินเสียง → ปกติ
                'audio-capture':       'ไม่พบอุปกรณ์ไมโครโฟน กรุณาเสียบไมค์ก่อนครับ',
                'network':             'เชื่อมต่อ Speech API ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต',
                'aborted':             '', // หยุดเองตามปกติ
            };

            const msg = errorMessages[event.error];
            if (msg === '') {
                resolve(''); // ไม่ได้ยินหรือยกเลิก → ส่งค่าว่าง
            } else if (msg) {
                reject(new Error(msg));
            } else {
                reject(new Error(`ไมโครโฟน Error: ${event.error}`));
            }
        };

        // จบการฟัง (ไม่ได้ยินอะไร)
        recognition.onend = () => {
            if (!resolved) {
                resolved = true;
                resolve('');
            }
        };

        recognition.start();
        isRecognizing = true;

        // Timeout กรณีเงียบเกินไป
        setTimeout(() => {
            if (!resolved) {
                stopRecognition();
            }
        }, maxMs);
    });
}

/**
 * หยุดการฟังเสียง
 */
export function stopRecognition() {
    if (recognition && isRecognizing) {
        try {
            recognition.stop();
        } catch (e) { /* ignore */ }
        isRecognizing = false;
    }
}

// ฟังก์ชัน stub สำหรับ backward compat กับ voiceRecorder เดิม
export async function startRecording() { return true; }
export async function stopRecording() { return null; }

/**
 * ฟังก์ชันเดิมสำหรับ mic test (กดค้าง)
 * ใช้ Web Speech API แทน Whisper
 */
export async function speechToText(audioBlob) {
    // audioBlob ไม่ได้ใช้แล้ว แต่ยังเก็บ signature ไว้เพื่อ compat
    return await speechToTextLive(5000);
}

/**
 * ตรวจสอบว่าคำที่พูดเป็นคำนามไทยหรือไม่
 * ยังคงเรียก Backend Python สำหรับการตรวจสอบคำ
 */
export async function checkWordAPI(word) {
    const maxRetries = 15;
    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); 
            
            const response = await fetch(`${API_BASE_URL}/check-word`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Bypass-Tunnel-Reminder": "true" 
                },
                body: JSON.stringify({ word }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error("ระบบตรวจสอบคำมีปัญหา (Backend Error)");
            }

            return await response.json(); 
        } catch (e) {
            attempt++;
            console.warn(`[API] Attempt ${attempt} failed: ${e.message}. Retrying in 3s...`);
            
            if (attempt >= maxRetries) {
                if (e.name === 'AbortError' || e.message.includes("Failed to fetch")) {
                    throw new Error("เซิร์ฟเวอร์ไม่ตอบสนอง (ตื่นจาก Sleep ไม่ทัน)");
                }
                throw e;
            }
            
            // รอ 3 วินาทีแล้วลองใหม่ (แก้ปัญหา CORS ชั่วคราวตอนเซิร์ฟเวอร์เพิ่งตื่น)
            await new Promise(r => setTimeout(r, 3000));
        }
    }
}
