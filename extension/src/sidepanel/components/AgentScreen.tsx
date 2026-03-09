import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, GestureEvent, PromptSchema } from '@shared/types';

interface AgentScreenProps {
  onSubmitText: (text: string) => void;
  onEnhanceText: (text: string) => void;
  onNavigateToVerify: (prompt: PromptSchema) => void;
}

const AgentScreen: React.FC<AgentScreenProps> = ({
  onSubmitText,
  onEnhanceText,
  onNavigateToVerify,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'system-1',
      role: 'system',
      content: 'Echo AI ready. Select an element on the page to begin.',
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
            id: `system-${Date.now()}`,
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
          id: `assistant-${Date.now()}`,
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

  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);
    onSubmitText(inputText.trim());
    setInputText('');
  };

  const handleEnhance = () => {
    if (!inputText.trim()) return;
    onEnhanceText(inputText.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Agent Header */}
      <div className="flex items-center justify-between pb-3 border-b border-echo-border mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">AI</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-echo-text">Echo AI</h2>
            <span className="text-[10px] text-echo-text-muted">
              v0.1.0-dev
            </span>
          </div>
        </div>
        {isProcessing && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-medium text-primary">
              Processing
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onViewPrompt={
              msg.metadata?.prompt
                ? () => onNavigateToVerify(msg.metadata!.prompt!)
                : undefined
            }
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-echo-border pt-3">
        <div className="flex gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your UI change..."
            rows={2}
            className="flex-1 px-3 py-2 text-sm bg-echo-surface border border-echo-border rounded-lg
              resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50
              placeholder:text-echo-text-muted"
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleEnhance}
            disabled={!inputText.trim() || isProcessing}
            className="px-3 py-1.5 text-[11px] font-medium text-primary bg-primary/10 rounded-md
              hover:bg-primary/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Enhance
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing}
            className="px-4 py-1.5 text-[11px] font-medium text-white bg-primary rounded-md
              hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors
              shadow-sm shadow-primary/20"
          >
            {isProcessing ? 'Processing...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageBubble: React.FC<{
  message: ChatMessage;
  onViewPrompt?: () => void;
}> = ({ message, onViewPrompt }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
          isUser
            ? 'bg-primary text-white rounded-br-sm'
            : isSystem
              ? 'bg-echo-code-bg text-echo-text-secondary border border-echo-border rounded-bl-sm'
              : 'bg-echo-surface text-echo-text border border-echo-border rounded-bl-sm'
        }`}
      >
        {isSystem && (
          <span className="text-[10px] font-medium text-echo-text-muted block mb-1">
            System
          </span>
        )}
        {message.role === 'assistant' && (
          <span className="text-[10px] font-medium text-primary block mb-1">
            Echo Assistant
          </span>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.metadata?.gesture_event && (
          <div className="mt-1.5 px-2 py-1 bg-echo-code/5 rounded text-[10px] font-mono text-echo-text-muted">
            {message.metadata.gesture_event.selector}
          </div>
        )}
        {onViewPrompt && (
          <button
            onClick={onViewPrompt}
            className="mt-2 w-full py-1.5 text-[10px] font-medium text-primary bg-primary/10 rounded
              hover:bg-primary/15 transition-colors"
          >
            Review Prompt →
          </button>
        )}
      </div>
    </div>
  );
};

export default AgentScreen;
