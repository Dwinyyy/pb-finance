import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as Motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from './Button';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const overlayMotion = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

const sizeClasses = {
  default: 'max-w-lg',
  onboarding: 'max-w-5xl',
  preview: 'max-w-6xl',
  wide: 'max-w-3xl',
};

export function Modal({
  bodyClassName = '',
  children,
  description,
  footer,
  initialFocusRef,
  onClose,
  open,
  panelClassName = '',
  size = 'default',
  title,
}) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const generatedId = useId();
  const prefersReducedMotion = useReducedMotion();
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  const widthClass = sizeClasses[size] || sizeClasses.default;
  const panelMotion = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 18, scale: 0.985 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 10, scale: 0.99 } };

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => [...(panelRef.current?.querySelectorAll(FOCUSABLE) || [])];
    const focusFrame = window.requestAnimationFrame(() => (
      initialFocusRef?.current || focusable()[0] || panelRef.current
    )?.focus());

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = items[0];
      const last = items.at(-1);
      if (!panelRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [initialFocusRef, open]);

  const closeFromOverlay = (event) => {
    if (event.target === event.currentTarget) onCloseRef.current();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <Motion.div
          key="modal-overlay"
          initial={overlayMotion.initial}
          animate={overlayMotion.animate}
          exit={overlayMotion.exit}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
          className="fixed inset-0 z-[200] flex min-h-full items-end justify-center overflow-y-auto bg-pb-midnight/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={closeFromOverlay}
        >
          <Motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={panelMotion.initial}
            animate={panelMotion.animate}
            exit={panelMotion.exit}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.22, ease: 'easeOut' }}
            className={`flex max-h-[calc(100dvh-2rem)] w-full ${widthClass} flex-col overflow-hidden rounded-t-modal border border-border-subtle bg-surface text-text-primary shadow-modal sm:rounded-modal ${panelClassName}`}
          >
            <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b border-border-subtle bg-surface px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-bold tracking-tight text-text-primary">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-text-muted">
                    {description}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 size-11 !p-0"
                aria-label="Close dialog"
                onClick={() => onCloseRef.current()}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </header>

            <div className={`min-h-0 flex-1 overflow-y-auto bg-canvas px-5 py-5 sm:px-6 ${bodyClassName}`}>
              {children}
            </div>

            {footer && (
              <footer className="sticky bottom-0 z-10 shrink-0 border-t border-border-subtle bg-surface px-5 py-4 sm:px-6">
                {footer}
              </footer>
            )}
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
