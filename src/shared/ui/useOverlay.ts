import { useEffect, useId, useRef, type RefObject } from 'react';

const overlayStack: symbol[] = [];
let bodyScrollLockCount = 0;
let bodyOverflowBeforeLock = '';

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
  const overlayTokenRef = useRef(Symbol('overlay'));
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;
  initialFocusRefRef.current = initialFocusRef;

  useEffect(() => {
    if (!open) return;
    const overlayToken = overlayTokenRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    overlayStack.push(overlayToken);
    if (bodyScrollLockCount === 0) bodyOverflowBeforeLock = document.body.style.overflow;
    bodyScrollLockCount += 1;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      const target = initialFocusRefRef.current?.current
        ?? panelRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      target?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (overlayStack.at(-1) !== overlayToken) return;
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
      const wasTopOverlay = overlayStack.at(-1) === overlayToken;
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      const stackIndex = overlayStack.lastIndexOf(overlayToken);
      if (stackIndex >= 0) overlayStack.splice(stackIndex, 1);
      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
      if (bodyScrollLockCount === 0) document.body.style.overflow = bodyOverflowBeforeLock;
      if (wasTopOverlay && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  return { panelRef, titleId, descriptionId };
}
