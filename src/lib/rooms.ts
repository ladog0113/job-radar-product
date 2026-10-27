"use client";

import { useCallback, useEffect, useState } from "react";

import presetsJson from "./presets.json";
import type { Job } from "./data";

// ---- 프리셋 (수집기와 같은 파일) ----

export type Preset = { id: string; label: string; terms: string[]; not_terms?: string[]; q: string[]; en: string[] };
export const PRESETS = presetsJson as { roles: Preset[]; domains: Preset[]; hard_exclude: string[] };
export const ROLE_BY_ID = Object.fromEntries(PRESETS.roles.map((r) => [r.id, r]));
export const DOMAIN_BY_ID = Object.fromEntries(PRESETS.domains.map((d) => [d.id, d]));

// ---- 방 ----

export type Room = {
  id: string;
  name: string;
  icon: string | null;
  image: string | null; // data URL
  created_at: string;
  roles: string[];
  domains: string[];
  keywords: string[];
  exclude: string[];
  career_start: string | null;
  lock: { salt: string; hash: string } | null;
};

type RoomsFile = { rooms: Room[] };

// ---- GitHub 저장소 (방 목록은 저장소의 rooms/rooms.json) ----

const GH_KEY = "jr_github";

export type GhSettings = { token: string; repo: string };

export function detectRepo(): string {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const m = host.match(/^([^.]+)\.github\.io$/);
  const first = window.location.pathname.split("/").filter(Boolean)[0];
  if (m && first) return `${m[1]}/${first}`;
  return process.env.NEXT_PUBLIC_GH_REPO || "";
}

export function loadGh(): GhSettings {
  try {
    const raw = localStorage.getItem(GH_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      return { token: v.token || "", repo: v.repo || detectRepo() };
    }
  } catch {}
  return { token: "", repo: detectRepo() };
}

export function saveGh(s: GhSettings) {
  try {
    localStorage.setItem(GH_KEY, JSON.stringify(s));
  } catch {}
}

const API = "https://api.github.com";
const ROOMS_PATH = "rooms/rooms.json";

function ghHeaders(token: string, raw = false) {
  const h: Record<string, string> = {
    Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghError(r: Response) {
  try {
    const j = await r.json();
    return `GitHub ${r.status}: ${j.message ?? ""}`;
  } catch {
    return `GitHub ${r.status}`;
  }
}

export async function checkGh(s: GhSettings) {
  const r = await fetch(`${API}/repos/${s.repo}`, { headers: ghHeaders(s.token) });
  if (!r.ok) throw new Error(await ghError(r));
  const j = await r.json();
  if (!j.permissions?.push) throw new Error("이 토큰으로는 저장소에 쓸 수 없습니다 (Contents 쓰기 권한 필요)");
  return j.full_name as string;
}

async function readRoomsFile(s: GhSettings): Promise<{ data: RoomsFile; sha: string | null }> {
  const r = await fetch(`${API}/repos/${s.repo}/contents/${ROOMS_PATH}?ref=main&t=${Date.now()}`, {
    headers: ghHeaders(s.token),
    cache: "no-store",
  });
  if (r.status === 404) return { data: { rooms: [] }, sha: null };
  if (!r.ok) throw new Error(await ghError(r));
  const j = await r.json();
  const text = new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
  return { data: JSON.parse(text), sha: j.sha };
}

async function writeRoomsFile(s: GhSettings, data: RoomsFile, sha: string | null, message: string) {
  const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2) + "\n");
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const r = await fetch(`${API}/repos/${s.repo}/contents/${ROOMS_PATH}`, {
    method: "PUT",
    headers: { ...ghHeaders(s.token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: btoa(bin), sha: sha ?? undefined, branch: "main" }),
  });
  if (!r.ok) throw new Error(await ghError(r));
}

export async function addRoom(room: Room) {
  const s = loadGh();
  if (!s.token) throw new Error("설정에서 GitHub 토큰을 먼저 저장하세요");
  const { data, sha } = await readRoomsFile(s);
  data.rooms.push(room);
  await writeRoomsFile(s, data, sha, `room: ${room.name} 생성`);
  await dispatchCrawl(s).catch(() => {});
}

export async function deleteRoom(id: string) {
  const s = loadGh();
  if (!s.token) throw new Error("설정에서 GitHub 토큰을 먼저 저장하세요");
  const { data, sha } = await readRoomsFile(s);
  const room = data.rooms.find((r) => r.id === id);
  data.rooms = data.rooms.filter((r) => r.id !== id);
  await writeRoomsFile(s, data, sha, `room: ${room?.name ?? id} 삭제`);
}

/** 방을 만든 직후 수집을 바로 한 번 돌린다 (토큰에 Actions 쓰기 권한이 있을 때) */
export async function dispatchCrawl(s: GhSettings) {
  const r = await fetch(`${API}/repos/${s.repo}/actions/workflows/daily.yml/dispatches`, {
    method: "POST",
    headers: { ...ghHeaders(s.token), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main" }),
  });
  if (!r.ok) throw new Error(await ghError(r));
}

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    readRoomsFile(loadGh())
      .then(({ data }) => setRooms(data.rooms))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload]);
  return { rooms, loading, error, reload };
}

// ---- 잠금 (화면 잠금. 저장소가 공개라 방 설정 자체를 숨기지는 못함) ----

export function newSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(salt: string, password: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function checkPassword(room: Room, password: string) {
  if (!room.lock) return true;
  return (await hashPassword(room.lock.salt, password)) === room.lock.hash;
}

const UNLOCK_KEY = "jr_unlocked";

export function isUnlocked(room: Room) {
  if (!room.lock) return true;
  try {
    return (JSON.parse(sessionStorage.getItem(UNLOCK_KEY) || "[]") as string[]).includes(room.id);
  } catch {
    return false;
  }
}

export function markUnlocked(id: string) {
  try {
    const list = JSON.parse(sessionStorage.getItem(UNLOCK_KEY) || "[]") as string[];
    if (!list.includes(id)) sessionStorage.setItem(UNLOCK_KEY, JSON.stringify([...list, id]));
  } catch {}
}

// ---- 공고 판정 (수집기 crawler/rooms.py 와 같은 규칙, 웹에서는 제목만) ----

function pattern(term: string) {
  const t = term.toLowerCase();
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (/^[a-z0-9 ./+\-]+$/.test(t)) return new RegExp(`(?<![a-z])${esc}(?![a-z])`);
  return new RegExp(esc);
}
const cache = new Map<string, RegExp>();
function hit(term: string, text: string) {
  let p = cache.get(term);
  if (!p) cache.set(term, (p = pattern(term)));
  return p.test(text);
}
const any = (terms: string[], text: string) => terms.some((t) => hit(t, text));

export type RoomHit = { domains: string[]; score: number; by_detail?: boolean };

export function matchRoomTitle(room: Room, title: string): RoomHit | null {
  const t = title.toLowerCase();
  if (any(PRESETS.hard_exclude, t) || any(room.exclude, t)) return null;
  const roleOk = room.roles.some((id) => {
    const r = ROLE_BY_ID[id];
    return r && any(r.terms, t) && !any(r.not_terms ?? [], t);
  });
  if (!roleOk) return null;
  const domains = room.domains.map((d) => DOMAIN_BY_ID[d]).filter(Boolean);
  if (!domains.length && !room.keywords.length) return { domains: [], score: 50 };
  const dom = domains.filter((d) => any(d.terms, t)).map((d) => d.label);
  const kw = room.keywords.filter((k) => hit(k, t));
  if (dom.length || kw.length) return { domains: dom, score: 60 + 10 * dom.length + 10 * kw.length };
  return null;
}

/** 수집기가 이미 판정한 결과를 쓰고, 아직 수집기가 모르는 새 방이면 제목으로 바로 판정 */
export function roomHit(room: Room, job: Job, roomKnown: boolean): RoomHit | null {
  if (roomKnown) return job.room_hits?.[room.id] ?? null;
  return matchRoomTitle(room, job.title);
}

export function roomKnownToData(room: Room, jobs: Job[]) {
  return jobs.some((j) => j.room_hits && room.id in j.room_hits);
}

export function roomSummary(room: Room) {
  return {
    roles: room.roles.map((r) => ROLE_BY_ID[r]?.label ?? r),
    domains: room.domains.map((d) => DOMAIN_BY_ID[d]?.label ?? d),
  };
}
