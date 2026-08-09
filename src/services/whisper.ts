import { useSettingsStore } from '@/stores/useSettingsStore';

const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

/** OpenAI rejects uploads above 25MB. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

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

  let response: Response;
  try {
    response = await fetch(WHISPER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Do NOT set Content-Type — fetch will set it with the correct boundary
      },
      body: formData,
    });
  } catch {
    throw new Error('Unable to connect. Please check your internet connection.');
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
