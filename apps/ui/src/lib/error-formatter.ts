const DEFAULT_FALLBACK = 'An unexpected error occurred';

export function formatUserError(error: unknown, fallback: string = DEFAULT_FALLBACK): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message.split('\n')[0] || fallback;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.split('\n')[0];
    }
  }

  return fallback;
}
