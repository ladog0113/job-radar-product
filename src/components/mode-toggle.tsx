"use client";

import { cn } from "@/lib/utils";
import { UI_MODE_LABEL, useUiMode, type UiMode } from "@/lib/ui-mode";

const MODES: UiMode[] = ["default", "ref", "cli"];

export function ModeToggle({ className, variant = "default" }: { className?: string; variant?: "default" | "cli" }) {
  const { mode, setMode } = useUiMode();
  if (variant === "cli") {
    return (
      <div className={cn("flex items-center gap-3 font-mono text-xs", className)}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={m === mode ? "text-[#e5e5e5]" : "text-[#6b6b6b] hover:text-[#a3a3a3]"}
          >
            {m === "default" ? "1:main" : m === "ref" ? "2:ref" : "3:zsh"}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={cn("inline-flex items-center rounded-md border bg-muted p-0.5 text-xs", className)}>
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={cn(
            "whitespace-nowrap rounded px-2 py-1 transition-colors",
            m === mode ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {UI_MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}
