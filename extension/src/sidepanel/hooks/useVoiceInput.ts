/**
 * U:Echo — Voice Input Hook
 * Uses chrome.runtime messaging to relay speech recognition through an offscreen
 * document, since the Web Speech API is unavailable in extension side panels.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

const SpeechRecognitionAPI =
  (window as unknown as Record<string, unknown>).SpeechRecognition ??
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

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
  /** Whether voice input is available (offscreen doc supports SpeechRecognition) */
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

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    lang = 'en-US',
    interimResults = true,
    onTranscript,
    onError,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const permissionTabOpenedRef = useRef(false);
  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;

  useEffect(() => {
    if (SpeechRecognitionAPI) {
      setIsSupported(true);
      return;
    }

    chrome.runtime.sendMessage(
      { type: 'SP_VOICE_CHECK_SUPPORT' },
      (response) => {
        if (chrome.runtime.lastError) {
          // Extension context issue — voice not available
          setIsSupported(false);
          return;
        }
        setIsSupported(response?.supported ?? false);
      }
    );
  }, []);

  useEffect(() => {
    if (SpeechRecognitionAPI) return;

    const listener = (message: { type: string; [key: string]: unknown }) => {
      if (message.type === 'VOICE_STATUS') {
        const newStatus = message.status as VoiceStatus;
        setStatus(newStatus);
        if (newStatus === 'error' && message.error) {
          onErrorRef.current?.(message.error as string);
        }
      }

      if (message.type === 'VOICE_TRANSCRIPT') {
        const text = message.text as string;
        const isFinal = message.isFinal as boolean;

        if (isFinal) {
          setTranscript((prev) => {
            const updated = prev + (prev ? ' ' : '') + text.trim();
            transcriptRef.current = updated;
            return updated;
          });
          onTranscriptRef.current?.(transcriptRef.current, true);
        } else {
          onTranscriptRef.current?.(text, false);
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const openPermissionTab = useCallback(() => {
    if (!permissionTabOpenedRef.current) {
      permissionTabOpenedRef.current = true;
      chrome.tabs.create({
        url: chrome.runtime.getURL('src/mic-permission/mic-permission.html'),
      });
    }
  }, []);

  const handlePermissionError = useCallback((message: string) => {
    console.warn('[U:Echo] Mic permission denied:', message);
    openPermissionTab();
    onErrorRef.current?.(
      'Microphone permission is blocked. A U:Echo permission tab was opened — allow microphone there, then return and tap the mic again.'
    );
    setStatus('error');
  }, [openPermissionTab]);

  const startListening = useCallback(() => {
    if (SpeechRecognitionAPI) {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }

      const rec = new (SpeechRecognitionAPI as new () => SpeechRecognition)();
      rec.lang = lang;
      rec.interimResults = interimResults;
      rec.continuous = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        permissionTabOpenedRef.current = false;
        setStatus('listening');
      };

      rec.onresult = (event: SpeechRecognitionEvent) => {
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
          const trimmed = finalText.trim();
          const updated = transcriptRef.current + (transcriptRef.current ? ' ' : '') + trimmed;
          transcriptRef.current = updated;
          setTranscript(updated);
          onTranscriptRef.current?.(updated, true);
        } else if (interimText) {
          onTranscriptRef.current?.(interimText, false);
        }
      };

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          handlePermissionError(event.error);
          return;
        }
        onErrorRef.current?.(event.error);
        setStatus('error');
      };

      rec.onend = () => {
        recognitionRef.current = null;
        setStatus('idle');
      };

      recognitionRef.current = rec;

      try {
        rec.start();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/not-allowed/i.test(msg) || /service-not-allowed/i.test(msg)) {
          handlePermissionError(msg);
          return;
        }
        onErrorRef.current?.(msg);
        setStatus('error');
      }
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      stream.getTracks().forEach((t) => t.stop());
      chrome.runtime.sendMessage({
        type: 'SP_VOICE_START',
        payload: { lang, interimResults },
      });
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (/permission dismissed/i.test(msg) || /notallowederror/i.test(msg)) {
        handlePermissionError(msg);
      } else {
        onErrorRef.current?.(`Microphone access denied: ${msg}`);
        setStatus('error');
      }
    });
  }, [lang, interimResults, handlePermissionError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      setStatus('processing');
      recognitionRef.current.stop();
      return;
    }
    setStatus('processing');
    chrome.runtime.sendMessage({ type: 'SP_VOICE_STOP' });
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
    transcriptRef.current = '';
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
