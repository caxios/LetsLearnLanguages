export class ApiKeyMissingError extends Error {
  constructor(service: 'openai' | 'gemini') {
    super(
      `${service === 'openai' ? 'OpenAI' : 'Gemini'} API key not configured. Please add it in Settings.`
    );
    this.name = 'ApiKeyMissingError';
  }
}

export class ApiResponseError extends Error {
  constructor(
    public service: string,
    public statusCode: number,
    message: string
  ) {
    super(`${service} API error (${statusCode}): ${message}`);
    this.name = 'ApiResponseError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(`Response validation failed: ${message}`);
    this.name = 'ValidationError';
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on validation or API key errors
      if (error instanceof ValidationError || error instanceof ApiKeyMissingError) {
        throw error;
      }

      // A 4xx other than 429 will fail the same way every time.
      if (error instanceof ApiResponseError && error.statusCode !== 429) {
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
