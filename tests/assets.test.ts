import { describe, expect, it } from 'vitest';
import { dehydrateWorkspace, hydrateWorkspace } from '../src/data/assets';
import { createDemoData, validateBackup } from '../src/domain';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+NMhQAAAAASUVORK5CYII=';

describe('private cloud asset wire adapter', () => {
  it('deduplicates repeated image bytes across avatars and issued snapshots and hydrates losslessly', async () => {
    const data = createDemoData(); data.demo=false;
    data.profile.avatar=png; data.settings.qrImage=png;
    data.students.forEach(s=>s.avatar=png); data.invoices.forEach(i=>i.snapshot.qrImage=png);
    const wire=await dehydrateWorkspace(data);
    expect(Object.keys(wire.assets)).toHaveLength(1);
    expect(wire.profile.avatar).toMatch(/^asset:[a-f0-9]{64}$/);
    expect(wire.invoices.every(i=>i.snapshot.qrImage===wire.settings.qrImage)).toBe(true);
    expect(JSON.stringify(wire).split(png).length-1).toBe(1);
    expect(hydrateWorkspace(wire)).toEqual(data);
    expect(validateBackup(hydrateWorkspace(wire))).toEqual(data);
  });
  it('rejects remote URLs, missing dictionaries and unresolved or malformed references', async () => {
    const data=createDemoData(); data.settings.qrImage='https://example.com/qr.png';
    await expect(dehydrateWorkspace(data)).rejects.toThrow('Ảnh');
    data.settings.qrImage=png; const wire=await dehydrateWorkspace(data);
    wire.assets={}; expect(()=>hydrateWorkspace(wire)).toThrow('không có');
    wire.settings.qrImage='asset:../other-owner'; expect(()=>hydrateWorkspace(wire)).toThrow('Tham chiếu');
    expect(()=>hydrateWorkspace(createDemoData())).toThrow('migration');
  });
  it('retains empty images without adding assets and rejects uploads beyond the cloud limit', async () => {
    const data=createDemoData(); const wire=await dehydrateWorkspace(data);
    expect(wire.assets).toEqual({}); expect(hydrateWorkspace(wire)).toEqual(data);
    data.settings.qrImage=`data:image/png;base64,${'A'.repeat(2796204)}`;
    await expect(dehydrateWorkspace(data)).rejects.toThrow('2 MB');
  });
});
