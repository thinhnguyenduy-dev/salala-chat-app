'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Mic, X, Send, Play, Pause, Trash2 } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  disabled?: boolean;
  className?: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VoiceRecorder({
  onSend,
  onRecordingStateChange,
  disabled = false,
  className,
}: VoiceRecorderProps) {
  const {
    isRecording,
    duration,
    audioBlob,
    audioUrl,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
  } = useVoiceRecorder({ maxDuration: 120 });

  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const recordedDurationRef = useRef(0);

  // Track if we're in preview mode (recording stopped, have audio)
  const isPreviewMode = !isRecording && audioBlob !== null;

  const handleMouseDown = useCallback(() => {
    if (disabled || isPreviewMode) return;
    startRecording();
    onRecordingStateChange?.(true);
  }, [disabled, isPreviewMode, startRecording, onRecordingStateChange]);

  const handleMouseUp = useCallback(() => {
    if (!isRecording) return;
    recordedDurationRef.current = duration;
    stopRecording();
    // Don't call onRecordingStateChange(false) here - stay in recording UI for preview
    // Only call it when cancel or send completes
  }, [isRecording, duration, stopRecording]);

  const handleCancel = useCallback(() => {
    cancelRecording();
    setIsPreviewPlaying(false);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    onRecordingStateChange?.(false);
  }, [cancelRecording, onRecordingStateChange]);

  const handleSend = useCallback(() => {
    if (audioBlob) {
      onSend(audioBlob, recordedDurationRef.current);
      clearRecording();
      setIsPreviewPlaying(false);
      onRecordingStateChange?.(false);
    }
  }, [audioBlob, onSend, clearRecording, onRecordingStateChange]);

  const togglePreviewPlay = useCallback(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    if (isPreviewPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPreviewPlaying(!isPreviewPlaying);
  }, [isPreviewPlaying]);

  const handlePreviewEnded = useCallback(() => {
    setIsPreviewPlaying(false);
  }, []);

  // Preview mode UI
  if (isPreviewMode && audioUrl) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <audio
          ref={previewAudioRef}
          src={audioUrl}
          onEnded={handlePreviewEnded}
          preload="metadata"
        />

        {/* Cancel button */}
        <button
          onClick={handleCancel}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
          title="Cancel"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Preview player */}
        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-full">
          <button
            onClick={togglePreviewPlay}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            {isPreviewPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>

          {/* Waveform placeholder / duration */}
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-1 bg-primary/20 rounded-full">
              <div className="h-full w-0 bg-primary rounded-full" />
            </div>
            <span className="text-xs text-muted-foreground min-w-[36px]">
              {formatDuration(recordedDurationRef.current)}
            </span>
          </div>
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 hover:opacity-90 text-white transition-opacity"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Recording mode UI - entire area responds to mouse/touch release
  if (isRecording) {
    return (
      <div
        className={cn('flex items-center gap-3 select-none', className)}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
      >
        {/* Cancel button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCancel();
          }}
          className="flex items-center gap-2 text-destructive hover:text-destructive/80 transition-colors"
        >
          <X className="w-5 h-5" />
          <span className="text-sm">Cancel</span>
        </button>

        {/* Recording indicator and timer */}
        <div className="flex-1 flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-sm font-medium text-red-500">
              {formatDuration(duration)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            (max 2:00)
          </span>
        </div>

        {/* Stop button - tap to stop */}
        <button
          onClick={handleMouseUp}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-colors animate-pulse"
          title="Tap to stop"
        >
          <Mic className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Error display
  if (error) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-sm text-destructive">{error}</span>
        <button
          onClick={clearRecording}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Dismiss
        </button>
      </div>
    );
  }

  // Idle mode - just the mic button
  return (
    <button
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      disabled={disabled}
      className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center transition-all',
        'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground',
        'active:scale-95 active:bg-red-500 active:text-white',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      title="Hold to record"
    >
      <Mic className="w-5 h-5" />
    </button>
  );
}
