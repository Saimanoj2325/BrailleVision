import { useEffect, useRef, useState } from 'react';

export function useSpeechRecognition({ lang, onResult }) {
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        if (onResult) {
            onResult(text);
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };
    }
  }, [onResult]);

  useEffect(() => {
    if (recognitionRef.current) {
        // Map app language to speech lang if needed, or default to en-US
        const langMap = {
            'eng_Latn': 'en-US',
            'spa_Latn': 'es-ES',
            'fra_Latn': 'fr-FR',
            'slv_Latn': 'sl-SI',
            'hin_Deva': 'hi-IN',
            'zho_Hans': 'zh-CN',
            'jpn_Jpan': 'ja-JP',
            'deu_Latn': 'de-DE',
            'ara_Arab': 'ar-SA',
            'kor_Hang': 'ko-KR'
        };
        recognitionRef.current.lang = langMap[lang] || 'en-US';
    }
  }, [lang]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Speech Rec Start Error", e);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  return {
    isListening,
    transcript,
    startListening,
    stopListening
  };
}
