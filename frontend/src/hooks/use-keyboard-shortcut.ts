"use client";

import { useEffect } from "react";

interface ShortcutOptions {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: () => void;
  enabled?: boolean;
}

/**
 * Registers a global keyboard shortcut.
 */
export function useKeyboardShortcut({
  key,
  ctrl,
  meta,
  shift,
  handler,
  enabled = true,
}: ShortcutOptions) {
  useEffect(() => {
    if (!enabled) return;

    const listener = (event: KeyboardEvent) => {
      const ctrlMatch = ctrl ? event.ctrlKey || event.metaKey : true;
      const metaMatch = meta ? event.metaKey : true;
      const shiftMatch = shift ? event.shiftKey : true;

      if (event.key === key && ctrlMatch && metaMatch && shiftMatch) {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [key, ctrl, meta, shift, handler, enabled]);
}
