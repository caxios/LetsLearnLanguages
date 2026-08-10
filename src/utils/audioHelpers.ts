import { File } from 'expo-file-system';

// Format duration in seconds to mm:ss
export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Get file size in a human-readable format
export async function getFileSize(uri: string): Promise<string> {
  const file = new File(uri);
  if (!file.exists) return '0 B';

  const bytes = file.size || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Get the raw byte count, or 0 when the file is missing
export async function getFileBytes(uri: string): Promise<number> {
  const file = new File(uri);
  return file.exists ? file.size || 0 : 0;
}

/**
 * Existence and size in one look, so an upload can tell "no recording" apart
 * from "empty recording". A URI the platform can't stat reads as missing.
 */
export async function getAudioFileInfo(uri: string): Promise<{ exists: boolean; size: number }> {
  try {
    const file = new File(uri);
    return { exists: file.exists, size: file.exists ? file.size || 0 : 0 };
  } catch {
    return { exists: false, size: 0 };
  }
}

// Clean up a recorded audio file
export async function deleteAudioFile(uri: string): Promise<void> {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}
