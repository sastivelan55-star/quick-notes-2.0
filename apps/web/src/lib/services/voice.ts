/**
 * FlowNote AI — Voice Capture & Speech Recognition Service
 *
 * Provides:
 * 1. Real-time live dictation via Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * 2. High-fidelity audio recording via MediaRecorder API (audio/webm, audio/mp4)
 * 3. Fallback and permission handling
 */

export interface VoiceDictationOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

// Check browser support for SpeechRecognition
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

// Check browser support for audio recording
export function isAudioRecordingSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

export class VoiceDictationService {
  private recognition: any = null;
  private isListening = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
      }
    }
  }

  public start(options: VoiceDictationOptions): boolean {
    if (!this.recognition) {
      options.onError('Speech recognition is not supported in this browser.');
      return false;
    }

    if (this.isListening) {
      this.stop();
    }

    try {
      this.recognition.continuous = options.continuous ?? true;
      this.recognition.interimResults = options.interimResults ?? true;
      this.recognition.lang = options.language ?? 'en-US';

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            final += item[0].transcript;
          } else {
            interim += item[0].transcript;
          }
        }

        const text = final || interim;
        if (text) {
          options.onTranscript(text.trim(), !!final);
        }
      };

      this.recognition.onerror = (event: any) => {
        let msg = 'Speech recognition error';
        if (event.error === 'not-allowed') {
          msg = 'Microphone access was denied. Please allow microphone permissions.';
        } else if (event.error === 'no-speech') {
          msg = 'No speech was detected. Please try speaking closer to the mic.';
        } else if (event.error === 'network') {
          msg = 'Network error occurred during speech recognition.';
        }
        options.onError(msg);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        options.onEnd();
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (e: any) {
      options.onError(e?.message || 'Failed to start speech recognition.');
      return false;
    }
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop error
      }
    }
    this.isListening = false;
  }

  public isActive(): boolean {
    return this.isListening;
  }
}

export class AudioRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  public async start(): Promise<boolean> {
    if (!isAudioRecordingSupported()) {
      throw new Error('Audio recording is not supported in this browser.');
    }

    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else {
        mimeType = '';
      }
    }

    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType })
      : new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250); // Emit chunk every 250ms
    return true;
  }

  public stop(): Promise<{ blob: Blob; mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('Recorder is not active'));
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });

        // Stop all tracks to turn off the microphone hardware indicator
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }

        resolve({ blob, mimeType });
      };

      this.mediaRecorder.stop();
    });
  }

  public isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}
