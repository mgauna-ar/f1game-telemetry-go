import { useState, useRef, useCallback } from 'react';
import { getSpeechRecognitionClass, type ISpeechRecognition } from '../utils/radioAudio';

export interface UseSpeechRecognitionOptions {
  getLang?: () => string;
  onTranscriptReceived?: (transcript: string) => void;
}

export interface UseSpeechRecognitionReturn {
  transcript: string;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  startListening: () => boolean;
  stopListening: () => void;
  abortListening: () => void;
  clearTranscript: () => void;
  getFinalTranscript: () => string;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const { getLang, onTranscriptReceived } = options;

  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const currentTranscriptRef = useRef<string>('');

  const getLangRef = useRef(getLang);
  getLangRef.current = getLang;

  const onTranscriptReceivedRef = useRef(onTranscriptReceived);
  onTranscriptReceivedRef.current = onTranscriptReceived;

  const clearTranscript = useCallback(() => {
    currentTranscriptRef.current = '';
    setTranscript('');
  }, []);

  const getFinalTranscript = useCallback(() => {
    return currentTranscriptRef.current;
  }, []);

  const abortListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  }, []);

  const startListening = useCallback((): boolean => {
    abortListening();
    currentTranscriptRef.current = '';
    setTranscript('');
    setError(null);

    const SpeechRec = getSpeechRecognitionClass();
    if (!SpeechRec) {
      setError('Speech recognition not supported in browser');
      return false;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = getLangRef.current ? getLangRef.current() : 'en-GB';

      recognition.onresult = (event: any) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        currentTranscriptRef.current = text;
        setTranscript(text);
        if (onTranscriptReceivedRef.current) {
          onTranscriptReceivedRef.current(text);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.warn('[Live Radio] Speech recognition error:', event.error);
          setError(`Speech recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
      };

      recognition.start();
      recognitionRef.current = recognition;
      return true;
    } catch (err: any) {
      console.warn('[Live Radio] Failed to start speech recognition:', err);
      setError(err?.message || 'Failed to start speech recognition');
      return false;
    }
  }, [abortListening]);

  return {
    transcript,
    error,
    setError,
    startListening,
    stopListening,
    abortListening,
    clearTranscript,
    getFinalTranscript,
  };
}
