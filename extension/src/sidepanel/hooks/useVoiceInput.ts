/**
 * U:Echo — Voice Input Hook
 * Provides speech-to-text via the Web Speech API (SpeechRecognition).
 * Falls back gracefully when the API is unavailable (e.g., Firefox, headless tests).
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'error';

interface UseVoiceInputOptions {
  /** Language for speech recognition (BCP-47). Default: 'en-US' */
  lang?: string;
  /** Fire results continuously while speaking. Default: true */
  interimResults?: boolean;
  /** Called with each interim or final transcript chunk */
  onTranscript?: (text: string, isFinal: boolean) => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
}

interface UseVoiceInputReturn {
  /** Whether the Web Speech API is available */
  isSupported: boolean;
  /** Current voice input status */
  status: VoiceStatus;
  /** The accumulated transcript from the current session */
  transcript: string;
  /** Start listening */
  startListening: () => void;
  /** Stop listening */
  stopListening: () => void;
  /** Toggle listening on/off */
  toggleListening: () => void;
  /** Clear the transcript */
  clearTranscript: () => void;
}

// Detect SpeechRecognition API (vendor-prefixed in Chrome)
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    : undefined;

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    lang = 'en-US',
    interimResults = true,
    onTranscript,
    onError,
  } = options;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isSupported = !!SpeechRecognitionAPI;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setStatus('error');
      onError?.('Speech recognition is not supported in this browser.');
      return;
    }

    // Abort any existing session
    recognitionRef.current?.abort();

    const recognition = new (SpeechRecognitionAPI as new () => SpeechRecognition)();
    recognition.lang = lang;
    recognition.interimResults = interimResults;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus('listening');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        setTranscript((prev) => {
          const updated = prev + (prev ? ' ' : '') + finalText.trim();
          transcriptRef.current = updated;
          return updated;
        });
        onTranscript?.(transcriptRef.current, true);
      } else if (interimText) {
        onTranscript?.(interimText, false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are not real errors
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      setStatus('error');
      onError?.(event.error);
    };

    recognition.onend = () => {
      // Only set idle if we didn't already set error
      setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setStatus('error');
      onError?.('Failed to start speech recognition.');
    }
  }, [lang, interimResults, onTranscript, onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      setStatus('processing');
      recognitionRef.current.stop();
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (status === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  }, [status, startListening, stopListening]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isSupported,
    status,
    transcript,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
  };
}
