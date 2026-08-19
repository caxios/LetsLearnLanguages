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

/** The text with its tags removed, for anywhere that cannot render links. */
export function stripGrammarTags(text: string): string {
  return parseGrammarTags(text)
    .map((segment) => segment.text)
    .join('');
}
