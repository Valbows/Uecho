import React from 'react';
import type { ChatMessage, PromptSchema } from '@shared/types';
import { useChatStore } from '../hooks/useChatStore';
import { useVoiceInput } from '../hooks/useVoiceInput';
import type { VoiceStatus } from '../hooks/useVoiceInput';

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
  const chat = useChatStore({ onSubmitText, onEnhanceText });

  const voice = useVoiceInput({
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        chat.setInputText(text);
      }
    },
    onError: (error) => {
      console.warn('[U:Echo] Voice error:', error);
    },
  });

  const handleSend = () => {
    voice.stopListening();
    voice.clearTranscript();
    chat.sendMessage(chat.inputText);
  };

  const handleEnhance = () => {
    chat.enhanceText(chat.inputText);
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
        <div className="flex items-center gap-2">
          {voice.status === 'listening' && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-echo-error/10 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-echo-error animate-pulse" />
              <span className="text-[10px] font-medium text-echo-error">
                Listening
              </span>
            </div>
          )}
          {chat.isProcessing && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-medium text-primary">
                Processing
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {chat.messages.map((msg) => (
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
        <div ref={chat.messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-echo-border pt-3">
        <div className="flex gap-2">
          <textarea
            value={chat.inputText}
            onChange={(e) => chat.setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              voice.status === 'listening'
                ? 'Listening... speak your change'
                : 'Describe your UI change...'
            }
            rows={2}
            className={`flex-1 px-3 py-2 text-sm bg-echo-surface border rounded-lg
              resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50
              placeholder:text-echo-text-muted ${
                voice.status === 'listening'
                  ? 'border-echo-error/40 ring-1 ring-echo-error/20'
                  : 'border-echo-border'
              }`}
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleEnhance}
            disabled={!chat.inputText.trim() || chat.isProcessing}
            className="px-3 py-1.5 text-[11px] font-medium text-primary bg-primary/10 rounded-md
              hover:bg-primary/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Enhance
          </button>
          {voice.isSupported && (
            <VoiceButton
              status={voice.status}
              onClick={voice.toggleListening}
              disabled={chat.isProcessing}
            />
          )}
          <div className="flex-1" />
          <button
            onClick={handleSend}
            disabled={!chat.inputText.trim() || chat.isProcessing}
            className="px-4 py-1.5 text-[11px] font-medium text-white bg-primary rounded-md
              hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors
              shadow-sm shadow-primary/20"
          >
            {chat.isProcessing ? 'Processing...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

const VoiceButton: React.FC<{
  status: VoiceStatus;
  onClick: () => void;
  disabled: boolean;
}> = ({ status, onClick, disabled }) => {
  const isListening = status === 'listening';
  const isError = status === 'error';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={isListening ? 'Stop listening' : 'Start voice input'}
      className={`relative w-8 h-8 flex items-center justify-center rounded-md border transition-all
        disabled:opacity-40 disabled:cursor-not-allowed ${
          isListening
            ? 'bg-echo-error/10 border-echo-error/30 text-echo-error'
            : isError
              ? 'bg-echo-warning/10 border-echo-warning/30 text-echo-warning'
              : 'bg-echo-surface border-echo-border text-echo-text-secondary hover:border-primary/20 hover:text-primary'
        }`}
    >
      {isListening && (
        <span className="absolute inset-0 rounded-md border-2 border-echo-error/30 animate-ping" />
      )}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    </button>
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
