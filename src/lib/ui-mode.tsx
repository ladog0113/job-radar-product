"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type UiMode = "default" | "ref" | "cli";

export const UI_MODE_LABEL: Record<UiMode, string> = {
  default: "기본",
  ref: "레퍼런스",
  cli: "CLI",
};

const KEY = "jr_ui_mode";
const DOUBLE_TAP_MS = 400;

const TITLES: Record<UiMode, string> = {
  default: "Job Radar",
  ref: "Reference Shelf",
  cli: "zsh",
};

type Ctx = { mode: UiMode; setMode: (m: UiMode) => void };
const UiModeContext = createContext<Ctx>({ mode: "default", setMode: () => {} });

function loadMode(): UiMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "ref" || v === "cli" || v === "default") return v;
  } catch {}
  return "default";
}

function isTyping(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function UiModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<UiMode>("default");
  const [ready, setReady] = useState(false);
  const last = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => {
    setModeState(loadMode());
    setReady(true);
  }, []);

  const setMode = useCallback((m: UiMode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {}
  }, []);

  useEffect(() => {
    document.title = TITLES[mode];
  }, [mode]);

  // 스페이스 두 번: 레퍼런스 모드, 오른쪽 Shift 두 번: CLI 모드
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      const code = e.code;
      if (code !== "Space" && code !== "ShiftRight") {
        last.current = { code: "", at: 0 };
        return;
      }
      // 입력 중인 스페이스는 무시 (CLI 입력창 포함). 오른쪽 Shift는 입력 중에도 받는다
      if (code === "Space" && isTyping(e.target)) return;
      const now = performance.now();
      const isDouble = last.current.code === code && now - last.current.at < DOUBLE_TAP_MS;
      last.current = isDouble ? { code: "", at: 0 } : { code, at: now };
      if (code === "Space" && e.target === document.body) e.preventDefault(); // 페이지 스크롤 방지
      if (!isDouble) return;
      setMode(code === "Space" ? "ref" : "cli");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMode]);

  if (!ready) return null;
  return <UiModeContext.Provider value={{ mode, setMode }}>{children}</UiModeContext.Provider>;
}

export function useUiMode() {
  return useContext(UiModeContext);
}
