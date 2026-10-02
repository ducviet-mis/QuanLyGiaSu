import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ui';
import { closeIntent } from './formValidation';

export function useUnsavedChangesGuard(dirty: boolean, onClose: () => void, busy = false): { requestClose: () => void; discardDialog: ReactNode } {
  const [confirming, setConfirming] = useState(false);
  const requestClose = () => {
    const intent = closeIntent(dirty, busy);
    if (intent === 'confirm') setConfirming(true);
    else if (intent === 'close') onClose();
  };
  return {
    requestClose,
    discardDialog: <ConfirmDialog
      open={confirming}
      onClose={() => { if (!busy) setConfirming(false); }}
      onConfirm={() => { if (busy) return; setConfirming(false); onClose(); }}
      title="Bỏ thay đổi chưa lưu?"
      description="Những thông tin bạn vừa chỉnh sửa chưa được lưu. Quay lại để tiếp tục chỉnh sửa hoặc bỏ thay đổi để đóng."
      confirmLabel="Bỏ thay đổi"
      danger
      loading={busy}
    />,
  };
}
