import { KNOWN_GRAMMAR_TERMS } from '@/constants/grammarTerms';

/** One run of text, either plain or a tagged grammar term. */
export interface TextSegment {
  text: string;
  /** The grammar term when this run is a link, `null` when it is plain prose. */
  term: string | null;
}

/**
 * `[[현재완료]]` — a term, tagged by the evaluation prompt. Brackets may not nest,
 * and a term may not be empty or span a line, so a stray `[[` in prose is left
 * alone rather than swallowing the rest of the paragraph.
 */
const TAG = /\[\[([^[\]\n]+)\]\]/g;

/**
 * Split feedback into plain runs and grammar-term runs.
 *
 * Written to never lose text: anything that is not a well-formed tag — a lone
 * bracket, an empty tag, a term running past a line break — comes back as plain
 * prose. The model is instructed to tag, but the reader must still be able to
 * read the sentence when it does not.
 */
export function parseGrammarTags(text: string): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  let cursor = 0;

  // `matchAll` restarts the regex itself, so the shared TAG stays stateless here.
  for (const match of text.matchAll(TAG)) {
    const start = match.index ?? 0;
    const term = match[1].trim();

    // A tag of only whitespace names nothing; keep it as prose.
    if (!term) continue;

    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), term: null });
    }

    segments.push({ text: term, term });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), term: null });
  }

  return segments;
}

/** Every distinct term tagged in `text`, in the order they first appear. */
export function extractGrammarTerms(text: string): string[] {
  const terms = parseGrammarTags(text)
    .filter((segment) => segment.term !== null)
    .map((segment) => segment.term as string);

  return [...new Set(terms)];
}

/**
 * Wrap each occurrence of `terms` in `text` with `[[...]]`.
 *
 * This is what actually produces the tags. The model is asked for the list of
 * terms it used — a schema-required array, which constrained decoding enforces —
 * and the markup is applied here, where it is deterministic. Asking the model to
 * embed brackets inside a string value is only a soft constraint and gets
 * dropped; asking for an array field does not.
 *
 * Text already inside a tag is never wrapped twice, and longer terms win, so
 * "가정법 과거완료" is tagged whole rather than as "가정법" plus loose words.
 */
export function applyGrammarTags(text: string, terms: string[]): string {
  if (!text || terms.length === 0) return text;

  // Regions already tagged — by the model, or by an earlier pass — are off limits.
  const claimed: [number, number][] = [];
  for (const match of text.matchAll(TAG)) {
    const start = match.index ?? 0;
    claimed.push([start, start + match[0].length]);
  }

  const overlaps = (start: number, end: number) =>
    claimed.some(([from, to]) => start < to && end > from);

  const ordered = [...new Set(terms.map((term) => term.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );

  const inserts: [number, number, string][] = [];

  for (const term of ordered) {
    let from = 0;
    for (;;) {
      const index = text.indexOf(term, from);
      if (index === -1) break;

      const end = index + term.length;
      if (!overlaps(index, end)) {
        claimed.push([index, end]);
        inserts.push([index, end, term]);
      }
      from = end;
    }
  }

  if (inserts.length === 0) return text;

  inserts.sort((a, b) => a[0] - b[0]);

  let out = '';
  let cursor = 0;
  for (const [start, end, term] of inserts) {
    out += text.slice(cursor, start) + `[[${term}]]`;
    cursor = end;
  }

  return out + text.slice(cursor);
}

/** Tag any well-known grammar term found in `text`. The last-resort fallback. */
export function autoTagKnownTerms(text: string): string {
  return applyGrammarTags(text, KNOWN_GRAMMAR_TERMS);
}

/** The text with its tags removed, for anywhere that cannot render links. */
export function stripGrammarTags(text: string): string {
  return parseGrammarTags(text)
    .map((segment) => segment.text)
    .join('');
}
