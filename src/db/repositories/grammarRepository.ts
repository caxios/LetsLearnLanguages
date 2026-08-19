import { desc, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { grammarNotes } from '@/db/schema';
import type { GrammarExplanation } from '@/types/grammar';

export interface StoredGrammarNote {
  id: number;
  term: string;
  summary: string;
  detail: GrammarExplanation | null;
  createdAt: string;
}

/** A note written before a schema change should read as summary-only, not crash. */
function parseDetail(json: string): GrammarExplanation | null {
  try {
    return JSON.parse(json) as GrammarExplanation;
  } catch {
    return null;
  }
}

export const grammarRepository = {
  /** Every saved note, newest first. */
  async list(): Promise<StoredGrammarNote[]> {
    const rows = await db.select().from(grammarNotes).orderBy(desc(grammarNotes.createdAt));

    return rows.map((row) => ({
      id: row.id,
      term: row.term,
      summary: row.summary,
      detail: parseDetail(row.detailJson),
      createdAt: row.createdAt,
    }));
  },

  async getByTerm(term: string): Promise<StoredGrammarNote | null> {
    const rows = await db.select().from(grammarNotes).where(eq(grammarNotes.term, term)).limit(1);
    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      term: row.term,
      summary: row.summary,
      detail: parseDetail(row.detailJson),
      createdAt: row.createdAt,
    };
  },

  /**
   * Save, or refresh an existing note for the same term. `term` is unique, so
   * saving the same point twice keeps one note with the newer explanation
   * instead of stacking near-duplicates in the review list.
   */
  async save(term: string, explanation: GrammarExplanation) {
    return db
      .insert(grammarNotes)
      .values({
        term,
        summary: explanation.summary,
        detailJson: JSON.stringify(explanation),
      })
      .onConflictDoUpdate({
        target: grammarNotes.term,
        set: {
          summary: explanation.summary,
          detailJson: JSON.stringify(explanation),
        },
      });
  },

  async deleteByTerm(term: string) {
    return db.delete(grammarNotes).where(eq(grammarNotes.term, term));
  },

  async deleteById(id: number) {
    return db.delete(grammarNotes).where(eq(grammarNotes.id, id));
  },
};
