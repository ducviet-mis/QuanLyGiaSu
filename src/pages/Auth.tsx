import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, BookOpen, Check, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui';

export type AuthPageProps = {
  mode: 'login' | 'recovery';
  initialError?: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ requiresConfirmation: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (password: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  onExitRecovery: () => Promise<void>;
};

type View = 'login' | 'signup' | 'forgot' | 'confirmation';
type FormField = 'name' | 'email' | 'password' | 'confirmation';
type FieldErrors = Partial<Record<FormField, string>>;

function PasswordField({ id, label, value, onChange, autoComplete, error, hint, disabled }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  error?: string;
  hint?: string;
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <div className="field auth-field">
    <label htmlFor={id}>{label}</label>
    <div className="auth-password">
      <input id={id} name={id === 'auth-confirmation' ? 'password-confirmation' : 'password'} type={visible ? 'text' : 'password'} autoComplete={autoComplete} required value={value} disabled={disabled} onChange={event => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={[hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined} />
      <button type="button" className="auth-password-toggle" disabled={disabled} onClick={() => setVisible(!visible)} aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLocaleLowerCase('vi-VN')}`} aria-pressed={visible}>{visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button>
    </div>
    {hint && <small id={`${id}-hint`}>{hint}</small>}
    {error && <small className="field-error" role="alert" id={`${id}-error`}>{error}</small>}
  </div>;
}

export default function AuthPage({ mode, initialError, signIn, signUp, requestPasswordReset, resetPassword, resendConfirmation, onExitRecovery }: AuthPageProps) {
  const [view, setView] = useState<View>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [confirmationResent, setConfirmationResent] = useState(false);
  const [showLoginResend, setShowLoginResend] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const initialView = useRef(true);
  const recovery = mode === 'recovery';
  const normalizedEmail = email.trim();

  useEffect(() => {
    setPassword('');
    setConfirmation('');
    setFieldErrors({});
    setError(initialError || '');
    setPasswordUpdated(false);
  }, [mode, initialError]);

  useEffect(() => {
    if (initialView.current) { initialView.current = false; return; }
    headingRef.current?.focus();
  }, [view, recovery, resetEmailSent, passwordUpdated]);

  const navigate = (next: View) => {
    setView(next);
    setError('');
    setFieldErrors({});
    setPassword('');
    setConfirmation('');
    setResetEmailSent(false);
    setConfirmationResent(false);
    setShowLoginResend(false);
  };

  const clearFieldError = (field: FormField) => setFieldErrors(current => ({ ...current, [field]: undefined }));
  const showError = (err: unknown) => {
    const message = err instanceof Error ? err.message : 'Chưa thực hiện được. Vui lòng thử lại.';
    setError(message);
    if (view === 'login' && /xác nhận email|email not confirmed|email_not_confirmed/i.test(message)) setShowLoginResend(true);
  };

  const validate = () => {
    const next: FieldErrors = {};
    if (!recovery) {
      if (!normalizedEmail) next.email = 'Nhập địa chỉ email của bạn.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) next.email = 'Nhập địa chỉ email hợp lệ, ví dụ ban@example.com.';
    }
    if (!recovery && view === 'signup' && !name.trim()) next.name = 'Nhập tên hiển thị của bạn.';
    if (recovery || view === 'signup') {
      if (password.length < 8) next.password = 'Mật khẩu cần có ít nhất 8 ký tự.';
      if (!confirmation) next.confirmation = 'Nhập lại mật khẩu để xác nhận.';
      else if (confirmation !== password) next.confirmation = 'Hai mật khẩu chưa khớp. Vui lòng kiểm tra lại.';
    } else if (view === 'login' && !password) next.password = 'Nhập mật khẩu của bạn.';
    setFieldErrors(next);
    if (Object.keys(next).length) {
      const first = (['name', 'email', 'password', 'confirmation'] as FormField[]).find(field => next[field]);
      document.getElementById(`auth-${first}`)?.focus();
      return false;
    }
    return true;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    setError('');
    setShowLoginResend(false);
    setConfirmationResent(false);
    try {
      if (recovery) {
        await resetPassword(password);
        setPasswordUpdated(true);
        setPassword('');
        setConfirmation('');
      } else if (view === 'signup') {
        const result = await signUp(name.trim(), normalizedEmail, password);
        if (result.requiresConfirmation) navigate('confirmation');
      } else if (view === 'forgot') {
        await requestPasswordReset(normalizedEmail);
        setResetEmailSent(true);
      } else {
        await signIn(normalizedEmail, password);
      }
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    if (busy) return;
    setBusy(true);
    setResending(true);
    setError('');
    setConfirmationResent(false);
    try { await resendConfirmation(normalizedEmail); setConfirmationResent(true); }
    catch (err) { showError(err); }
    finally { setBusy(false); setResending(false); }
  };

  const exitRecovery = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await onExitRecovery(); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const title = recovery ? passwordUpdated ? 'Mật khẩu đã được cập nhật' : 'Đặt mật khẩu mới' : view === 'signup' ? 'Tạo không gian của bạn' : view === 'forgot' ? resetEmailSent ? 'Kiểm tra hộp thư của bạn' : 'Quên mật khẩu?' : view === 'confirmation' ? 'Xác nhận email của bạn' : 'Chào mừng trở lại';
  const description = recovery ? passwordUpdated ? 'Đăng nhập lại bằng mật khẩu mới để tiếp tục.' : 'Chọn mật khẩu mới cho tài khoản TutorSpace của bạn.' : view === 'signup' ? 'Mỗi tài khoản có học sinh, lịch dạy và học phí riêng.' : view === 'forgot' ? resetEmailSent ? 'Nếu email này đã đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu.' : 'Nhập email đã đăng ký. Chúng tôi sẽ gửi liên kết để bạn đặt lại mật khẩu.' : view === 'confirmation' ? 'Mở email xác nhận để hoàn tất đăng ký TutorSpace.' : 'Đăng nhập để tiếp tục công việc dạy học của bạn.';
  const emailOnly = !recovery && view === 'forgot';
  const notice = (!recovery && (view === 'confirmation' || (view === 'forgot' && resetEmailSent))) || (recovery && passwordUpdated);

  return <main className="login-page auth-page">
    <aside className="login-story auth-story" aria-label="TutorSpace">
      <a className="brand" href="/"><span className="brand-icon"><BookOpen size={24} aria-hidden="true" /></span>TutorSpace<span className="brand-dot">.</span></a>
      <div className="auth-story-copy"><span className="eyebrow">KHÔNG GIAN GIA SƯ CÁ NHÂN</span><h2>Dành tâm huyết<br />cho việc dạy học.</h2><p>Lịch dạy, học sinh và học phí.<br />Mọi thứ ở cùng một nơi.</p><div className="auth-story-note"><ShieldCheck size={21} aria-hidden="true" /><span><strong>Một tài khoản. Một không gian riêng.</strong><small>Dữ liệu của bạn được quản lý riêng với các tài khoản khác.</small></span></div></div>
      <div className="login-footer">TutorSpace · Một không gian, mọi việc dạy học.</div>
    </aside>
    <div className="login-form-wrap auth-form-wrap">
      <section className="login-form auth-form" aria-labelledby="auth-title">
        <div className={`login-logo ${notice ? 'auth-notice-icon' : ''}`}>{recovery ? passwordUpdated ? <Check size={28} aria-hidden="true" /> : <KeyRound size={26} aria-hidden="true" /> : view === 'confirmation' || view === 'forgot' ? <Mail size={27} aria-hidden="true" /> : <BookOpen size={28} aria-hidden="true" />}</div>
        <header className="auth-heading"><h1 id="auth-title" ref={headingRef} tabIndex={-1}>{title}</h1><p>{description}</p></header>
        {!recovery && (view === 'login' || view === 'signup') && <nav className="auth-switch" aria-label="Tài khoản"><button type="button" disabled={busy} aria-pressed={view === 'login'} onClick={() => navigate('login')}>Đăng nhập</button><button type="button" disabled={busy} aria-pressed={view === 'signup'} onClick={() => navigate('signup')}>Tạo tài khoản</button></nav>}
        {notice ? <>
          {!recovery && <div className="auth-email-notice"><Mail size={18} aria-hidden="true" /><strong>{normalizedEmail}</strong></div>}
          {!recovery && <p className="auth-notice-help">Kiểm tra cả thư mục Spam. Mở liên kết trong email để {view === 'confirmation' ? 'xác nhận tài khoản' : 'đặt mật khẩu mới'}.</p>}
          {error && <div className="error-box" role="alert">{error}</div>}
          {confirmationResent && <div className="auth-success" role="status"><Check size={18} aria-hidden="true" /><span>Yêu cầu gửi lại email đã được tiếp nhận. Vui lòng kiểm tra hộp thư.</span></div>}
          {!recovery && view === 'confirmation' && <Button variant="primary" loading={busy} onClick={() => void resend()}>{busy ? 'Đang gửi…' : 'Gửi lại email xác nhận'}</Button>}
          {recovery ? <Button variant="primary" loading={busy} onClick={() => void exitRecovery()}>Quay lại đăng nhập</Button> : <Button variant={view === 'confirmation' ? 'secondary' : 'primary'} disabled={busy} onClick={() => navigate('login')}><ArrowLeft size={17} aria-hidden="true" /> Quay lại đăng nhập</Button>}
          {!recovery && view === 'forgot' && <button type="button" className="auth-text-action" disabled={busy} onClick={() => navigate('forgot')}>Nhập lại địa chỉ email</button>}
        </> : <form className="auth-fields" noValidate onSubmit={event => void submit(event)} aria-busy={busy}>
          {!recovery && view === 'signup' && <div className="field auth-field"><label htmlFor="auth-name">Tên hiển thị</label><input id="auth-name" name="name" autoComplete="name" maxLength={80} required value={name} disabled={busy} onChange={event => { setName(event.target.value); clearFieldError('name'); }} placeholder="Tên của bạn" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'auth-name-error' : undefined} />{fieldErrors.name && <small className="field-error" role="alert" id="auth-name-error">{fieldErrors.name}</small>}</div>}
          {!recovery && <div className="field auth-field"><label htmlFor="auth-email">Email</label><input id="auth-email" name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} disabled={busy} onChange={event => { setEmail(event.target.value); clearFieldError('email'); setShowLoginResend(false); setConfirmationResent(false); }} placeholder="ban@example.com" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined} />{fieldErrors.email && <small className="field-error" role="alert" id="auth-email-error">{fieldErrors.email}</small>}</div>}
          {!emailOnly && <PasswordField id="auth-password" label={recovery ? 'Mật khẩu mới' : 'Mật khẩu'} value={password} disabled={busy} onChange={value => { setPassword(value); clearFieldError('password'); }} autoComplete={recovery || view === 'signup' ? 'new-password' : 'current-password'} hint={recovery || view === 'signup' ? 'Ít nhất 8 ký tự. Bạn có thể dùng trình quản lý mật khẩu.' : undefined} error={fieldErrors.password} />}
          {(recovery || view === 'signup') && <PasswordField id="auth-confirmation" label="Xác nhận mật khẩu" value={confirmation} disabled={busy} onChange={value => { setConfirmation(value); clearFieldError('confirmation'); }} autoComplete="new-password" error={fieldErrors.confirmation} />}
          {!recovery && view === 'login' && <button type="button" className="auth-text-action auth-forgot" disabled={busy} onClick={() => navigate('forgot')}>Quên mật khẩu?</button>}
          {error && <div className="error-box" role="alert">{error}</div>}
          {!recovery && view === 'login' && showLoginResend && <Button type="button" loading={resending} disabled={busy} onClick={() => void resend()}>{resending ? 'Đang gửi…' : 'Gửi lại email xác nhận'}</Button>}
          {!recovery && view === 'login' && confirmationResent && <div className="auth-success" role="status"><Check size={18} aria-hidden="true" /><span>Yêu cầu gửi lại email đã được tiếp nhận. Vui lòng kiểm tra hộp thư và thư mục Spam.</span></div>}
          <Button type="submit" variant="primary" loading={busy && !resending} disabled={busy}>{busy && !resending ? recovery ? 'Đang cập nhật…' : view === 'signup' ? 'Đang tạo tài khoản…' : emailOnly ? 'Đang gửi…' : 'Đang đăng nhập…' : recovery ? 'Lưu mật khẩu mới' : view === 'signup' ? 'Tạo tài khoản' : emailOnly ? 'Gửi liên kết đặt lại mật khẩu' : 'Đăng nhập'}</Button>
          {!recovery && view === 'signup' && <p className="auth-form-note">Tạo tài khoản để bắt đầu với không gian trống của riêng bạn.</p>}
          {recovery ? <button type="button" className="auth-text-action" disabled={busy} onClick={() => void exitRecovery()}>Hủy đặt lại mật khẩu</button> : emailOnly && <button type="button" className="auth-text-action" disabled={busy} onClick={() => navigate('login')}><ArrowLeft size={16} aria-hidden="true" /> Quay lại đăng nhập</button>}
        </form>}
        {!notice && !emailOnly && !recovery && <div className="auth-private-note"><ShieldCheck size={16} aria-hidden="true" /><span>Chỉ tài khoản của bạn truy cập dữ liệu của bạn.</span></div>}
      </section>
    </div>
  </main>;
}
