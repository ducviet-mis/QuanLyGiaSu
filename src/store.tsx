import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { emptyWorkspace, protectIssuedInvoices, validateBackup, newId } from './domain';
import { configured, configurationError, supabase, fileDataUrl, validateImage, initialAuthCallback } from './data/cloud';
import { createAuthActions, readableAuthError } from './data/auth';
import { loadLocal, saveLocal } from './data/local';
import { dehydrateWorkspace, hydrateWorkspace, clearImageHashCache } from './data/assets';
import type { WorkspaceData } from './types';

export interface UpdateOptions { allowIssuedChanges?: boolean }
interface WorkspaceContextValue {
  data: WorkspaceData; loading: boolean; ready: boolean; saving: boolean; error: string; configured: boolean; authUser: { id: string; email?: string } | null; mode: 'demo' | 'cloud';
  update: (transform: (current: WorkspaceData) => WorkspaceData, successMessage?: string, options?: UpdateOptions) => Promise<boolean>;
  reload: () => Promise<void>; signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void>; uploadImage: (file: File) => Promise<string>;
  signUp: (name: string, email: string, password: string) => Promise<{ requiresConfirmation: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>; resetPassword: (password: string) => Promise<void>; resendConfirmation: (email: string) => Promise<void>;
  passwordRecovery: boolean; authLinkError: string;
}
const Context = createContext<WorkspaceContextValue | null>(null);
function readableError(value: unknown): string {
  const message = value instanceof Error ? value.message : typeof value === 'object' && value && 'message' in value ? String(value.message) : 'Không thể lưu dữ liệu. Vui lòng thử lại.';
  if (message.includes('VERSION_CONFLICT')) return 'Dữ liệu đã thay đổi ở tab hoặc thiết bị khác. Đã tải bản mới; hãy kiểm tra và thực hiện lại thao tác.';
  if (message.includes('OWNER_ONLY')) return 'Cơ sở dữ liệu đang dùng bản một tài khoản. Người quản lý cần chạy SQL nâng cấp nhiều tài khoản.';
  if (message.includes('AUTH_REQUIRED')) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (message.includes('ISSUED_IMMUTABLE')) return 'Hóa đơn đã phát hành được bảo toàn. Cần xác nhận thao tác chỉnh sửa.';
  if (message.includes('Invalid login credentials')) return 'Email hoặc mật khẩu chưa đúng.';
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại; dữ liệu chưa được lưu.';
  if (message.includes('OVERPAYMENT')) return 'Số tiền thanh toán vượt phần học phí còn lại.';
  if (message.includes('ASSET_')) return 'Ảnh hoặc tham chiếu ảnh không hợp lệ. Ảnh phải là PNG, JPEG hoặc WEBP, tối đa 2 MB; hãy tải ảnh lại.';
  if (message.includes('WORKSPACE_TOO_LARGE')) return 'Kho dữ liệu vượt giới hạn 50 MB cho mỗi lần đồng bộ. Hãy kiểm tra kích thước các ảnh và tệp sao lưu.';
  return readableAuthError(value);
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkspaceData>(emptyWorkspace); const dataRef = useRef(data); const revision = useRef(0);
  const [loading, setLoading] = useState(true); const [ready, setReady] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState(configurationError);
  const [authUser, setAuthUser] = useState<WorkspaceContextValue['authUser']>(null); const authUserRef = useRef<string | null>(null); const authEpoch = useRef(0); const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [passwordRecovery, setPasswordRecovery] = useState(initialAuthCallback.recovery && !initialAuthCallback.error);
  const recoveryRef = useRef(passwordRecovery); const [authLinkError, setAuthLinkError] = useState(initialAuthCallback.error);
  const authActions = createAuthActions(supabase?.auth ?? null, () => window.location.origin);
  const mounted = useRef(true); const generation = useRef(0);
  const setWorkspace = useCallback((next: WorkspaceData) => { dataRef.current = next; if (mounted.current) setData(next); }, []);
  const reload = useCallback(async () => {
    const run = ++generation.current; setLoading(true);
    try {
      if (configurationError) throw new Error(configurationError);
      if (!configured) { const result = await loadLocal(); if (run !== generation.current) return; revision.current = result.revision; setWorkspace(validateBackup(result.data)); setReady(true); setError(''); return; }
      if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
      const { data: auth, error: authError } = await supabase.auth.getSession(); if (authError) throw authError;
      if (run !== generation.current) return;
      const owner = auth.session?.user.id ?? null;
      if (authUserRef.current !== owner) { authUserRef.current = owner; authEpoch.current++; revision.current = 0; clearImageHashCache(); setWorkspace(emptyWorkspace()); setReady(false); }
      setAuthUser(auth.session ? { id: auth.session.user.id, email: auth.session.user.email } : null);
      if (!auth.session) { setWorkspace(emptyWorkspace()); setReady(false); setError(''); return; }
      if (recoveryRef.current) { setReady(false); setError(''); return; }
      const result = await supabase.rpc('workspace_load'); if (result.error) throw result.error;
      if (run !== generation.current) return;
      revision.current = Number(result.data.revision);
      const next = validateBackup(hydrateWorkspace(result.data.data));
      if (revision.current === 0 && !next.profile.name && !next.profile.email) {
        const name = auth.session.user.user_metadata?.display_name;
        next.profile.name = typeof name === 'string' ? name.trim().slice(0,100) : '';
        next.profile.email = auth.session.user.email || '';
      }
      setWorkspace(next); setReady(true); setError('');
    } catch (problem) { if (run === generation.current) setError(readableError(problem)); }
    finally { if (run === generation.current && mounted.current) setLoading(false); }
  }, [setWorkspace]);
  useEffect(() => {
    mounted.current = true;
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      // Updating the recovery password must keep the form mounted so it can
      // show success and let the user explicitly return to a fresh login.
      if (event === 'USER_UPDATED' && recoveryRef.current) return;
      if (event === 'PASSWORD_RECOVERY') { recoveryRef.current = true; setPasswordRecovery(true); setAuthLinkError(''); }
      if (event === 'SIGNED_OUT') { recoveryRef.current = false; setPasswordRecovery(false); }
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        const owner = session?.user.id ?? null;
        if (authUserRef.current !== owner) { authUserRef.current = owner; authEpoch.current++; revision.current = 0; generation.current++; clearImageHashCache(); setWorkspace(emptyWorkspace()); setReady(false); setLoading(Boolean(owner)); setError(''); setAuthUser(session ? { id: owner!, email: session.user.email } : null); }
        setTimeout(() => { if (mounted.current) void reload(); }, 0);
      }
    });
    void reload();
    return () => { mounted.current = false; generation.current++; subscription?.data.subscription.unsubscribe(); };
  }, [reload]);
  const update = useCallback((transform: (current: WorkspaceData) => WorkspaceData, successMessage?: string, options?: UpdateOptions): Promise<boolean> => {
    const requestedOwner = authUserRef.current; const requestedEpoch = authEpoch.current;
    const job = queue.current.then(async () => {
      setSaving(true); setError('');
      try {
        if (!ready) throw new Error('Chưa tải được kho dữ liệu. Hãy tải lại trước khi thực hiện thay đổi.');
        if (configured && (!requestedOwner || requestedOwner !== authUserRef.current || requestedEpoch !== authEpoch.current)) throw new Error('Phiên đăng nhập đã thay đổi. Hãy đăng nhập để lưu dữ liệu.');
        const original = structuredClone(dataRef.current); const next = validateBackup(transform(structuredClone(original)));
        next.demo = !configured; protectIssuedInvoices(original, next, options?.allowIssuedChanges);
        if (configured) {
          if (!supabase) throw new Error(configurationError || 'Chưa cấu hình Supabase.');
          const wire = await dehydrateWorkspace(next);
          if (requestedOwner !== authUserRef.current || requestedEpoch !== authEpoch.current) return false;
          const result = await supabase.rpc('workspace_save', { workspace: wire, expected_revision: revision.current, allow_issued_changes: Boolean(options?.allowIssuedChanges) });
          if (result.error) throw result.error;
          if (requestedOwner !== authUserRef.current || requestedEpoch !== authEpoch.current) return false;
          revision.current = Number(result.data);
        } else revision.current = await saveLocal(next, revision.current);
        // A reload started before this commit may still carry an older revision.
        generation.current++; setLoading(false); setWorkspace(next); setReady(true); if (successMessage) toast.success(successMessage); return true;
      } catch (problem) {
        if (configured && (requestedOwner !== authUserRef.current || requestedEpoch !== authEpoch.current)) return false;
        const message = readableError(problem); if (message.includes('Đã tải bản mới')) await reload(); setError(message); toast.error(message); return false;
      } finally { setSaving(false); }
    });
    queue.current = job.catch(() => undefined); return job;
  }, [ready, reload, setWorkspace]);
  const signIn = async (email: string, password: string) => {
    await authActions.signIn(email, password); recoveryRef.current = false; setPasswordRecovery(false); setAuthLinkError(''); await reload();
  };
  const signUp = async (name: string, email: string, password: string) => {
    const result = await authActions.signUp(name, email, password); setAuthLinkError('');
    if (!result.requiresConfirmation) { recoveryRef.current = false; setPasswordRecovery(false); await reload(); }
    return result;
  };
  const signOut = async () => { if (supabase) { const result = await supabase.auth.signOut({ scope: 'local' }); if (result.error) { toast.error(readableError(result.error)); throw result.error; } if (authUserRef.current) { authUserRef.current = null; authEpoch.current++; generation.current++; } revision.current = 0; recoveryRef.current = false; setPasswordRecovery(false); setAuthLinkError(''); clearImageHashCache(); setAuthUser(null); setReady(false); setWorkspace(emptyWorkspace()); } };
  const uploadImage = async (file: File) => {
    await validateImage(file);
    if (!configured) return fileDataUrl(file);
    if (!supabase || !authUser) throw new Error('Đăng nhập trước khi tải ảnh lên.');
    const requestedEpoch = authEpoch.current; const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]; const path = `${authUser.id}/${newId()}.${extension}`;
    const result = await supabase.storage.from('tutorspace-private').upload(path, file, { contentType: file.type, upsert: false }); if (result.error) throw new Error(readableError(result.error));
    const downloaded = await supabase.storage.from('tutorspace-private').download(path); if (downloaded.error) throw new Error(readableError(downloaded.error));
    if (requestedEpoch !== authEpoch.current) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng tải ảnh lại.');
    // An authenticated data URI remains renderable in old invoice snapshots and PNG exports.
    const image = await fileDataUrl(downloaded.data);
    if (requestedEpoch !== authEpoch.current) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng tải ảnh lại.');
    return image;
  };
  return <Context.Provider value={{ data, loading, ready, saving, error, configured, authUser, mode: configured ? 'cloud' : 'demo', update, reload, signIn, signUp, signOut, uploadImage, passwordRecovery, authLinkError, requestPasswordReset: authActions.requestPasswordReset, resetPassword: authActions.resetPassword, resendConfirmation: authActions.resendConfirmation }}>{children}</Context.Provider>;
}
export function useWorkspace() { const context = useContext(Context); if (!context) throw new Error('useWorkspace cần WorkspaceProvider.'); return context; }
