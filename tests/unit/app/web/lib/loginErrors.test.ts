import { describe, it, expect } from 'vitest';
import { loginErrorMessage } from '@app/web/lib/loginErrors.js';
import { LoginErrorCodeSchema } from '@lib/types/auth.js';

describe('loginErrorMessage', () => {
  it('has copy for every code the backend can send', () => {
    for (const code of LoginErrorCodeSchema.options) {
      expect(loginErrorMessage(code, null), code).not.toBe('');
    }
  });

  it('says nothing when there is no error', () => {
    expect(loginErrorMessage(null, null)).toBe('');
  });

  it('never echoes unknown or legacy free text', () => {
    const message = loginErrorMessage('<script>alert(1)</script>', null);
    expect(message).toBe('Sign-in failed. Please try again.');
    expect(message).not.toContain('<');
  });

  it('shows the provider word beside a provider refusal', () => {
    expect(loginErrorMessage('provider_denied', 'access_denied')).toContain('(access_denied)');
  });

  it('names the channel when one is already claimed', () => {
    expect(loginErrorMessage('channel_claimed', 'Channel A')).toBe(
      'Channel A is already linked to another account.',
    );
  });
});
