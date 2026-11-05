"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ModeToggle } from "@/components/mode-toggle";
import {
  FIT_LABEL,
  SOURCE_LABELS,
  careerFit,
  careerLabel,
  careerYears,
  daysAgoKST,
  requiredText,
  safeName,
  todayKST,
  useJson,
  type Detail,
  type Job,
} from "@/lib/data";
import { checkPassword, isUnlocked, markUnlocked, roomHit, roomKnownToData, roomSummary, useRooms, type Room } from "@/lib/rooms";
import { useUiMode } from "@/lib/ui-mode";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const PAGE = 20;
const USER = "dd";
const HOST = "MacBook-Pro";

type Line = { kind: "in" | "out" | "dim" | "err" | "hi"; text: string; cols?: [string, number][] };

// ---- 고정폭 출력 (한글은 2칸) ----
function cw(ch: string) {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6)
    ? 2
    : 1;
}
function width(s: string) {
  let w = 0;
  for (const ch of s) w += cw(ch);
  return w;
}
function fit(s: string, n: number) {
  if (width(s) <= n) return s + " ".repeat(n - width(s));
  let out = "";
  for (const ch of s) {
    if (width(out) + cw(ch) > n - 1) break;
    out += ch;
  }
  out += "…";
  return out + " ".repeat(Math.max(0, n - width(out)));
}

const PERIODS: Record<string, number | null> = { today: 0, "7d": 7, "30d": 30, all: null };

const HELP = [
  "commands:",
  "  ls                 list rooms, or postings in the current room",
  "  cd <n|name>        enter a room   (cd .. to go back)",
  "  cat <n>            show posting n from the last list",
  "  open <n>           open posting n source in a new tab",
  "  more               next page of the last list",
  "  grep <word>        filter postings in the current room",
  "  period <p>         today | 7d | 30d | all   (current: {period})",
  "  mode <m>           main | ref | cli",
  "  keys               show keyboard shortcuts",
  "  clear              clear the screen",
];

const KEYS = [
  "keyboard shortcuts:",
  "  Space x2           ref mode   (not while typing in an input)",
  "  Right Shift x2     cli mode",
  "",
  "in this terminal:",
  "  Up / Down          previous / next command",
  "  Ctrl+L             clear the screen",
  "  Ctrl+C             cancel the current line or password prompt",
];

export function CliApp() {
  const { setMode } = useUiMode();
  const { rooms } = useRooms();
  const { data: jobs, loading } = useJson<Job[]>("jobs.json", []);

  const [lines, setLines] = useState<Line[]>(() => [
    { kind: "dim", text: `Last login: ${new Date().toString().slice(0, 24)} on ttys001` },
    { kind: "dim", text: "type 'help' for commands" },
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState<string | null>(null); // room id
  const [period, setPeriod] = useState("7d");
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const [pwFor, setPwFor] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);
  const listing = useRef<{ ids: string[]; shown: number; label: string }>({ ids: [], shown: 0, label: "" });
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const room = rooms.find((r) => r.id === cwd) ?? null;
  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines, pwFor]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  const dirName = (r: Room | null) => (r ? `~/workspace/${r.name.replace(/\s+/g, "-")}` : "~/workspace");
  const prompt = `${USER}@${HOST} ${dirName(room)} %`;

  function print(...ls: Line[]) {
    setLines((prev) => [...prev, ...ls].slice(-2000));
  }
  const out = (text: string) => ({ kind: "out" as const, text });
  const dim = (text: string) => ({ kind: "dim" as const, text });
  const err = (text: string) => ({ kind: "err" as const, text });

  function roomJobs(r: Room, needle = "") {
    const known = roomKnownToData(r, jobs);
    const days = PERIODS[period];
    const since = days === null ? "" : daysAgoKST(days);
    const years = r.career_start ? careerYears(r.career_start) : null;
    const n = needle.toLowerCase();
    return jobs
      .filter((j) => !j.stale)
      .filter((j) => !since || j.first_seen >= since)
      .filter((j) => years === null || careerFit(j, years) !== "over")
      .filter((j) => !n || j.title.toLowerCase().includes(n) || j.company.toLowerCase().includes(n))
      .map((j) => ({ j, hit: roomHit(r, j, known) }))
      .filter((x) => x.hit)
      .sort((a, b) => (a.j.first_seen === b.j.first_seen ? b.hit!.score - a.hit!.score : a.j.first_seen < b.j.first_seen ? 1 : -1))
      .map((x) => x.j);
  }

  function printPage() {
    const r = room;
    const L = listing.current;
    const today = todayKST();
    const years = r?.career_start ? careerYears(r.career_start) : null;
    const slice = L.ids.slice(L.shown, L.shown + PAGE);
    if (L.shown === 0) {
      print(dim(`${L.label}  ${L.ids.length} items  period=${period}`));
      print({ kind: "dim", text: "", cols: [["#", 5], ["date", 7], ["site", 10], ["fit", 11], ["company", 18], ["title", 0]] });
    }
    slice.forEach((id, i) => {
      const j = jobById.get(id)!;
      const fk = years !== null ? FIT_LABEL[careerFit(j, years)] : "";
      print({
        kind: j.first_seen === today ? "hi" : "out",
        text: "",
        cols: [
          [String(L.shown + i + 1), 5],
          [j.first_seen.slice(5), 7],
          [SOURCE_LABELS[j.source] ?? j.source, 10],
          [fk, 11],
          [j.company, 18],
          [j.title, 0],
        ],
      });
    });
    L.shown += slice.length;
    if (L.shown < L.ids.length) print(dim(`-- ${L.ids.length - L.shown} more, type 'more' --`));
  }

  function listRooms() {
    if (rooms.length === 0) return print(dim("(empty)"));
    rooms.forEach((r, i) => {
      const locked = !isUnlocked(r);
      const count = locked ? "-" : String(jobs.filter((j) => !j.stale && roomHit(r, j, roomKnownToData(r, jobs))).length);
      print({
        kind: "out",
        text: "",
        cols: [[String(i + 1), 4], [locked ? "dr-x------" : "drwxr-xr-x", 12], [USER, 4], [count, 6], [r.created_at.slice(5), 7], [`${r.name}/`, 0]],
      });
    });
  }

  function findRoom(arg: string) {
    const n = Number(arg);
    if (Number.isInteger(n) && n >= 1 && n <= rooms.length) return rooms[n - 1];
    const a = arg.replace(/\/$/, "").toLowerCase();
    return rooms.find((r) => r.name.toLowerCase() === a || r.name.replace(/\s+/g, "-").toLowerCase() === a) ?? null;
  }

  function enterRoom(r: Room) {
    setCwd(r.id);
    listing.current = { ids: [], shown: 0, label: "" };
    const { roles, domains } = roomSummary(r);
    print(dim(`roles: ${roles.join(", ") || "-"}`));
    if (domains.length) print(dim(`domains: ${domains.join(", ")}`));
    if (r.keywords.length) print(dim(`keywords: ${r.keywords.join(", ")}`));
    if (r.career_start) print(dim(`career: ${careerLabel(r.career_start)} (since ${r.career_start})`));
  }

  async function cat(arg: string) {
    const n = Number(arg);
    const id = listing.current.ids[n - 1];
    const j = id ? jobById.get(id) : undefined;
    if (!j) return print(err(`cat: ${arg}: No such file`));
    const years = room?.career_start ? careerYears(room.career_start) : null;
    print(
      { kind: "hi", text: j.title },
      out(`company   ${j.company}`),
      out(`site      ${SOURCE_LABELS[j.source] ?? j.source}`),
      out(`location  ${j.location || "-"}`),
      out(`career    ${requiredText(j) || j.career || "-"}${years !== null ? `  [${FIT_LABEL[careerFit(j, years)]}]` : ""}`),
      out(`deadline  ${j.deadline || "-"}`),
      out(`added     ${j.first_seen}`),
      out(`url       ${j.url}`),
    );
    setBusy(true);
    try {
      const r = await fetch(`${base}/data/details/${safeName(j.id)}.json`, { cache: "no-store" });
      const d: Detail | null = r.ok ? await r.json() : null;
      if (d?.text) {
        print(dim(""));
        d.text.split("\n").forEach((t) => print(out(t)));
      } else {
        print(dim("(no body)"));
      }
    } catch {
      print(dim("(no body)"));
    } finally {
      setBusy(false);
    }
  }

  async function run(raw: string) {
    const cmd = raw.trim();
    print({ kind: "in", text: `${prompt} ${raw}` });
    if (!cmd) return;
    setHist((h) => [...h, cmd].slice(-200));
    const [name, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ");
    switch (name) {
      case "keys":
      case "shortcuts":
        KEYS.forEach((k) => print(out(k)));
        return;
      case "help":
        HELP.forEach((h) => print(out(h.replace("{period}", period))));
        return;
      case "clear":
        setLines([]);
        return;
      case "whoami":
        return print(out(USER));
      case "pwd":
        return print(out(dirName(room).replace("~", `/Users/${USER}`)));
      case "date":
        return print(out(new Date().toString()));
      case "history":
        return hist.forEach((h, i) => print(out(`${fit(String(i + 1), 5)}${h}`)));
      case "mode": {
        const m = arg === "main" || arg === "default" ? "default" : arg === "ref" ? "ref" : arg === "cli" ? "cli" : null;
        if (!m) return print(err("usage: mode main|ref|cli"));
        return setMode(m);
      }
      case "exit":
      case "logout":
        return setMode("default");
      case "period":
        if (!(arg in PERIODS)) return print(err(`usage: period today|7d|30d|all  (current: ${period})`));
        setPeriod(arg);
        return print(dim(`period=${arg}`));
      case "ls":
      case "ll":
        if (loading) return print(dim("loading..."));
        if (!room) return listRooms();
        listing.current = { ids: roomJobs(room).map((j) => j.id), shown: 0, label: room.name };
        return printPage();
      case "more":
      case "n":
        if (!listing.current.ids.length || listing.current.shown >= listing.current.ids.length) return print(dim("(end)"));
        return printPage();
      case "grep":
      case "find":
        if (!room) return print(err(`${name}: cd into a room first`));
        if (!arg) return print(err(`usage: ${name} <word>`));
        listing.current = { ids: roomJobs(room, arg).map((j) => j.id), shown: 0, label: `${room.name} | grep ${arg}` };
        return printPage();
      case "cd": {
        if (!arg || arg === "~" || arg === "..") {
          setCwd(null);
          listing.current = { ids: [], shown: 0, label: "" };
          return;
        }
        const r = findRoom(arg);
        if (!r) return print(err(`cd: no such file or directory: ${arg}`));
        if (!isUnlocked(r)) {
          setPwFor(r);
          return;
        }
        return enterRoom(r);
      }
      case "cat":
      case "less":
        if (!arg) return print(err(`usage: ${name} <n>`));
        return cat(arg);
      case "open": {
        const id = listing.current.ids[Number(arg) - 1];
        const j = id ? jobById.get(id) : undefined;
        if (!j) return print(err(`open: ${arg}: No such file`));
        window.open(j.url, "_blank", "noopener,noreferrer");
        return;
      }
      default:
        return print(err(`zsh: command not found: ${name}`));
    }
  }

  async function submitPassword(pw: string) {
    const r = pwFor;
    if (!r) return;
    print({ kind: "in", text: "Password:" });
    setPwFor(null);
    if (await checkPassword(r, pw)) {
      markUnlocked(r.id);
      enterRoom(r);
    } else {
      print(err("Sorry, try again."));
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = input;
      setInput("");
      setHi(-1);
      if (pwFor) submitPassword(v);
      else run(v);
    } else if (e.key === "ArrowUp" && !pwFor) {
      e.preventDefault();
      const i = hi === -1 ? hist.length - 1 : Math.max(0, hi - 1);
      if (hist[i] !== undefined) {
        setHi(i);
        setInput(hist[i]);
      }
    } else if (e.key === "ArrowDown" && !pwFor) {
      e.preventDefault();
      if (hi === -1) return;
      const i = hi + 1;
      if (i >= hist.length) {
        setHi(-1);
        setInput("");
      } else {
        setHi(i);
        setInput(hist[i]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    } else if (e.key === "c" && e.ctrlKey) {
      e.preventDefault();
      print({ kind: "in", text: `${pwFor ? "Password:" : prompt} ${input}^C` });
      setInput("");
      setPwFor(null);
    }
  }

  const color: Record<Line["kind"], string> = {
    in: "text-[#e5e5e5]",
    out: "text-[#cfcfcf]",
    dim: "text-[#7a7a7a]",
    err: "text-[#f87171]",
    hi: "text-[#86efac]",
  };

  return (
    <div className="flex h-svh flex-col bg-[#0c0c0c] font-mono text-[13px] leading-[1.45]">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-[#262626] bg-[#1a1a1a] px-3">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span className="flex-1 truncate text-center text-xs text-[#9a9a9a]">
          {USER} - zsh - {dirName(room)}
        </span>
        <ModeToggle variant="cli" />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2" onClick={() => inputRef.current?.focus()}>
        {lines.map((l, i) => (
          <div key={i} className={`whitespace-pre-wrap break-all ${color[l.kind]}`}>
            {l.cols
              ? l.cols.map(([t, w], k) =>
                  w ? (
                    <span key={k} className="inline-block overflow-hidden text-ellipsis whitespace-nowrap align-top" style={{ width: `${w}ch` }}>
                      {t}
                    </span>
                  ) : (
                    <span key={k}>{t}</span>
                  ),
                )
              : l.text || " "}
          </div>
        ))}
        <div className="flex text-[#e5e5e5]">
          <span className="whitespace-pre">{pwFor ? "Password: " : `${prompt} `}</span>
          <input
            ref={inputRef}
            autoFocus
            type={pwFor ? "password" : "text"}
            value={input}
            disabled={busy}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            className={`min-w-0 flex-1 bg-transparent caret-[#e5e5e5] outline-none ${pwFor ? "text-transparent" : ""}`}
          />
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
}
