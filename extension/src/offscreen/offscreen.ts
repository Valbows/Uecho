/**
 * U:Echo — Offscreen Document for Voice Input
 * Runs SpeechRecognition in a hidden document where the Web Speech API is available.
 * Communicates with the service worker via chrome.runtime messaging.
 */

let recognition: SpeechRecognition | null = null;

const SpeechRecognitionAPI =
  (window as unknown as Record<string, unknown>).SpeechRecognition ??
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

console.log('[U:Echo Offscreen] Document loaded, SpeechRecognition available:', !!SpeechRecognitionAPI);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen-voice') return;

  console.log('[U:Echo Offscreen] Received message:', message.type);

  switch (message.type) {
    case 'VOICE_CHECK_SUPPORT': {
      const supported = !!SpeechRecognitionAPI;
      console.log('[U:Echo Offscreen] SpeechRecognition supported:', supported);
      sendResponse({ supported });
      break;
    }

    case 'VOICE_START': {
      if (!SpeechRecognitionAPI) {
        sendResponse({ ok: false, error: 'SpeechRecognition not available' });
        return;
      }

      // Abort any existing session
      recognition?.abort();

      const rec = new (SpeechRecognitionAPI as new () => SpeechRecognition)();
      rec.lang = message.lang || 'en-US';
      rec.interimResults = message.interimResults ?? true;
      rec.continuous = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        chrome.runtime.sendMessage({
          type: 'VOICE_STATUS',
          status: 'listening',
        }).catch(() => {});
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
          chrome.runtime.sendMessage({
            type: 'VOICE_TRANSCRIPT',
            text: finalText.trim(),
            isFinal: true,
          }).catch(() => {});
        } else if (interimText) {
          chrome.runtime.sendMessage({
            type: 'VOICE_TRANSCRIPT',
            text: interimText,
            isFinal: false,
          }).catch(() => {});
        }
      };

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        chrome.runtime.sendMessage({
          type: 'VOICE_STATUS',
          status: 'error',
          error: event.error,
        }).catch(() => {});
      };

      rec.onend = () => {
        chrome.runtime.sendMessage({
          type: 'VOICE_STATUS',
          status: 'idle',
        }).catch(() => {});
        recognition = null;
      };

      recognition = rec;
      try {
        rec.start();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      break;
    }

    case 'VOICE_STOP': {
      if (recognition) {
        recognition.stop();
      }
      sendResponse({ ok: true });
      break;
    }

    default:
      break;
  }

  return true; // async
});
