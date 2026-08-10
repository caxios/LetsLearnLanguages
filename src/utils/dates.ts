import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

/** `created_at` is stored as UTC "YYYY-MM-DD HH:MM:SS". */
export function formatAttemptDate(timestamp: string): string {
  try {
    const parsed = parseISO(timestamp.replace(' ', 'T') + 'Z');
    if (Number.isNaN(parsed.getTime())) return timestamp;
    return format(parsed, 'yyyy년 M월 d일', { locale: ko });
  } catch {
    return timestamp;
  }
}
