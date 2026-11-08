"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useScrollLock } from "@/lib/useScrollLock";

type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  icon?: ReactNode;
};

type Pending = ConfirmOptions & { resolve: (value: boolean) => void };

/**
 * In-page replacement for window.confirm(). Native dialogs are often blocked or
 * suppressed on mobile (in-app browsers, home-screen apps, Safari "block dialogs").
 *
 * const [confirm, confirmDialog] = useConfirm();
 * if (!(await confirm({ title: "Logout?" }))) return;
 * ...render {confirmDialog} somewhere in the page.
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setPending({ ...options, resolve });
  }), []);

  const close = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const dialog = pending ? <ConfirmDialog {...pending} onClose={close} /> : null;
  return [confirm, dialog] as const;
}

function ConfirmDialog({ title, message, confirmLabel = "YA, LANJUT", cancelLabel = "BATAL", tone = "default", icon, onClose }: ConfirmOptions & { onClose: (value: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useScrollLock(true);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="confirm-backdrop" onClick={() => onClose(false)} data-lenis-prevent data-scroll-lock-allow>
      <div className={`confirm-sheet is-${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={message ? "confirm-message" : undefined} onClick={(event) => event.stopPropagation()}>
        <span className="confirm-handle" aria-hidden="true" />
        {icon && <span className="confirm-icon" aria-hidden="true">{icon}</span>}
        <h2 id="confirm-title">{title}</h2>
        {message && <div id="confirm-message" className="confirm-message">{message}</div>}
        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" onClick={() => onClose(false)}>{cancelLabel}</button>
          <button ref={confirmRef} type="button" className="confirm-ok" onClick={() => onClose(true)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
