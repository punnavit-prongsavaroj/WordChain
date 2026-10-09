import { useEffect, useState, useRef } from 'react';

interface UseSpeechRecognitionProps {
  active: boolean;
  onFinalResult: (text: string) => void;
}

export function useSpeechRecognition({ active, onFinalResult }: UseSpeechRecognitionProps) {
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
    if (!active && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
      setInterimText('');
    }
  }, [active]);

  const onFinalResultRef = useRef(onFinalResult);
  
  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  useEffect(() => {
    // Check support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('เบราว์เซอร์ของคุณไม่รองรับระบบสั่งงานด้วยเสียง (กรุณาใช้ Chrome)');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'th-TH';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      setInterimText(interimTranscript);

      if (finalTranscript.trim()) {
        onFinalResultRef.current(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      // Ignore expected errors from Push-to-Talk
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
         console.error('Speech error:', event.error);
      }
      
      if (event.error === 'not-allowed') {
        setError('กรุณาอนุญาตให้ใช้งานไมโครโฟน');
      } else if (event.error === 'no-speech' || event.error === 'network' || event.error === 'aborted') {
        // Expected during push-to-talk release or silence
      } else {
        setError('ไม่เข้าใจ ลองพูดใหม่ครับ');
      }
    };

    recognition.onnomatch = () => {
       setError('ไม่เข้าใจ ลองพูดใหม่ครับ');
    };

    recognition.onend = () => {
      // Auto-restart if still active
      if (activeRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Ignore ALREADY_STARTED error
        }
      }
    };

    if (activeRef.current) {
      try {
        recognition.start();
      } catch (e) {
        // Ignore
      }
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };
  }, []); // Only run once on mount!

  // Expose a way to restart manually if needed
  useEffect(() => {
     if(active && recognitionRef.current) {
         try { recognitionRef.current.start(); } catch(e) {}
     }
  }, [active]);

  return { interimText, error };
}
