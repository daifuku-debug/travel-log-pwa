import { createPortal } from 'react-dom';
import type { ReactNode, RefObject } from 'react';
import { Button } from './Button';
import { useOverlay } from './useOverlay';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  dismissible?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  initialFocusRef,
  closeLabel = '閉じる',
  size = 'md',
  dismissible = true,
}: BottomSheetProps) {
  const { panelRef, titleId, descriptionId } = useOverlay({ open, onClose, dismissible, initialFocusRef });
  if (!open) return null;

  return createPortal(
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className={`bottom-sheet bottom-sheet--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="bottom-sheet__handle" aria-hidden="true" />
        <header className={`bottom-sheet__header${description ? '' : ' bottom-sheet__header--compact'}`}>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <Button variant="ghost" size="sm" aria-label={closeLabel} onClick={onClose}>閉じる</Button>
        </header>
        <div className="bottom-sheet__body">{children}</div>
        {actions && <footer className="bottom-sheet__actions">{actions}</footer>}
      </section>
    </div>,
    document.body,
  );
}
