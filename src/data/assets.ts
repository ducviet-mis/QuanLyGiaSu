import type { WorkspaceData } from '../types';

/** Only the cloud wire representation uses asset references. UI/backups retain data URIs. */
export interface InternedWorkspace extends WorkspaceData { assets: Record<string, string> }
const hashes = new Map<string, string>();
export const clearImageHashCache = () => hashes.clear();
const imagePattern = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export async function dehydrateWorkspace(data: WorkspaceData): Promise<InternedWorkspace> {
  const wire = structuredClone(data) as InternedWorkspace; wire.assets = {};
  const intern = async (uri: string) => {
    if (!uri) return '';
    const match = imagePattern.exec(uri);
    if (!match || match[2].length % 4 !== 0) throw new Error('Ảnh trong dữ liệu không hợp lệ.');
    const bytes = match[2].length * 3 / 4 - (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0);
    if (bytes > 2 * 1024 * 1024) throw new Error('Ảnh lưu trên đám mây phải nhỏ hơn hoặc bằng 2 MB.');
    let hash = hashes.get(uri);
    if (!hash) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uri));
      hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      if (hashes.size >= 16) hashes.delete(hashes.keys().next().value!);
      hashes.set(uri, hash);
    }
    wire.assets[hash] = uri;
    return `asset:${hash}`;
  };
  wire.profile.avatar = await intern(wire.profile.avatar); wire.settings.qrImage = await intern(wire.settings.qrImage);
  for (const student of wire.students) student.avatar = await intern(student.avatar);
  for (const invoice of wire.invoices) invoice.snapshot.qrImage = await intern(invoice.snapshot.qrImage);
  return wire;
}

export function hydrateWorkspace(value: unknown): WorkspaceData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Kho dữ liệu không hợp lệ.');
  const wire = structuredClone(value) as InternedWorkspace;
  if (!wire.assets || typeof wire.assets !== 'object' || Array.isArray(wire.assets) || !wire.profile || !wire.settings || !Array.isArray(wire.students) || !Array.isArray(wire.invoices)) throw new Error('Kho ảnh của dữ liệu chưa được cấu hình đúng. Hãy kiểm tra migration Supabase.');
  const hydrate = (reference: unknown) => {
    if (reference === '') return '';
    if (typeof reference !== 'string' || !/^asset:[a-f0-9]{64}$/.test(reference)) throw new Error('Tham chiếu ảnh không hợp lệ.');
    const uri = wire.assets[reference.slice(6)];
    if (typeof uri !== 'string' || !imagePattern.test(uri)) throw new Error('Ảnh được tham chiếu không có trong kho riêng của bạn.');
    return uri;
  };
  wire.profile.avatar = hydrate(wire.profile.avatar); wire.settings.qrImage = hydrate(wire.settings.qrImage);
  for (const student of wire.students) student.avatar = hydrate(student.avatar);
  for (const invoice of wire.invoices) { if (!invoice.snapshot) throw new Error('Snapshot hóa đơn không hợp lệ.'); invoice.snapshot.qrImage = hydrate(invoice.snapshot.qrImage); }
  const { assets: _assets, ...data } = wire;
  return data;
}
