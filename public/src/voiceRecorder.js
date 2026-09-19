let mediaRecorder = null;
let audioChunks = [];

export async function startMediaRecording() {
    audioChunks = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    
    mediaRecorder.addEventListener("dataavailable", event => {
        if (event.data.size > 0) {
            audioChunks.push(event.data);
        }
    });
    
    mediaRecorder.start();
    return true;
}

export function stopMediaRecording() {
    return new Promise((resolve) => {
        if (!mediaRecorder) return resolve(null);
        
        mediaRecorder.addEventListener("stop", () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            // Stop all tracks
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            mediaRecorder = null;
            resolve(audioBlob);
        });
        
        if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        } else {
            resolve(null);
        }
    });
}
