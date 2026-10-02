// Share concurrent loads, but never share work across an account change or save.
export function createWorkspaceLoader() {
  let generation = 0;
  let pending: { generation: number; promise: Promise<void> } | undefined;
  return {
    invalidate() { generation++; },
    run(task: (isCurrent: () => boolean) => Promise<void>): Promise<void> {
      if (pending?.generation === generation) return pending.promise;
      const run = generation;
      const promise = Promise.resolve().then(() => task(() => run === generation)).finally(() => {
        if (pending?.promise === promise) pending = undefined;
      });
      pending = { generation: run, promise };
      return promise;
    },
  };
}

export function needsAuthWorkspaceLoad(event: string, ownerChanged: boolean, ready: boolean) {
  if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_OUT') return false;
  return ownerChanged || (!ready && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN'));
}
