import { describe, expect, it, vi } from 'vitest';
import { canShareInvoiceImage, shareInvoiceImage } from './invoice-image-share';

const image = () => new File([new Uint8Array([137, 80, 78, 71])], 'HocPhi_Minh_9_2026.png', { type: 'image/png' });

describe('Prepared invoice image sharing', () => {
  it('starts native sharing immediately with the same prepared PNG file', async () => {
    const file = image();
    let finishShare!: () => void;
    const share = vi.fn((_data: { files: File[] }) => new Promise<void>(resolve => { finishShare = resolve; }));
    const target = { canShare: vi.fn(() => true), share };
    const result = shareInvoiceImage(file, target);
    // Before awaiting, native sharing must already have the user's activation.
    expect(share).toHaveBeenCalledWith({ files: [file] });
    expect(share.mock.calls[0][0].files[0]).toBe(file);
    expect(target.canShare).toHaveBeenCalledWith({ files: [file] });
    finishShare();
    expect(await result).toBe('shared');
  });

  it('leaves unsupported or rejected file capabilities to the download controls', async () => {
    const file = image();
    const share = vi.fn().mockResolvedValue(undefined);
    const unsupported = { canShare: vi.fn(() => false), share };
    expect(canShareInvoiceImage(file, {})).toBe(false);
    expect(canShareInvoiceImage(file, { share })).toBe(false);
    expect(canShareInvoiceImage(file, { canShare: () => true })).toBe(false);
    expect(await shareInvoiceImage(file, {})).toBe('unsupported');
    expect(await shareInvoiceImage(file, unsupported)).toBe('unsupported');
    expect(share).not.toHaveBeenCalled();
  });

  it('treats a capability check that throws as unsupported', async () => {
    const file = image();
    const target = { canShare: vi.fn(() => { throw new Error('Blocked by browser policy'); }), share: vi.fn() };
    expect(canShareInvoiceImage(file, target)).toBe(false);
    expect(await shareInvoiceImage(file, target)).toBe('unsupported');
    expect(target.share).not.toHaveBeenCalled();
  });

  it('silently reports user cancellation without triggering a download', async () => {
    const createElement = vi.fn();
    vi.stubGlobal('document', { createElement });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    try {
      const target = { canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException('User closed the share sheet', 'AbortError')) };
      expect(await shareInvoiceImage(image(), target)).toBe('cancelled');
      expect(target.share).toHaveBeenCalledTimes(1);
      expect(createElement).not.toHaveBeenCalled();
      expect(createObjectURL).not.toHaveBeenCalled();
    } finally { createObjectURL.mockRestore(); vi.unstubAllGlobals(); }
  });

  it('propagates real sharing failures so the UI can retain download alternatives', async () => {
    const problem = new DOMException('Sharing is blocked', 'NotAllowedError');
    const target = { canShare: () => true, share: vi.fn().mockRejectedValue(problem) };
    await expect(shareInvoiceImage(image(), target)).rejects.toBe(problem);
  });
});
