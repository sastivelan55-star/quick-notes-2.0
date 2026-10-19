'use client';

import { useState, useEffect, useRef } from 'react';
import {
  VoiceDictationService,
  AudioRecordingService,
  isSpeechRecognitionSupported,
  isAudioRecordingSupported,
} from '@/lib/services/voice';
import toast from 'react-hot-toast';

interface VoiceCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertText: (text: string) => void;
  onRunAI?: (operation: 'meeting_summary' | 'extract_tasks', text: string) => void;
}

export default function VoiceCaptureModal({
  isOpen,
  onClose,
  onInsertText,
  onRunAI,
}: VoiceCaptureModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const dictationService = useRef<VoiceDictationService | null>(null);
  const audioService = useRef<AudioRecordingService | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasSpeech = isSpeechRecognitionSupported();
  const hasAudio = isAudioRecordingSupported();

  useEffect(() => {
    dictationService.current = new VoiceDictationService();
    audioService.current = new AudioRecordingService();

    return () => {
      dictationService.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      handleStop();
      setTranscript('');
      setInterimText('');
      setDuration(0);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
    }
  }, [isOpen]);

  const handleStart = async () => {
    setTranscript('');
    setInterimText('');
    setDuration(0);

    // Start timer
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    // Start Audio Recorder
    if (hasAudio && audioService.current) {
      try {
        await audioService.current.start();
      } catch (err: any) {
        console.warn('Audio capture warning:', err);
      }
    }

    // Start Speech Recognition
    if (hasSpeech && dictationService.current) {
      const started = dictationService.current.start({
        continuous: true,
        interimResults: true,
        onTranscript: (text, isFinal) => {
          if (isFinal) {
            setTranscript((prev) => (prev ? `${prev} ${text}` : text));
            setInterimText('');
          } else {
            setInterimText(text);
          }
        },
        onError: (err) => {
          toast.error(err);
          handleStop();
        },
        onEnd: () => {
          setIsRecording(false);
        },
      });

      if (!started) {
        toast.error('Unable to start live speech recognition.');
      }
    } else {
      toast('Speech recognition not supported in this browser. Recording raw audio instead.');
    }

    setIsRecording(true);
  };

  const handleStop = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (dictationService.current) {
      dictationService.current.stop();
    }

    if (audioService.current && audioService.current.isRecording()) {
      try {
        const { blob } = await audioService.current.stop();
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      } catch (err) {
        console.error('Failed to stop audio recording:', err);
      }
    }

    setIsRecording(false);
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const fullText = (transcript + (interimText ? ' ' + interimText : '')).trim();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 580,
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-full)',
                backgroundColor: isRecording
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isRecording ? '#ef4444' : '#6366f1',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Voice Capture & Dictation
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                {isRecording
                  ? `Listening... (${formatDuration(duration)})`
                  : duration > 0
                  ? `Recorded ${formatDuration(duration)}`
                  : 'Speak naturally to capture notes & audio'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ borderRadius: 'var(--radius-full)', padding: 'var(--space-2)' }}
            aria-label="Close voice modal"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Live Audio Indicator */}
          <div
            style={{
              padding: 'var(--space-6)',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 140,
              textAlign: 'center',
            }}
          >
            {isRecording ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)',
                    animation: 'pulse 1.5s infinite',
                    color: '#ffffff',
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                  </svg>
                </div>
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: '#ef4444' }}>
                  Recording • {formatDuration(duration)}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                <button
                  onClick={handleStart}
                  className="btn btn-primary"
                  style={{
                    borderRadius: 'var(--radius-full)',
                    padding: 'var(--space-3) var(--space-6)',
                    fontSize: 'var(--font-size-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                  id="start-voice-recording-btn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </svg>
                  {duration > 0 ? 'Record Again' : 'Start Dictation'}
                </button>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                  Click to speak — your speech will be transcribed in real time
                </span>
              </div>
            )}
          </div>

          {/* Transcript Display */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Transcript
              </label>
              {fullText && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(fullText);
                    toast.success('Transcript copied!');
                  }}
                  className="btn btn-ghost btn-xs"
                >
                  Copy Text
                </button>
              )}
            </div>

            <textarea
              className="input"
              rows={4}
              value={fullText}
              onChange={(e) => {
                setTranscript(e.target.value);
                setInterimText('');
              }}
              placeholder={isRecording ? 'Listening for speech...' : 'Transcript will appear here...'}
              style={{
                width: '100%',
                resize: 'vertical',
                fontSize: 'var(--font-size-sm)',
                lineHeight: 1.6,
                backgroundColor: 'var(--bg-secondary)',
              }}
            />
          </div>

          {/* Audio Player if recorded */}
          {audioUrl && (
            <div style={{ marginTop: 'var(--space-1)' }}>
              <audio src={audioUrl} controls style={{ width: '100%', height: 36 }} />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            backgroundColor: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
          }}
        >
          {isRecording ? (
            <button
              onClick={handleStop}
              className="btn btn-danger btn-sm"
              style={{ width: '100%' }}
              id="stop-voice-recording-btn"
            >
              Stop Recording
            </button>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {onRunAI && fullText && (
                  <>
                    <button
                      onClick={() => {
                        onRunAI('meeting_summary', fullText);
                        onClose();
                      }}
                      className="btn btn-secondary btn-sm"
                      title="Generate meeting notes with AI"
                    >
                      Meeting Notes (AI)
                    </button>
                    <button
                      onClick={() => {
                        onRunAI('extract_tasks', fullText);
                        onClose();
                      }}
                      className="btn btn-secondary btn-sm"
                      title="Extract action items with AI"
                    >
                      Extract Tasks (AI)
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
                <button onClick={onClose} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!fullText) {
                      toast.error('No transcript to insert');
                      return;
                    }
                    onInsertText(fullText);
                    toast.success('Inserted into note!');
                    onClose();
                  }}
                  disabled={!fullText}
                  className="btn btn-primary btn-sm"
                  id="insert-transcript-btn"
                >
                  Insert into Note
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
