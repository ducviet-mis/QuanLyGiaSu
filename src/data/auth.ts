import type { SupabaseClient } from '@supabase/supabase-js';

type AuthClient = Pick<SupabaseClient['auth'], 'signInWithPassword' | 'signUp' | 'resetPasswordForEmail' | 'updateUser' | 'resend' | 'getSession'>;

export function readableAuthError(value: unknown): string {
  const problem = value as { code?: string; message?: string } | null;
  const message = problem?.message || 'Không thể thực hiện yêu cầu. Vui lòng thử lại.';
  const code = problem?.code || '';
  if (code === 'invalid_credentials' || message.includes('Invalid login credentials')) return 'Email hoặc mật khẩu chưa đúng.';
  if (code === 'email_not_confirmed' || message.includes('Email not confirmed')) return 'Bạn cần xác nhận email trước khi đăng nhập. Kiểm tra hộp thư hoặc gửi lại email xác nhận.';
  if (code === 'signup_disabled' || message.includes('Signups not allowed')) return 'Ứng dụng chưa mở đăng ký. Liên hệ người quản lý ứng dụng.';
  if (['user_already_exists', 'email_exists'].includes(code) || message.includes('User already registered')) return 'Email này đã có tài khoản. Hãy đăng nhập hoặc chọn Quên mật khẩu.';
  if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(code) || message.toLowerCase().includes('rate limit')) return 'Bạn đã gửi nhiều yêu cầu. Vui lòng chờ một lúc rồi thử lại.';
  if (code === 'email_address_not_authorized' || message.includes('Email address not authorized')) return 'Ứng dụng chưa thể gửi email tới địa chỉ này. Liên hệ người quản lý ứng dụng để được hỗ trợ.';
  if (code === 'weak_password') return 'Mật khẩu chưa đáp ứng yêu cầu. Hãy dùng ít nhất 8 ký tự và kết hợp chữ, số, ký hiệu.';
  if (code === 'same_password') return 'Mật khẩu mới cần khác mật khẩu hiện tại.';
  if (['otp_expired', 'flow_state_expired', 'bad_code_verifier'].includes(code)) return 'Liên kết đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu một email mới.';
  if (code === 'session_not_found' || message.includes('Auth session missing')) return 'Phiên đặt lại mật khẩu đã hết hạn. Hãy yêu cầu một email mới.';
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  return message;
}

/** Read callback errors before the Auth SDK removes tokens from the URL. */
export function readAuthCallback(href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const parameter = (name: string) => hash.get(name) || url.searchParams.get(name);
  const code = parameter('error_code');
  const error = parameter('error');
  return {
    recovery: url.pathname.replace(/\/$/, '') === '/reset-password' || parameter('type') === 'recovery',
    error: code || error ? readableAuthError({ code: code || '', message: parameter('error_description') || 'Liên kết không hợp lệ. Hãy yêu cầu một email mới.' }) : '',
  };
}

export function createAuthActions(auth: AuthClient | null, origin: () => string) {
  const client = () => {
    if (!auth) throw new Error('Chưa cấu hình kết nối Supabase.');
    return auth;
  };
  const passwordRule = (password: string) => {
    if (password.length < 8) throw new Error('Mật khẩu cần ít nhất 8 ký tự.');
  };
  return {
    async signIn(email: string, password: string) {
      const { error } = await client().signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(readableAuthError(error));
    },
    async signUp(name: string, email: string, password: string) {
      passwordRule(password);
      if (!name.trim() || name.trim().length > 100) throw new Error('Tên cần từ 1 đến 100 ký tự.');
      const { data, error } = await client().signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() }, emailRedirectTo: `${origin()}/` } });
      if (error) throw new Error(readableAuthError(error));
      return { requiresConfirmation: !data.session };
    },
    async requestPasswordReset(email: string) {
      const { error } = await client().resetPasswordForEmail(email.trim(), { redirectTo: `${origin()}/reset-password` });
      if (error) throw new Error(readableAuthError(error));
    },
    async resetPassword(password: string) {
      passwordRule(password);
      const active = client();
      const { data, error } = await active.getSession();
      if (error) throw new Error(readableAuthError(error));
      if (!data.session) throw new Error('Phiên đặt lại mật khẩu đã hết hạn. Hãy yêu cầu một email mới.');
      const result = await active.updateUser({ password });
      if (result.error) throw new Error(readableAuthError(result.error));
    },
    async resendConfirmation(email: string) {
      const { error } = await client().resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: `${origin()}/` } });
      if (error) throw new Error(readableAuthError(error));
    },
  };
}
