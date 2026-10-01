import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { authStorage } from './local';
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const configured = Boolean(url || key);
let initializationError = configured && (!url || !key) ? 'Cấu hình Supabase chưa đầy đủ. Cần VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.' : '';
let client: SupabaseClient | null = null;
if (url && key) {
  try { client = createClient(url, key, { auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }); }
  catch { initializationError = 'Địa chỉ hoặc khóa Supabase không hợp lệ. Kiểm tra file .env.local rồi khởi động lại ứng dụng.'; }
}
export const configurationError = initializationError;
export const supabase = client;

export async function fileDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Không đọc được ảnh.')); reader.readAsDataURL(file); });
}
export async function validateImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Chọn ảnh PNG, JPG, JPEG hoặc WEBP.');
  if (file.size > 2 * 1024 * 1024 || file.size === 0) throw new Error('Ảnh phải nhỏ hơn hoặc bằng 2 MB và không được rỗng.');
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const src = URL.createObjectURL(file); const preview = new Image();
    preview.onload = () => { URL.revokeObjectURL(src); resolve({ width: preview.naturalWidth, height: preview.naturalHeight }); };
    preview.onerror = () => { URL.revokeObjectURL(src); reject(new Error('Tệp không phải ảnh hợp lệ.')); };
    preview.src = src;
  });
  const valid = dimensions.width > 0 && dimensions.height > 0 && dimensions.width <= 6000 && dimensions.height <= 6000;
  if (!valid) throw new Error('Ảnh tối đa 6.000 × 6.000 pixel.');
}
