import { useEffect, useId, useRef, type RefObject } from 'react';

export function useOverlay({
  open,
  onClose,
  dismissible,
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  dismissible: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const initialFocusRefRef = useRef(initialFocusRef);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;
  initialFocusRefRef.current = initialFocusRef;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      const target = initialFocusRefRef.current?.current
        ?? panelRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      target?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  return { panelRef, titleId, descriptionId };
}
