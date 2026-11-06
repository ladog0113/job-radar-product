"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CLI_COMMANDS, CLI_KEYS, GLOBAL_KEYS } from "@/lib/shortcuts";

/** 헤더의 ? 버튼: 단축키와 CLI 명령어 */
export function ShortcutHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70vh] w-[min(420px,calc(100vw-2rem))] overflow-y-auto text-xs">
        <Rows title="단축키" rows={GLOBAL_KEYS} />
        <Rows title="CLI 단축키" rows={CLI_KEYS} />
        <Rows title="CLI 명령어" rows={CLI_COMMANDS} />
      </PopoverContent>
    </Popover>
  );
}

function Rows({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 font-medium">{title}</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-3 py-0.5">
          <span className="w-28 shrink-0 font-mono">{k}</span>
          <span className="text-muted-foreground">{v}</span>
        </div>
      ))}
    </div>
  );
}
