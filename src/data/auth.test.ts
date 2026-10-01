import { describe, expect, it, vi } from 'vitest';
import { createAuthActions, readAuthCallback, readableAuthError } from './auth';

function fixture() {
  const auth = {
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    resend: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'account-a' } } }, error: null }),
  };
  const actions = createAuthActions(auth as unknown as Parameters<typeof createAuthActions>[0], () => 'https://tutor.example');
  return { auth, actions };
}

describe('Account authentication', () => {
  it('uses display metadata without granting ownership, and waits for email confirmation', async () => {
    const { auth, actions } = fixture();
    expect(await actions.signUp('  Minh  ', ' minh@example.com ', 'strong-password')).toEqual({ requiresConfirmation: true });
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'minh@example.com', password: 'strong-password', options: { data: { display_name: 'Minh' }, emailRedirectTo: 'https://tutor.example/' } });
  });
  it('allows immediate sign-in when confirmation is disabled', async () => {
    const { auth, actions } = fixture();
    auth.signUp.mockResolvedValueOnce({ data: { session: { user: { id: 'account-a' } } }, error: null });
    expect(await actions.signUp('Minh', 'minh@example.com', 'strong-password')).toEqual({ requiresConfirmation: false });
  });
  it('uses the deployed origin and recovery page for email actions', async () => {
    const { auth, actions } = fixture();
    await actions.requestPasswordReset(' minh@example.com ');
    await actions.resendConfirmation(' minh@example.com ');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('minh@example.com', { redirectTo: 'https://tutor.example/reset-password' });
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'minh@example.com', options: { emailRedirectTo: 'https://tutor.example/' } });
  });
  it('does not submit password changes without an authenticated session', async () => {
    const { auth, actions } = fixture();
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(actions.resetPassword('new-password')).rejects.toThrow('hết hạn');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it('checks new password strength before making a request', async () => {
    const { auth, actions } = fixture();
    await expect(actions.signUp('Minh', 'minh@example.com', '123')).rejects.toThrow('8 ký tự');
    await expect(actions.resetPassword('123')).rejects.toThrow('8 ký tự');
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
    await actions.resetPassword('new-password');
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
  });
  it('preserves and translates errors from expired email links', () => {
    expect(readAuthCallback('https://tutor.example/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid')).toEqual({ recovery: true, error: 'Liên kết đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu một email mới.' });
    expect(readAuthCallback('https://tutor.example/#type=recovery&access_token=example')).toEqual({ recovery: true, error: '' });
    expect(readAuthCallback('https://tutor.example/')).toEqual({ recovery: false, error: '' });
  });
  it('gives useful signup, confirmation and email delivery errors', async () => {
    const { auth, actions } = fixture();
    auth.signInWithPassword.mockResolvedValueOnce({ error: { code: 'email_not_confirmed' } });
    await expect(actions.signIn('minh@example.com', 'strong-password')).rejects.toThrow('xác nhận email');
    expect(readableAuthError({ code: 'signup_disabled' })).toContain('chưa mở đăng ký');
    expect(readableAuthError({ code: 'email_address_not_authorized' })).toContain('chưa thể gửi email');
    expect(readableAuthError({ code: 'over_email_send_rate_limit' })).toContain('chờ');
  });
});
