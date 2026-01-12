"use client";

import React, { useState, useRef, memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Paperclip, Smile, X } from 'lucide-react';
import { IMessage } from '@repo/shared';
import Image from 'next/image';
import EmojiPicker from 'emoji-picker-react';
import { VoiceRecorder } from '@/components/ui/VoiceRecorder';
import { useTranslation } from 'react-i18next';

interface ChatInputProps {
  onSendMessage: (content: string, fileUrl?: string, replyToId?: string) => void;
  onVoiceSend: (audioBlob: Blob) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  replyingTo: IMessage | null;
  onCancelReply: () => void;
  replyToName?: string;
  isUploading: boolean;
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClearFile: () => void;
  selectedFileUrl?: string;
  disabled?: boolean;
}

export const ChatInput = memo(function ChatInput({
  onSendMessage,
  onVoiceSend,
  onTyping,
  onStopTyping,
  replyingTo,
  onCancelReply,
  replyToName,
  isUploading,
  onFileSelect,
  selectedFile,
  onClearFile,
  selectedFileUrl,
  disabled
}: ChatInputProps) {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingEmittedRef = useRef<number>(0);

  const handleInputChange = useCallback((value: string) => {
    setInputText(value);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Throttle typing indicator: max once every 2 seconds
    const now = Date.now();
    if (now - lastTypingEmittedRef.current > 2000) {
      onTyping();
      lastTypingEmittedRef.current = now;
    }

    // Auto stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      onStopTyping();
    }, 2000);
  }, [onTyping, onStopTyping]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() && !selectedFile) return;

    // Stop typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onStopTyping();

    onSendMessage(inputText, selectedFileUrl, replyingTo?.id);
    setInputText('');
  }, [inputText, selectedFile, selectedFileUrl, replyingTo?.id, onSendMessage, onStopTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleEmojiClick = useCallback((emojiData: { emoji: string }) => {
    setInputText(prev => prev + emojiData.emoji);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  }, [onFileSelect]);

  return (
    <div className="p-4 border-t bg-card/50 backdrop-blur">
      {replyingTo && (
        <div className="flex items-center justify-between bg-muted/50 p-2 rounded-t-lg border-b mb-2">
          <div className="flex flex-col text-sm border-l-2 border-brand pl-2">
            <span className="font-semibold text-brand-600">Replying to {replyToName || 'Someone'}</span>
            <span className="text-muted-foreground truncate max-w-[300px]">{replyingTo.content || 'Media/Voice message'}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancelReply} className="h-6 w-6">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {selectedFile && selectedFileUrl && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg w-fit">
          <div className="relative w-12 h-12 rounded overflow-hidden">
            <Image
              src={selectedFileUrl}
              alt="Preview"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium max-w-[150px] truncate">{selectedFile.name}</span>
            <span className="text-[10px] text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-1 rounded-full hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              onClearFile();
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          >
            <span className="sr-only">Remove</span>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />

      {isVoiceRecording ? (
        <div className="bg-muted/50 p-2 rounded-xl">
          <VoiceRecorder
            onSend={onVoiceSend}
            onRecordingStateChange={setIsVoiceRecording}
            disabled={isUploading}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-xl">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-muted-foreground hover:bg-background"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <Input
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
            placeholder={isUploading ? t('common.uploading') : t('common.type_message')}
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isUploading || disabled}
          />

          <div className="relative">
            {showEmojiPicker && (
              <div className="absolute bottom-12 right-0 z-10 shadow-xl rounded-xl">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width={300}
                  height={400}
                />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-9 rounded-full text-muted-foreground hover:bg-background ${showEmojiPicker ? 'text-primary bg-background' : ''}`}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="h-5 w-5" />
            </Button>
          </div>

          {!inputText.trim() && !selectedFile ? (
            <VoiceRecorder
              onSend={onVoiceSend}
              onRecordingStateChange={setIsVoiceRecording}
              disabled={isUploading}
            />
          ) : (
            <Button size="icon" className="h-9 w-9 rounded-full" onClick={handleSend} disabled={isUploading}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
});
