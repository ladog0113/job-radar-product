"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { CLI_COMMANDS, CLI_KEYS, GLOBAL_KEYS } from "@/lib/shortcuts";
import { useUiMode } from "@/lib/ui-mode";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const PAGE = 20;
const USER = "dd";
const HOST = "MacBook-Pro";
const PERIODS: Record<string, number | null> = { today: 0, "7d": 7, "30d": 30, all: null };

const COMMANDS = [
  "cat", "cd", "clear", "date", "exit", "find", "grep", "help", "history", "keys",
  "less", "ll", "logout", "ls", "mode", "more", "open", "period", "pwd", "shortcuts", "tree", "whoami",
];
const DIR_ARG = new Set(["cd", "ls", "ll", "tree"]);
const FILE_ARG = new Set(["cat", "less", "open"]);
const STATIC_ARG: Record<string, string[]> = {
  period: ["today", "7d", "30d", "all"],
  mode: ["main", "ref", "cli"],
};

type Line = { kind: "in" | "out" | "dim" | "err" | "hi"; text: string; cols?: [string, number][] };

// ---- 가상 폴더 ----
// /                      방 폴더
// /<방>/                  날짜 폴더 (YYYY-MM-DD)
// /<방>/<날짜>/           공고 파일 NN_회사명.txt

type RoomFs = { room: Room; slug: string; dates: string[]; byDate: Map<string, Job[]> };
type Node =
  | { kind: "root" }
  | { kind: "room"; r: RoomFs }
  | { kind: "date"; r: RoomFs; date: string }
  | { kind: "file"; r: RoomFs; date: string; job: Job; name: string };
type Resolved = Node | { kind: "error"; msg: "nf" | "locked" | "notdir"; room?: Room };

function slugOf(name: string) {
  return name.trim().replace(/\s+/g, "-").replace(/\//g, "_") || "room";
}
function fileName(job: Job, i: number) {
  const c =
    (job.company || "")
      .replace(/\[[^\]]*\]|\([^)]*\)|㈜|주식회사/g, "")
      .replace(/[^0-9A-Za-z가-힣&.\-]+/g, "")
      .slice(0, 16) || "untitled";
  return `${String(i + 1).padStart(2, "0")}_${c}.txt`;
}
function splitPath(cwd: string[], arg: string): string[] {
  const abs = arg.startsWith("/") || arg.startsWith("~");
  const parts = abs ? [] : [...cwd];
  for (const p of arg.replace(/^~/, "").split("/")) {
    if (!p || p === ".") continue;
    if (p === "..") parts.pop();
    else parts.push(p);
  }
  return parts;
}
const pathStr = (parts: string[]) => "/" + parts.join("/");

function commonPrefix(list: string[]) {
  if (!list.length) return "";
  let p = list[0];
  for (const s of list.slice(1)) {
    let i = 0;
    while (i < p.length && i < s.length && p[i].toLowerCase() === s[i].toLowerCase()) i++;
    p = p.slice(0, i);
  }
  return p;
}

export function CliApp() {
  const { setMode } = useUiMode();
  const { rooms } = useRooms();
  const { data: jobs, loading } = useJson<Job[]>("jobs.json", []);

  const [lines, setLines] = useState<Line[]>(() => [
    { kind: "dim", text: `Last login: ${new Date().toString().slice(0, 24)} on ttys001` },
    { kind: "dim", text: "help 또는 F1: 명령어와 단축키" },
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState<string[]>([]);
  const [period, setPeriod] = useState("30d");
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const [pw, setPw] = useState<{ room: Room; target: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(false);
  const [copied, setCopied] = useState(false);
  const listing = useRef<{ ids: string[]; names: string[]; shown: number; label: string; years: number | null }>({
    ids: [], names: [], shown: 0, label: "", years: null,
  });
  const cycle = useRef<{ start: string; typed: string; cands: string[]; idx: number } | null>(null);
  const shiftArmed = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // 방별 공고 (기간, 마감 추정, 10년 이상 제외) 를 날짜로 묶는다
  const fs = useMemo(() => {
    const days = PERIODS[period];
    const since = days === null ? "" : daysAgoKST(days);
    const used = new Map<string, number>();
    const list: RoomFs[] = rooms.map((room) => {
      let slug = slugOf(room.name);
      const n = (used.get(slug.toLowerCase()) ?? 0) + 1;
      used.set(slug.toLowerCase(), n);
      if (n > 1) slug = `${slug}-${n}`;
      const known = roomKnownToData(room, jobs);
      const years = room.career_start ? careerYears(room.career_start) : null;
      const hits = jobs
        .filter((j) => !j.stale && (!since || j.first_seen >= since))
        .filter((j) => years === null || careerFit(j, years) !== "over")
        .map((j) => ({ j, hit: roomHit(room, j, known) }))
        .filter((x) => x.hit)
        .sort((a, b) => b.hit!.score - a.hit!.score);
      const byDate = new Map<string, Job[]>();
      for (const { j } of hits) {
        if (!byDate.has(j.first_seen)) byDate.set(j.first_seen, []);
        byDate.get(j.first_seen)!.push(j);
      }
      return { room, slug, byDate, dates: [...byDate.keys()].sort().reverse() };
    });
    return list;
  }, [rooms, jobs, period]);

  const resolve = useCallback(
    (parts: string[], checkLock = true): Resolved => {
      if (parts.length === 0) return { kind: "root" };
      const r = fs.find((x) => x.slug.toLowerCase() === parts[0].toLowerCase());
      if (!r) return { kind: "error", msg: "nf" };
      if (checkLock && !isUnlocked(r.room)) return { kind: "error", msg: "locked", room: r.room };
      if (parts.length === 1) return { kind: "room", r };
      const date = r.dates.find((d) => d === parts[1]);
      if (!date) return { kind: "error", msg: "nf" };
      if (parts.length === 2) return { kind: "date", r, date };
      const list = r.byDate.get(date)!;
      const i = list.findIndex((j, k) => fileName(j, k).toLowerCase() === parts[2].toLowerCase());
      if (i < 0) return { kind: "error", msg: "nf" };
      if (parts.length > 3) return { kind: "error", msg: "notdir" };
      return { kind: "file", r, date, job: list[i], name: fileName(list[i], i) };
    },
    [fs],
  );

  // 자식 목록: [이름, 폴더 여부]
  const children = useCallback(
    (node: Resolved): [string, boolean][] => {
      if (node.kind === "root") return fs.map((r) => [r.slug, true]);
      if (node.kind === "room") return node.r.dates.map((d) => [d, true]);
      if (node.kind === "date") return node.r.byDate.get(node.date)!.map((j, i) => [fileName(j, i), false]);
      return [];
    },
    [fs],
  );

  // 경로가 사라졌으면 (방 삭제, 기간 변경) 가능한 곳까지 올라간다
  const cwdNode = resolve(cwd);
  useEffect(() => {
    if (cwdNode.kind === "error" && cwd.length) setCwd(cwd.slice(0, -1));
  }, [cwdNode.kind, cwd]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines, pw]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  // 다른 곳을 눌러 포커스가 빠져도 글자를 치면 입력줄로 돌아온다. F1 / Esc 는 도움말
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F1") {
        e.preventDefault();
        setPanel((v) => !v);
        return;
      }
      if (e.key === "Escape") setPanel(false);
      if (document.activeElement === inputRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length === 1 || e.key === "Enter" || e.key === "Tab") inputRef.current?.focus();
    }
    function onCopy() {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("copy", onCopy);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("copy", onCopy);
    };
  }, []);

  const where = pathStr(cwd);
  const prompt = `${USER}@${HOST} ${where} %`;

  function print(...ls: Line[]) {
    setLines((prev) => [...prev, ...ls].slice(-3000));
  }
  const out = (text: string) => ({ kind: "out" as const, text });
  const dim = (text: string) => ({ kind: "dim" as const, text });
  const err = (text: string) => ({ kind: "err" as const, text });

  function errFor(cmd: string, arg: string, r: Resolved) {
    if (r.kind !== "error") return;
    if (r.msg === "locked") print(err(`${cmd}: permission denied: ${arg}  (cd 로 들어가서 비밀번호 입력)`));
    else if (r.msg === "notdir") print(err(`${cmd}: not a directory: ${arg}`));
    else print(err(`${cmd}: no such file or directory: ${arg}`));
  }

  // ---- 출력 ----

  function printPage() {
    const L = listing.current;
    const today = todayKST();
    const slice = L.ids.slice(L.shown, L.shown + PAGE);
    if (L.shown === 0) {
      print(dim(`${L.label}  ${L.ids.length} files  period=${period}`));
      print({ kind: "dim", text: "", cols: [["#", 4], ["site", 10], ["fit", 11], ["file", 30], ["title", 0]] });
    }
    slice.forEach((id, i) => {
      const j = jobs.find((x) => x.id === id)!;
      const fk = L.years !== null ? FIT_LABEL[careerFit(j, L.years)] : "";
      print({
        kind: j.first_seen === today ? "hi" : "out",
        text: "",
        cols: [
          [String(L.shown + i + 1), 4],
          [SOURCE_LABELS[j.source] ?? j.source, 10],
          [fk, 11],
          [L.names[L.shown + i], 30],
          [j.title, 0],
        ],
      });
    });
    L.shown += slice.length;
    if (L.shown < L.ids.length) print(dim(`-- ${L.ids.length - L.shown} more, 'more' --`));
  }

  function ls(node: Resolved) {
    if (node.kind === "root") {
      if (!fs.length) return print(dim("(empty)"));
      fs.forEach((r, i) => {
        const locked = !isUnlocked(r.room);
        const count = locked ? "-" : String([...r.byDate.values()].reduce((n, l) => n + l.length, 0));
        print({
          kind: "out",
          text: "",
          cols: [[String(i + 1), 4], [locked ? "dr-x------" : "drwxr-xr-x", 12], [USER, 4], [count, 6], [r.room.created_at.slice(5), 7], [`${r.slug}/`, 0]],
        });
      });
      return;
    }
    if (node.kind === "room") {
      if (!node.r.dates.length) return print(dim(`(empty, period=${period})`));
      const today = todayKST();
      node.r.dates.forEach((d, i) =>
        print({
          kind: d === today ? "hi" : "out",
          text: "",
          cols: [[String(i + 1), 4], ["drwxr-xr-x", 12], [USER, 4], [String(node.r.byDate.get(d)!.length), 6], [`${d}/`, 0]],
        }),
      );
      return;
    }
    if (node.kind === "date") {
      const list = node.r.byDate.get(node.date)!;
      listing.current = {
        ids: list.map((j) => j.id),
        names: list.map((j, i) => fileName(j, i)),
        shown: 0,
        label: `/${node.r.slug}/${node.date}`,
        years: node.r.room.career_start ? careerYears(node.r.room.career_start) : null,
      };
      return printPage();
    }
    if (node.kind === "file") return print(out(node.name));
  }

  function tree(node: Resolved, label: string) {
    print(out(label));
    const draw = (items: { name: string; sub?: string[] }[], pad: string) =>
      items.forEach((it, i) => {
        const last = i === items.length - 1;
        print(out(`${pad}${last ? "└── " : "├── "}${it.name}`));
        it.sub?.forEach((s, k) => print(out(`${pad}${last ? "    " : "│   "}${k === it.sub!.length - 1 ? "└── " : "├── "}${s}`)));
      });
    if (node.kind === "root") {
      draw(
        fs.map((r) =>
          isUnlocked(r.room)
            ? { name: `${r.slug}/`, sub: r.dates.map((d) => `${d}/  (${r.byDate.get(d)!.length})`) }
            : { name: `${r.slug}/  (locked)` },
        ),
        "",
      );
    } else if (node.kind === "room") {
      draw(node.r.dates.map((d) => ({ name: `${d}/`, sub: node.r.byDate.get(d)!.map((j, i) => fileName(j, i)) })), "");
    } else if (node.kind === "date") {
      draw(node.r.byDate.get(node.date)!.map((j, i) => ({ name: fileName(j, i) })), "");
    }
  }

  function grep(word: string, node: Resolved) {
    const n = word.toLowerCase();
    const scope =
      node.kind === "root"
        ? fs.filter((r) => isUnlocked(r.room)).map((r) => ({ r, dates: r.dates }))
        : node.kind === "room"
          ? [{ r: node.r, dates: node.r.dates }]
          : node.kind === "date"
            ? [{ r: node.r, dates: [node.date] }]
            : [];
    const ids: string[] = [];
    const names: string[] = [];
    let years: number | null = null;
    for (const { r, dates } of scope) {
      years = years ?? (r.room.career_start ? careerYears(r.room.career_start) : null);
      for (const d of dates)
        r.byDate.get(d)!.forEach((j, i) => {
          if (j.title.toLowerCase().includes(n) || j.company.toLowerCase().includes(n)) {
            ids.push(j.id);
            names.push(node.kind === "date" ? fileName(j, i) : node.kind === "room" ? `${d}/${fileName(j, i)}` : `${r.slug}/${d}/${fileName(j, i)}`);
          }
        });
    }
    listing.current = { ids, names, shown: 0, label: `grep ${word} ${where}`, years };
    if (!ids.length) return print(dim("(no match)"));
    printPage();
  }

  async function cat(job: Job, years: number | null) {
    print(
      { kind: "hi", text: job.title },
      out(`company   ${job.company}`),
      out(`site      ${SOURCE_LABELS[job.source] ?? job.source}`),
      out(`location  ${job.location || "-"}`),
      out(`career    ${requiredText(job) || job.career || "-"}${years !== null ? `  [${FIT_LABEL[careerFit(job, years)]}]` : ""}`),
      out(`deadline  ${job.deadline || "-"}`),
      out(`added     ${job.first_seen}`),
      out(`url       ${job.url}`),
    );
    setBusy(true);
    try {
      const r = await fetch(`${base}/data/details/${safeName(job.id)}.json`, { cache: "no-store" });
      const d: Detail | null = r.ok ? await r.json() : null;
      if (d?.text) {
        print(dim(""));
        d.text.split("\n").forEach((t) => print(out(t)));
      } else print(dim("(no body)"));
    } catch {
      print(dim("(no body)"));
    } finally {
      setBusy(false);
    }
  }

  // 번호(마지막 목록 기준) 또는 경로로 파일 찾기
  function fileArg(cmd: string, arg: string): { job: Job; years: number | null } | null {
    if (/^\d+$/.test(arg)) {
      const id = listing.current.ids[Number(arg) - 1];
      const job = id ? jobs.find((j) => j.id === id) : undefined;
      if (!job) {
        print(err(`${cmd}: ${arg}: 마지막 목록에 없는 번호`));
        return null;
      }
      return { job, years: listing.current.years };
    }
    const node = resolve(splitPath(cwd, arg));
    if (node.kind === "file") return { job: node.job, years: node.r.room.career_start ? careerYears(node.r.room.career_start) : null };
    if (node.kind === "error") errFor(cmd, arg, node);
    else print(err(`${cmd}: ${arg}: is a directory`));
    return null;
  }

  function enter(target: string[]) {
    const node = resolve(target, false);
    setCwd(target);
    if (node.kind === "room" && cwd[0]?.toLowerCase() !== target[0].toLowerCase()) {
      const r = node.r.room;
      const { roles, domains } = roomSummary(r);
      print(dim(`roles: ${roles.join(", ") || "-"}`));
      if (domains.length) print(dim(`domains: ${domains.join(", ")}`));
      if (r.keywords.length) print(dim(`keywords: ${r.keywords.join(", ")}`));
      if (r.career_start) print(dim(`career: ${careerLabel(r.career_start)} (since ${r.career_start})`));
    }
  }

  function cd(arg: string) {
    let target: string[];
    if (!arg || arg === "~") target = [];
    else if (/^\d+$/.test(arg) && cwd.length < 2) {
      // 번호로 이동: / 에서는 방, 방 안에서는 날짜
      const kids = children(cwdNode);
      const k = kids[Number(arg) - 1];
      if (!k) return print(err(`cd: no such file or directory: ${arg}`));
      target = [...cwd, k[0]];
    } else target = splitPath(cwd, arg);
    // 이름 대소문자를 실제 폴더 이름으로 맞춘다
    const fixed: string[] = [];
    for (const p of target) {
      const kids = children(resolve(fixed, false));
      const hit = kids.find(([n]) => n.toLowerCase() === p.toLowerCase());
      fixed.push(hit ? hit[0] : p);
    }
    const node = resolve(fixed);
    if (node.kind === "error" && node.msg === "locked" && node.room) {
      // 잠긴 방: 비밀번호를 받고 나서 확인
      if (resolve(fixed, false).kind === "error") return print(err(`cd: no such file or directory: ${arg}`));
      setPw({ room: node.room, target: fixed });
      return;
    }
    if (node.kind === "error") return errFor("cd", arg, node);
    if (node.kind === "file") return print(err(`cd: not a directory: ${arg}`));
    enter(fixed);
  }

  function printHelp(withCommands: boolean) {
    const row = (k: string, v: string, w: number) => ({ kind: "out" as const, text: "", cols: [["  " + k, w], [v, 0]] as [string, number][] });
    if (withCommands) {
      print(dim("commands"));
      CLI_COMMANDS.forEach(([k, v]) => print(row(k, v, 22)));
      print(dim(""));
    }
    print(dim("keys (어느 모드에서나)"));
    GLOBAL_KEYS.forEach(([k, v]) => print(row(k, v, 22)));
    print(dim("keys (CLI)"));
    CLI_KEYS.forEach(([k, v]) => print(row(k, v, 22)));
  }

  async function run(raw: string) {
    const cmd = raw.trim();
    print({ kind: "in", text: `${prompt} ${raw}` });
    if (!cmd) return;
    setHist((h) => [...h, cmd].slice(-200));
    const [name, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ");
    switch (name) {
      case "help":
      case "?":
        return printHelp(true);
      case "keys":
      case "shortcuts":
        return printHelp(false);
      case "clear":
        return setLines([]);
      case "whoami":
        return print(out(USER));
      case "pwd":
        return print(out(where));
      case "date":
        return print(out(new Date().toString()));
      case "history":
        return hist.forEach((h, i) => print({ kind: "out", text: "", cols: [[String(i + 1), 5], [h, 0]] }));
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
      case "ll": {
        if (loading) return print(dim("loading..."));
        const node = arg ? resolve(splitPath(cwd, arg)) : cwdNode;
        if (node.kind === "error") return errFor(name, arg || where, node);
        return ls(node);
      }
      case "tree": {
        const parts = arg ? splitPath(cwd, arg) : cwd;
        const node = resolve(parts);
        if (node.kind === "error") return errFor("tree", arg || where, node);
        return tree(node, arg || ".");
      }
      case "more":
      case "n":
        if (!listing.current.ids.length || listing.current.shown >= listing.current.ids.length) return print(dim("(end)"));
        return printPage();
      case "grep":
      case "find":
        if (!arg) return print(err(`usage: ${name} <word>`));
        return grep(arg, cwdNode);
      case "cd":
        return cd(arg);
      case "cat":
      case "less": {
        if (!arg) return print(err(`usage: ${name} <file|n>`));
        const f = fileArg(name, arg);
        if (f) await cat(f.job, f.years);
        return;
      }
      case "open": {
        if (!arg) return print(err("usage: open <file|n>"));
        const f = fileArg("open", arg);
        if (f) window.open(f.job.url, "_blank", "noopener,noreferrer");
        return;
      }
      default:
        return print(err(`zsh: command not found: ${name}`));
    }
  }

  async function submitPassword(v: string) {
    const p = pw;
    if (!p) return;
    print({ kind: "in", text: "Password:" });
    setPw(null);
    if (await checkPassword(p.room, v)) {
      markUnlocked(p.room.id);
      enter(p.target);
    } else print(err("Sorry, try again."));
  }

  // ---- 자동완성 ----

  function candidates(text: string): { start: number; token: string; cands: string[]; isCmd: boolean } {
    const sp = text.lastIndexOf(" ");
    if (sp < 0 || !text.slice(0, sp).trim()) {
      const token = text.trimStart();
      const start = text.length - token.length;
      return { start, token, cands: COMMANDS.filter((c) => c.startsWith(token.toLowerCase())), isCmd: true };
    }
    const cmd = text.trim().split(/\s+/)[0];
    const token = text.slice(sp + 1);
    const start = sp + 1;
    if (STATIC_ARG[cmd]) return { start, token, cands: STATIC_ARG[cmd].filter((o) => o.startsWith(token)), isCmd: false };
    if (!DIR_ARG.has(cmd) && !FILE_ARG.has(cmd)) return { start, token, cands: [], isCmd: false };
    const slash = token.lastIndexOf("/");
    const dirPart = slash >= 0 ? token.slice(0, slash + 1) : "";
    const prefix = (slash >= 0 ? token.slice(slash + 1) : token).toLowerCase();
    const node = resolve(dirPart ? splitPath(cwd, dirPart) : cwd);
    const kids = node.kind === "error" ? [] : children(node);
    const cands = kids
      .filter(([n, dir]) => (DIR_ARG.has(cmd) ? dir : true) && n.toLowerCase().startsWith(prefix))
      .map(([n, dir]) => dirPart + n + (dir ? "/" : ""));
    return { start, token, cands, isCmd: false };
  }

  const suggestion = useMemo(() => {
    if (pw || !input) return "";
    const c = candidates(input);
    if (!c.cands.length) return "";
    const full = c.cands[0];
    if (!full.toLowerCase().startsWith(c.token.toLowerCase()) || full.length <= c.token.length) return "";
    return full.slice(c.token.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, pw, fs, cwd]);

  function apply(text: string, start: number, value: string, finalize: boolean) {
    const next = text.slice(0, start) + value + (finalize && !value.endsWith("/") ? " " : "");
    setInput(next);
    return next;
  }

  function complete() {
    if (pw) return;
    const cy = cycle.current;
    if (cy && cy.cands.length > 1 && input === (cy.idx < 0 ? cy.typed : cy.start + cy.cands[cy.idx])) {
      // 같은 자리에서 다시 누르면 후보를 돌아가며 채운다
      const idx = (cy.idx + 1) % cy.cands.length;
      cycle.current = { ...cy, idx };
      setInput(cy.start + cy.cands[idx]);
      return;
    }
    const c = candidates(input);
    if (!c.cands.length) return;
    if (c.cands.length === 1) {
      cycle.current = null;
      apply(input, c.start, c.cands[0], true);
      return;
    }
    const common = commonPrefix(c.cands);
    if (common.length > c.token.length) {
      cycle.current = null;
      apply(input, c.start, c.cands[0].slice(0, common.length), false);
      return;
    }
    // 후보 목록을 보여주고, 한 번 더 누르면 첫 후보부터 돌아가며 채운다
    const names = c.cands.map((s) => s.replace(/\/$/, "").split("/").pop() + (s.endsWith("/") ? "/" : ""));
    print({ kind: "in", text: `${prompt} ${input}` }, dim(names.join("   ")));
    cycle.current = { start: input.slice(0, c.start), typed: input, cands: c.cands, idx: -1 };
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Shift") {
      shiftArmed.current = !e.repeat;
      return;
    }
    shiftArmed.current = false;
    if (e.key === "Tab") {
      e.preventDefault();
      complete();
      return;
    }
    cycle.current = null;
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.nativeEvent.isComposing) return;
      const v = input;
      setInput("");
      setHi(-1);
      if (pw) submitPassword(v);
      else run(v);
    } else if (e.key === "ArrowRight" && suggestion && e.currentTarget.selectionStart === input.length) {
      e.preventDefault();
      setInput(input + suggestion);
    } else if (e.key === "ArrowUp" && !pw) {
      e.preventDefault();
      const i = hi === -1 ? hist.length - 1 : Math.max(0, hi - 1);
      if (hist[i] !== undefined) {
        setHi(i);
        setInput(hist[i]);
      }
    } else if (e.key === "ArrowDown" && !pw) {
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
      const el = e.currentTarget;
      if (el.selectionStart !== el.selectionEnd) return; // 선택한 글자는 복사
      e.preventDefault();
      print({ kind: "in", text: `${pw ? "Password:" : prompt} ${pw ? "" : input}^C` });
      setInput("");
      setPw(null);
    }
  }

  function onKeyUp(e: React.KeyboardEvent<HTMLInputElement>) {
    // Shift만 눌렀다 떼면 자동완성 (Shift+글자 입력은 제외)
    if (e.key === "Shift" && shiftArmed.current) {
      shiftArmed.current = false;
      complete();
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
          {USER} - zsh - {where}
        </span>
        <button
          type="button"
          onClick={() => setPanel((v) => !v)}
          className={`text-xs ${panel ? "text-[#e5e5e5]" : "text-[#6b6b6b] hover:text-[#a3a3a3]"}`}
        >
          ? help
        </button>
        <ModeToggle variant="cli" />
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className="min-w-0 flex-1 select-text overflow-y-auto px-3 py-2"
          onMouseUp={() => {
            if (!window.getSelection()?.toString()) inputRef.current?.focus();
          }}
        >
          {lines.map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap break-all ${color[l.kind]}`}>
              {l.cols
                ? l.cols.map(([t, w], k) =>
                    w ? (
                      <span key={k} className="inline-block overflow-hidden text-ellipsis whitespace-pre align-top" style={{ width: `${w}ch` }}>
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
            <span className="whitespace-pre">{pw ? "Password: " : `${prompt} `}</span>
            <div className="relative min-w-0 flex-1">
              {!pw && suggestion && (
                <div className="pointer-events-none absolute inset-0 whitespace-pre text-[#5a5a5a]">
                  <span className="invisible">{input}</span>
                  {suggestion}
                </div>
              )}
              <input
                ref={inputRef}
                autoFocus
                type={pw ? "password" : "text"}
                value={input}
                disabled={busy}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                onChange={(e) => {
                  setInput(e.target.value);
                  cycle.current = null;
                }}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                className={`relative w-full bg-transparent caret-[#e5e5e5] outline-none ${pw ? "text-transparent" : ""}`}
              />
            </div>
          </div>
          <div ref={endRef} />
        </div>

        {panel && (
          <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-[#262626] bg-[#111] px-4 py-3 text-xs text-[#cfcfcf] md:block">
            <div className="mb-2 flex items-center justify-between text-[#7a7a7a]">
              <span>help</span>
              <button type="button" onClick={() => setPanel(false)} className="hover:text-[#e5e5e5]">
                close (Esc)
              </button>
            </div>
            <HelpBlock title="commands" rows={CLI_COMMANDS} />
            <HelpBlock title="keys (어느 모드에서나)" rows={GLOBAL_KEYS} />
            <HelpBlock title="keys (CLI)" rows={CLI_KEYS} />
          </aside>
        )}
      </div>

      <div className="flex h-6 shrink-0 items-center gap-4 overflow-hidden whitespace-nowrap border-t border-[#262626] bg-[#1a1a1a] px-3 text-[11px] text-[#8a8a8a]">
        <span><b className="font-normal text-[#d4d4d4]">Tab/Shift</b> 자동완성</span>
        <span><b className="font-normal text-[#d4d4d4]">→</b> 제안 적용</span>
        <span><b className="font-normal text-[#d4d4d4]">↑↓</b> 이전 명령</span>
        <span><b className="font-normal text-[#d4d4d4]">^L</b> 지우기</span>
        <span><b className="font-normal text-[#d4d4d4]">^C</b> 취소</span>
        <span><b className="font-normal text-[#d4d4d4]">F1</b> 도움말</span>
        <span className="ml-auto">{copied ? "copied" : `period=${period}`}</span>
      </div>
    </div>
  );
}

function HelpBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-[#7a7a7a]">{title}</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-3 py-0.5">
          <span className="w-[120px] shrink-0 text-[#e5e5e5]">{k}</span>
          <span className="text-[#a3a3a3]">{v}</span>
        </div>
      ))}
    </div>
  );
}
