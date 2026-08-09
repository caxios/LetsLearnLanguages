# Phase 3: Input & STT Interface

> **Goal**: Implement voice recording with `expo-audio`, integrate OpenAI Whisper API for speech-to-text, and build the text input interface.
> **Estimated Effort**: 1 day
> **Depends On**: Phase 2 (stores and hooks ready)
> **Verification**: User can record voice → transcription appears in text field. User can type text directly. Both methods submit correctly.

---

## Step 3.1 — Audio Helpers

**`src/utils/audioHelpers.ts`**

Utility functions for audio file handling:

```typescript
import * as FileSystem from 'expo-file-system';

// Format duration in seconds to mm:ss
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Get file size in a human-readable format
export async function getFileSize(uri: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) return '0 B';
  const bytes = info.size || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Clean up a recorded audio file
export async function deleteAudioFile(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri);
  }
}
```

---

## Step 3.2 — Voice Recorder Component

**`src/components/input/VoiceRecorder.tsx`**

### Implementation Details

1. **Permissions**: Request microphone access on first use
2. **Recording**: Use `expo-audio`'s `useAudioRecorder` hook (SDK 53+)
3. **Visual Feedback**: Pulsing microphone animation + elapsed timer
4. **Output**: Save audio URI to `useRecordingStore`, trigger Whisper transcription

### Key API (expo-audio SDK 53+)

```typescript
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';

// Request permissions
const status = await AudioModule.requestRecordingPermissionsAsync();

// Create recorder
const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

// Start recording
recorder.record();

// Stop recording
await recorder.stop();
const uri = recorder.uri; // File URI of the recorded audio
```

### Component Structure

```typescript
export function VoiceRecorder() {
  // State from Zustand
  const { isRecording, audioUri, startRecording, stopRecording, resetRecording } = useRecordingStore();
  
  // Whisper transcription mutation
  const transcription = useTranscription();

  // Recording logic
  const handleStartRecording = async () => {
    // 1. Request permissions if needed
    // 2. Start recording
    // 3. Update store: startRecording()
  };

  const handleStopRecording = async () => {
    // 1. Stop recording
    // 2. Get audio URI
    // 3. Update store: stopRecording(uri, duration)
    // 4. Auto-trigger transcription: transcription.mutate(uri)
  };

  return (
    // Large microphone button (tap to toggle recording)
    // Recording indicator (pulsing animation when recording)
    // Elapsed time display
    // Transcription status (loading / error / success)
    // Re-record button (when audio exists)
  );
}
```

### Animation Details

- **Recording pulse**: Use `Animated.loop` with `Animated.sequence` to create a pulsing red circle behind the mic icon
- **Timer**: Update every second using `setInterval` while recording
- **Mic icon states**:
  - Idle: Gray mic icon
  - Recording: Red pulsing mic icon
  - Processing: Spinning/loading indicator
  - Done: Green checkmark with transcribed text preview

---

## Step 3.3 — Whisper STT Service

**`src/services/whisper.ts`**

```typescript
import * as FileSystem from 'expo-file-system';
import { useSettingsStore } from '@/stores/useSettingsStore';

const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

export async function transcribe(audioUri: string): Promise<string> {
  const apiKey = useSettingsStore.getState().openaiApiKey;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add it in Settings.');
  }

  // Build FormData for multipart upload
  const formData = new FormData();
  
  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'recording.m4a',
  } as any);
  
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'json');

  const response = await fetch(WHISPER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      // Do NOT set Content-Type — fetch will set it with the correct boundary
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Whisper API error (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  
  if (!result.text || typeof result.text !== 'string') {
    throw new Error('Invalid response from Whisper API: missing text field');
  }

  return result.text.trim();
}
```

### Error Handling

| Error Case | User-Facing Message |
|---|---|
| No API key | "OpenAI API key not configured. Please add it in Settings." |
| Network error | "Unable to connect. Please check your internet connection." |
| 401 Unauthorized | "Invalid API key. Please check your OpenAI API key in Settings." |
| 413 File too large | "Recording is too long. Please keep recordings under 25MB." |
| 429 Rate limited | "Too many requests. Please wait a moment and try again." |
| Empty transcription | "Could not detect any speech. Please try recording again." |

---

## Step 3.4 — Text Input Field Component

**`src/components/input/TextInputField.tsx`**

A styled multi-line text input for typing English translations directly.

### Features
- Multi-line `TextInput` with auto-growing height
- Character count display (bottom-right corner)
- Clear button (X icon, top-right)
- Placeholder: "Type your English translation here..."
- Auto-focus when text input mode is selected
- Submit on keyboard "Done" action

```typescript
interface TextInputFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
}

export function TextInputField({
  value,
  onChangeText,
  placeholder = "Type your English translation here...",
  maxLength = 500,
  autoFocus = false,
}: TextInputFieldProps) {
  return (
    // Container with rounded border
    //   TextInput (multiline, auto-height)
    //   Bottom bar:
    //     Character count: "{value.length}/{maxLength}"
    //     Clear button (visible when text exists)
  );
}
```

---

## Step 3.5 — Input Method Toggle

**`src/components/input/InputMethodToggle.tsx`**

A toggle switch to switch between Voice and Text input modes.

### Features
- Two-option segmented control: 🎤 Voice | ⌨️ Text
- Active option highlighted with primary color
- Animated sliding indicator
- Persists preference via `useSettingsStore`

```typescript
interface InputMethodToggleProps {
  value: 'voice' | 'text';
  onChange: (method: 'voice' | 'text') => void;
}

export function InputMethodToggle({ value, onChange }: InputMethodToggleProps) {
  return (
    // Segmented control container
    //   Option 1: 🎤 Voice (highlighted if active)
    //   Option 2: ⌨️ Text (highlighted if active)
    //   Animated sliding background indicator
  );
}
```

---

## Step 3.6 — Korean Sentence Input

**`src/components/input/KoreanInput.tsx`**

For the Free Input screen, users need to type the Korean sentence they want to translate.

```typescript
interface KoreanInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

export function KoreanInput({ value, onChangeText }: KoreanInputProps) {
  return (
    // Label: "번역할 한국어 문장"
    // TextInput (single or multi-line)
    // Helper text: "영어로 번역하고 싶은 한국어 문장을 입력하세요"
  );
}
```

---

## Component Interaction Flow

```
┌──────────────────────────────────────┐
│          Free Input Screen           │
│                                      │
│  ┌──────────────────────────────┐    │
│  │     KoreanInput              │    │
│  │  "오늘 날씨가 좋다"           │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  InputMethodToggle           │    │
│  │  [🎤 Voice] [⌨️ Text]       │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  VoiceRecorder               │    │
│  │  (or TextInputField)         │    │
│  │                              │    │
│  │      ┌────────┐              │    │
│  │      │  🎤    │ ← tap       │    │
│  │      │ Record │              │    │
│  │      └────────┘              │    │
│  │      00:03 recording...      │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [   Submit for Evaluation  ]│    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

---

## Verification Checklist

- [ ] Microphone permission dialog appears on first recording attempt
- [ ] Voice recording starts and stops cleanly
- [ ] Audio file is saved and accessible via URI
- [ ] Whisper API returns transcribed text successfully
- [ ] Transcribed text auto-fills the English input field
- [ ] Text input mode works with multi-line text
- [ ] Input method toggle switches between Voice and Text smoothly
- [ ] Error states display user-friendly messages (no API key, network error, etc.)
- [ ] Character count updates in real-time
- [ ] Recording timer displays correct elapsed time

---

## Next Phase

Once all checks pass → proceed to **[Phase 4: AI Evaluation & Coaching Engine](./PHASE_4_AI_ENGINE.md)**
