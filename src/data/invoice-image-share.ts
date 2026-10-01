export interface InvoiceImageShareTarget {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files: File[] }) => Promise<void>;
}

const browserShareTarget = (): InvoiceImageShareTarget | undefined => typeof navigator === 'undefined' ? undefined : navigator;

export function canShareInvoiceImage(file: File, target: InvoiceImageShareTarget | undefined = browserShareTarget()): boolean {
  if (typeof target?.canShare !== 'function' || typeof target.share !== 'function') return false;
  try { return target.canShare({ files: [file] }); }
  catch { return false; }
}

export async function shareInvoiceImage(file: File, target: InvoiceImageShareTarget | undefined = browserShareTarget()): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (!canShareInvoiceImage(file, target)) return 'unsupported';
  try {
    // The PNG is already prepared. Start native sharing in the click's activation.
    await target!.share!({ files: [file] });
    return 'shared';
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled';
    throw error;
  }
}
