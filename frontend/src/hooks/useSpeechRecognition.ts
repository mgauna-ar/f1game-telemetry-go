import { useState, useRef, useCallback } from 'react';
import { RADIO_CONVERSATION_LIMITS } from '../constants/f1';
import {
  getSpeechRecognitionClass,
  type ISpeechRecognition,
  type ISpeechRecognitionEvent,
  type ISpeechRecognitionErrorEvent,
} from '../utils/radioAudio';

/** The error code set when the browser has no speech recognition at all. */
export const SPEECH_NOT_SUPPORTED = 'not-supported';

export interface UseSpeechRecognitionOptions {
  getLang?: () => string;
  onTranscriptReceived?: (transcript: string) => void;
}

export interface UseSpeechRecognitionReturn {
  transcript: string;
  startListening: () => boolean;
  /** Stops listening. Resolves once the recognizer has delivered its last words, or after a time limit. */
  stopListening: () => Promise<void>;
  abortListening: () => void;
  clearTranscript: () => void;
  getFinalTranscript: () => string;
  /**
   * Why the current transmission was not understood: the recognizer's error code ('not-allowed',
   * 'no-speech', 'network', ...) or SPEECH_NOT_SUPPORTED, or null when it reported none.
   */
  getErrorCode: () => string | null;
}

/** One recognizer run, from start to its end event. */
interface RecognitionSession {
  recognition: ISpeechRecognition;
  /** Resolves when the recognizer has ended, after its last result. */
  ended: Promise<void>;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const { getLang, onTranscriptReceived } = options;

  const [transcript, setTranscript] = useState<string>('');

  // The run whose results and errors count; an aborted or replaced one is ignored.
  const sessionRef = useRef<RecognitionSession | null>(null);
  const currentTranscriptRef = useRef<string>('');
  const errorCodeRef = useRef<string | null>(null);

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

  const getErrorCode = useCallback(() => errorCodeRef.current, []);

  const abortListening = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      try {
        session.recognition.abort();
      } catch {}
    }
  }, []);

  const stopListening = useCallback((): Promise<void> => {
    const session = sessionRef.current;
    if (!session) return Promise.resolve();
    try {
      // The words said just before the release still arrive after stop(), until the end event.
      session.recognition.stop();
    } catch {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, RADIO_CONVERSATION_LIMITS.RECOGNIZER_END_TIMEOUT_MS);
      session.ended.then(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }, []);

  const startListening = useCallback((): boolean => {
    abortListening();
    currentTranscriptRef.current = '';
    errorCodeRef.current = null;
    setTranscript('');

    const SpeechRec = getSpeechRecognitionClass();
    if (!SpeechRec) {
      errorCodeRef.current = SPEECH_NOT_SUPPORTED;
      return false;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = getLangRef.current ? getLangRef.current() : 'en-GB';

      let markEnded = () => {};
      const session: RecognitionSession = {
        recognition,
        ended: new Promise<void>((resolve) => {
          markEnded = resolve;
        }),
      };
      const isCurrent = () => sessionRef.current === session;

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        if (!isCurrent()) return;
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

      recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        if (isCurrent()) errorCodeRef.current = event.error;
      };

      recognition.onend = () => {
        markEnded();
        if (isCurrent()) sessionRef.current = null;
      };

      sessionRef.current = session;
      recognition.start();
      return true;
    } catch {
      sessionRef.current = null;
      errorCodeRef.current = 'start-failed';
      return false;
    }
  }, [abortListening]);

  return {
    transcript,
    startListening,
    stopListening,
    abortListening,
    clearTranscript,
    getFinalTranscript,
    getErrorCode,
  };
}
