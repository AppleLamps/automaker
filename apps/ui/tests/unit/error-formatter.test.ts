import { describe, expect, it } from 'vitest';
import { formatUserError } from '@/lib/error-formatter';

describe('formatUserError', () => {
  it('returns a string error as-is', () => {
    expect(formatUserError('Nope')).toBe('Nope');
  });

  it('strips multi-line Error messages', () => {
    const error = new Error('First line\nSecond line');
    expect(formatUserError(error)).toBe('First line');
  });

  it('uses object message when available', () => {
    const error = { message: 'Something went wrong\nDetails' };
    expect(formatUserError(error)).toBe('Something went wrong');
  });

  it('uses the provided fallback when needed', () => {
    expect(formatUserError(42, 'Fallback')).toBe('Fallback');
  });
});
