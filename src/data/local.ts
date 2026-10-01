import { createDemoData } from '../domain';
import type { WorkspaceData } from '../types';

interface WorkspaceRecord { data: WorkspaceData; revision: number }
const DB = 'tutorspace-v1';
let connection: Promise<IDBDatabase> | undefined;
function database() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('Trình duyệt không hỗ trợ lưu dữ liệu. Hãy dùng Chrome, Edge hoặc Safari bản mới.')); return; }
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = undefined; reject(request.error ?? new Error('Không mở được kho dữ liệu trên thiết bị.')); };
    request.onblocked = () => reject(new Error('Kho dữ liệu bị khóa. Hãy đóng các tab TutorSpace khác và tải lại.'));
  });
  return connection;
}
export async function loadLocal(): Promise<WorkspaceRecord> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('records', 'readwrite'); const store = transaction.objectStore('records');
    let record: WorkspaceRecord;
    const request = store.get('workspace');
    request.onsuccess = () => { record = request.result as WorkspaceRecord; if (!record) { record = { data: createDemoData(), revision: 0 }; store.put(record, 'workspace'); } };
    transaction.oncomplete = () => resolve(record);
    transaction.onabort = () => reject(transaction.error ?? new Error('Không tải được dữ liệu trên thiết bị.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Không tải được dữ liệu trên thiết bị.'));
  });
}
export async function saveLocal(data: WorkspaceData, expectedRevision: number): Promise<number> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('records', 'readwrite'); const store = transaction.objectStore('records'); let conflict = false;
    const request = store.get('workspace');
    request.onsuccess = () => {
      if (request.result?.revision !== expectedRevision) { conflict = true; transaction.abort(); return; }
      store.put({ data, revision: expectedRevision + 1 }, 'workspace');
    };
    transaction.oncomplete = () => resolve(expectedRevision + 1);
    transaction.onabort = () => reject(new Error(conflict ? 'VERSION_CONFLICT' : 'Không lưu được dữ liệu. Kiểm tra dung lượng thiết bị và thử lại.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Không lưu được dữ liệu.'));
  });
}
/** Persist the login session in IndexedDB too. No private workspace data is in localStorage. */
export const authStorage = {
  async getItem(key: string): Promise<string | null> { const db = await database(); return new Promise((resolve, reject) => { const request = db.transaction('records').objectStore('records').get(`auth:${key}`); request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error); }); },
  async setItem(key: string, value: string) { const db = await database(); return new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put(value, `auth:${key}`); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); },
  async removeItem(key: string) { const db = await database(); return new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').delete(`auth:${key}`); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); },
};
