/**
 * U:Echo — Chat Store Hook
 * Manages chat message state, incoming service worker messages,
 * and exposes actions for sending/enhancing text.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatMessage, GestureEvent, PromptSchema } from '@shared/types';

let _msgIdCounter = 0;
function generateMsgId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_msgIdCounter}`;
}

interface UseChatStoreReturn {
  messages: ChatMessage[];
  inputText: string;
  isProcessing: boolean;
  setInputText: (text: string) => void;
  sendMessage: (text: string) => void;
  enhanceText: (text: string) => void;
  clearMessages: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

interface UseChatStoreOptions {
  onSubmitText: (text: string) => void;
  onEnhanceText: (text: string) => void;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'system-1',
  role: 'system',
  content: 'Echo AI ready. Select an element on the page to begin.',
  timestamp: Date.now(),
};

export function useChatStore(options: UseChatStoreOptions): UseChatStoreReturn {
  const { onSubmitText, onEnhanceText } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for service worker messages
  useEffect(() => {
    const listener = (message: { type: string; payload: unknown }) => {
      if (message.type === 'SW_INTENT_POPULATE') {
        const payload = message.payload as {
          intent_text: string;
          gesture: GestureEvent;
        };
        setInputText(payload.intent_text);

        setMessages((prev) => [
          ...prev,
          {
            id: generateMsgId('system'),
            role: 'system',
            content: `Gesture translated into plain English:\n"${payload.intent_text}"`,
            timestamp: Date.now(),
            metadata: { gesture_event: payload.gesture },
          },
        ]);
      }

      if (message.type === 'SW_AGENT_RESPONSE') {
        setIsProcessing(false);
        const resp = message.payload as {
          interpreted_intent: string;
          prompt?: PromptSchema;
          status: string;
        };

        const assistantMsg: ChatMessage = {
          id: generateMsgId('assistant'),
          role: 'assistant',
          content: resp.prompt
            ? "I've generated the structured prompt. Ready to review and send to your IDE."
            : resp.interpreted_intent || 'Processing complete.',
          timestamp: Date.now(),
          metadata: resp.prompt ? { prompt: resp.prompt } : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      const userMsg: ChatMessage = {
        id: generateMsgId('user'),
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);
      onSubmitText(text.trim());
      setInputText('');
    },
    [onSubmitText]
  );

  const enhanceText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      onEnhanceText(text.trim());
    },
    [onEnhanceText]
  );

  const clearMessages = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
    setInputText('');
    setIsProcessing(false);
  }, []);

  return {
    messages,
    inputText,
    isProcessing,
    setInputText,
    sendMessage,
    enhanceText,
    clearMessages,
    messagesEndRef,
  };
}
