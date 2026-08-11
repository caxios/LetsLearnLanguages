import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { useSettingsStore } from '@/stores/useSettingsStore';
import { getAudioFileInfo } from '@/utils/audioHelpers';

const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

/** OpenAI rejects uploads above 25MB. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Uploads have no timeout of their own in React Native, so give them one. */
export const DEFAULT_TIMEOUT_MS = 60_000;

/** Containers Whisper accepts, mapped from the recorder's file extension. */
const MIME_BY_EXTENSION: Record<string, string> = {
  m4a: 'audio/m4a',
  mp4: 'audio/mp4',
  mp3: 'audio/mpeg',
  mpga: 'audio/mpeg',
  wav: 'audio/wav',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  flac: 'audio/flac',
};

function messageForStatus(status: number, body: string): string {
  switch (status) {
    case 401:
      return 'Invalid API key. Please check your OpenAI API key in Settings.';
    case 413:
      return 'Recording is too long. Please keep recordings under 25MB.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    default:
      return `Whisper API error (${status}): ${body}`;
  }
}

/** `file:///.../Audio/recording-1730.m4a?x=1` → `recording-1730.m4a`. */
export function fileNameFor(audioUri: string): string {
  const path = audioUri.split('?')[0].split('#')[0];
  const name = path.split('/').pop() ?? '';
  return name.includes('.') ? name : 'recording.m4a';
}

export function mimeTypeFor(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'audio/m4a';
}

/**
 * Expo SDK 54+ ships a WinterCG `fetch`, and its multipart encoder only accepts
 * strings and Blob-likes — the classic React Native `{uri, type, name}` part is
 * rejected with "Unsupported FormDataPart implementation". `File` from
 * expo-file-system implements Blob, so it uploads without reading the whole
 * recording into JS memory first. On web the URI is a blob: URL, not a file.
 */
async function appendRecording(formData: FormData, audioUri: string) {
  const name = fileNameFor(audioUri);

  if (Platform.OS === 'web') {
    const blob = await (await fetch(audioUri)).blob();
    // A recorder blob usually carries its own type; fall back to the extension.
    const typed = blob.type ? blob : new Blob([blob], { type: mimeTypeFor(name) });
    formData.append('file', typed, name);
    return;
  }

  formData.append('file', new File(audioUri) as unknown as Blob);
}

/**
 * Fail on the recording itself before blaming the network. A missing or empty
 * take makes the upload throw exactly like an offline device would.
 */
async function assertUploadable(audioUri: string) {
  if (Platform.OS === 'web') return; // blob: URLs aren't files on disk

  const { exists, size } = await getAudioFileInfo(audioUri);

  if (!exists) {
    throw new Error('The recording could not be found. Please record again.');
  }

  if (size === 0) {
    throw new Error('The recording is empty. Please record again and speak clearly.');
  }

  if (size > MAX_AUDIO_BYTES) {
    throw new Error('Recording is too long. Please keep recordings under 25MB.');
  }
}

export async function transcribe(
  audioUri: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {}
): Promise<string> {
  const apiKey = useSettingsStore.getState().openaiApiKey;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add it in Settings.');
  }

  await assertUploadable(audioUri);

  const formData = new FormData();
  await appendRecording(formData, audioUri);

  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(WHISPER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Do NOT set Content-Type — fetch will set it with the correct boundary
      },
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Transcription timed out. Please try again on a stronger connection.');
    }

    // Keep the underlying reason: not every upload failure is a dead network.
    const detail = error instanceof Error ? error.message : String(error);
    console.warn('[whisper] upload failed', { audioUri, platform: Platform.OS, detail });
    throw new Error(`Unable to reach the transcription service (${detail}).`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(messageForStatus(response.status, errorBody));
  }

  const result = await response.json();

  if (!result?.text || typeof result.text !== 'string') {
    throw new Error('Invalid response from Whisper API: missing text field');
  }

  const text = result.text.trim();

  if (!text) {
    throw new Error('Could not detect any speech. Please try recording again.');
  }

  return text;
}
