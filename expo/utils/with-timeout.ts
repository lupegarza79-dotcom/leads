const DEFAULT_TIMEOUT_MS = 12000;

export class MutationTimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${Math.round(ms / 1000)}s. Please try again.`);
    this.name = 'MutationTimeoutError';
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.log(`[withTimeout] Operation timed out after ${ms}ms`);
      reject(new MutationTimeoutError(ms));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}
