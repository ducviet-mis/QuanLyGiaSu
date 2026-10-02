import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceLoader, needsAuthWorkspaceLoad } from './workspace-load';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe('workspace loading across auth events', () => {
  it('does not reload a loaded account on repeated tab-focus or token events', () => {
    for (const event of ['SIGNED_IN', 'INITIAL_SESSION', 'TOKEN_REFRESHED', 'USER_UPDATED']) {
      expect(needsAuthWorkspaceLoad(event, false, true)).toBe(false);
    }
  });

  it('loads an initial or different account, but keeps sign-out and recovery out of workspace loading', () => {
    expect(needsAuthWorkspaceLoad('INITIAL_SESSION', false, false)).toBe(true);
    expect(needsAuthWorkspaceLoad('SIGNED_IN', false, false)).toBe(true);
    expect(needsAuthWorkspaceLoad('SIGNED_IN', true, true)).toBe(true);
    expect(needsAuthWorkspaceLoad('TOKEN_REFRESHED', true, true)).toBe(true);
    expect(needsAuthWorkspaceLoad('SIGNED_OUT', true, false)).toBe(false);
    expect(needsAuthWorkspaceLoad('PASSWORD_RECOVERY', true, false)).toBe(false);
  });

  it('shares the startup/sign-in request and allows a later explicit refresh', async () => {
    const loader = createWorkspaceLoader(); const wait = deferred();
    const fetch = vi.fn(async () => { await wait.promise; });
    const first = loader.run(fetch); const second = loader.run(fetch);
    expect(first).toBe(second);
    await Promise.resolve(); expect(fetch).toHaveBeenCalledTimes(1);
    wait.resolve(); await first;
    await loader.run(fetch); expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('discards a previous account response without clearing the new account request', async () => {
    const loader = createWorkspaceLoader(); const oldWait = deferred(); const newWait = deferred();
    const visible: string[] = [];
    const old = loader.run(async current => { await oldWait.promise; if (current()) visible.push('old'); });
    await Promise.resolve(); loader.invalidate();
    const next = loader.run(async current => { await newWait.promise; if (current()) visible.push('new'); });
    oldWait.resolve(); await old;
    expect(loader.run(async () => { throw Error('duplicate load'); })).toBe(next);
    newWait.resolve(); await next;
    expect(visible).toEqual(['new']);
  });

  it('does not apply an older refresh after a successful save or sign-out', async () => {
    const loader = createWorkspaceLoader(); const wait = deferred(); const apply = vi.fn();
    const pending = loader.run(async current => { await wait.promise; if (current()) apply(); });
    await Promise.resolve(); loader.invalidate(); wait.resolve(); await pending;
    expect(apply).not.toHaveBeenCalled();
  });

  it('allows retry after a failed request', async () => {
    const loader = createWorkspaceLoader();
    await expect(loader.run(async () => { throw Error('offline'); })).rejects.toThrow('offline');
    const retry = vi.fn(async () => {}); await loader.run(retry);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
