import { createPortal } from 'react-dom';
import { useRef } from 'react';
import { Button } from './Button';
import { useOverlay } from './useOverlay';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  secondaryLabel?: string;
  variant?: 'danger' | 'primary';
  processing?: boolean;
  onConfirm: () => void | Promise<void>;
  onSecondary?: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'キャンセル',
  secondaryLabel,
  variant = 'danger',
  processing = false,
  onConfirm,
  onSecondary,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { panelRef, titleId, descriptionId } = useOverlay({
    open,
    onClose: onCancel,
    dismissible: !processing,
    initialFocusRef: cancelRef,
  });
  if (!open) return null;

  return createPortal(
    <div className="overlay overlay--dialog" onMouseDown={(event) => {
      if (!processing && event.target === event.currentTarget) onCancel();
    }}>
      <section
        ref={panelRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="confirm-dialog__actions">
          <Button ref={cancelRef} disabled={processing} onClick={onCancel}>{cancelLabel}</Button>
          {secondaryLabel && onSecondary && (
            <Button disabled={processing} onClick={() => void onSecondary()}>{secondaryLabel}</Button>
          )}
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} loading={processing} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
