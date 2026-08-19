import { GoogleGenerativeAI, SchemaType, type GenerativeModel, type Schema } from '@google/generative-ai';

import { GRAMMAR_TEACHER_SYSTEM_PROMPT } from '@/constants/prompts';
import { GEMINI_MODEL, generateJson, requireGeminiApiKey } from '@/services/gemini';
import { grammarExplanationSchema, type GrammarExplanation } from '@/types/grammar';
import { ValidationError, withRetry } from '@/utils/errors';

const grammarSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: {
      type: SchemaType.STRING,
      description: 'One plain sentence in Korean describing what the structure does',
    },
    when_to_use: {
      type: SchemaType.STRING,
      description: 'When a learner should reach for this structure, in Korean',
    },
    examples: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          english: { type: SchemaType.STRING, description: 'A natural English sentence' },
          korean: { type: SchemaType.STRING, description: 'Its Korean meaning' },
          note: {
            type: SchemaType.STRING,
            description: 'What the structure is doing in this sentence, in Korean',
          },
        },
        required: ['english', 'korean', 'note'],
      },
    },
    nuance: {
      type: SchemaType.STRING,
      description: 'The subtle difference in feeling or emphasis, in Korean',
    },
    common_mistakes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          wrong: { type: SchemaType.STRING, description: 'The incorrect form' },
          right: { type: SchemaType.STRING, description: 'The corrected form' },
          why: { type: SchemaType.STRING, description: 'Why, in Korean' },
        },
        required: ['wrong', 'right', 'why'],
      },
    },
  },
  required: ['summary', 'when_to_use', 'examples', 'nuance', 'common_mistakes'],
};

// Cached per API key so a key change in Settings takes effect, matching gemini.ts.
let _model: GenerativeModel | null = null;
let _modelApiKey: string | null = null;

function getModel(): GenerativeModel {
  const apiKey = requireGeminiApiKey();

  if (_model && _modelApiKey === apiKey) return _model;

  const genAI = new GoogleGenerativeAI(apiKey);
  _model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: grammarSchema,
      // Low: the same grammar point should be explained the same way twice.
      temperature: 0.3,
    },
    systemInstruction: GRAMMAR_TEACHER_SYSTEM_PROMPT,
  });
  _modelApiKey = apiKey;

  return _model;
}

/**
 * A full explanation of one grammar term, for the Grammar Teacher sheet.
 *
 * `context` is the sentence the term was tagged in, when there is one — the same
 * term is worth explaining differently depending on what the learner was just
 * looking at.
 */
export async function explainGrammarTerm(
  term: string,
  context?: string
): Promise<GrammarExplanation> {
  const model = getModel();

  const prompt = [
    `문법 용어: ${term}`,
    context ? `\n학습자가 방금 본 문장/설명: "${context}"` : '',
    `\n"${term}"에 대해 설명해 주세요.`,
  ]
    .filter(Boolean)
    .join('\n');

  return withRetry(async () => {
    const jsonResponse = await generateJson(model, prompt);

    const parsed = grammarExplanationSchema.safeParse(jsonResponse);
    if (!parsed.success) {
      throw new ValidationError(
        `Gemini grammar explanation — ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
          .join(', ')}`
      );
    }

    return parsed.data;
  });
}
