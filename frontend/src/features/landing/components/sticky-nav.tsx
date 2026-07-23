"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Sticky header — only visible when user moves mouse to the top zone.
 */
export function StickyHeader() {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (e.clientY < 60) {
      setVisible(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    } else if (visible) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setVisible(false), 1500);
    }
  }, [visible]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleMouseMove]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b border-white/[0.04] bg-black/60 px-6 py-3 backdrop-blur-lg transition-all duration-500 ${
        visible
          ? "translate-y-0 opacity-100"
          : "-translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="text-sm font-bold tracking-widest text-white/80 hover:text-white">
          HUASCAR
        </Link>
        <nav className="flex items-center gap-6 text-xs font-medium text-zinc-500">
          <Link href="/agents/new" className="transition-colors hover:text-white">
            Creator
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-white">
            Dashboard
          </Link>
          <a
            href="https://github.com/VECTORG99/Huascar"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

/**
 * Sticky footer — only visible when user moves mouse to the bottom zone.
 */
export function StickyFooter() {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (e.clientY > window.innerHeight - 50) {
      setVisible(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    } else if (visible) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setVisible(false), 1500);
    }
  }, [visible]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleMouseMove]);

  return (
    <footer
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.04] bg-black/60 px-6 py-3 backdrop-blur-lg transition-all duration-500 ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-zinc-600">
        <span>Huascar · Open Source · MIT</span>
        <span className="font-mono text-zinc-700">v1.0.0</span>
      </div>
    </footer>
  );
}
