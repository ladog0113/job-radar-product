"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

import { MockShot } from "@/components/ref/mock-shot";
import { Button } from "@/components/ui/button";
import { careerFit, careerYears, daysAgoKST, jobHref, todayKST, useJson, type Job } from "@/lib/data";
import { disguiseTitle } from "@/lib/disguise";
import { RoomAvatar } from "@/lib/room-icons";
import { roomHit, roomKnownToData, type Room, type RoomHit } from "@/lib/rooms";
import { cn } from "@/lib/utils";

const PERIODS: [string, string, number | null][] = [
  ["today", "Today", 0],
  ["7d", "This week", 7],
  ["30d", "This month", 30],
  ["all", "All time", null],
];

const PAGE = 48;

export function RefBackLink() {
  return (
    <Link href="/" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Collections
    </Link>
  );
}

export function RefRoom({ room }: { room: Room }) {
  const { data: jobs, loading, error } = useJson<Job[]>("jobs.json", []);
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("7d");
  const [limit, setLimit] = useState(PAGE);
  const years = room.career_start ? careerYears(room.career_start) : null;
  const today = todayKST();

  const items = useMemo(() => {
    const known = roomKnownToData(room, jobs);
    const out: { job: Job; hit: RoomHit }[] = [];
    for (const j of jobs) {
      if (j.stale) continue;
      if (years !== null && careerFit(j, years) === "over") continue;
      const hit = roomHit(room, j, known);
      if (hit) out.push({ job: j, hit });
    }
    return out;
  }, [room, jobs, years]);

  const filtered = useMemo(() => {
    const days = PERIODS.find((p) => p[0] === period)?.[2] ?? null;
    const since = days === null ? "" : daysAgoKST(days);
    const needle = q.trim().toLowerCase();
    return items
      .filter(({ job: j }) => !since || j.first_seen >= since)
      .filter(({ job: j }) => !needle || j.title.toLowerCase().includes(needle) || j.company.toLowerCase().includes(needle))
      .sort((a, b) =>
        a.job.first_seen === b.job.first_seen ? b.hit.score - a.hit.score : a.job.first_seen < b.job.first_seen ? 1 : -1,
      );
  }, [items, period, q]);

  return (
    <div className="flex flex-col gap-6">
      <RefBackLink />
      <div className="flex flex-wrap items-center gap-3">
        <RoomAvatar icon={room.icon} image={room.image} className="size-10" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{room.name}</h1>
          <div className="text-sm text-muted-foreground">{items.length} shots</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {PERIODS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setPeriod(k);
                setLimit(PAGE);
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition-colors",
                period === k ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex h-9 w-full items-center gap-2 rounded-full bg-muted px-3 sm:w-64">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading</div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">No shots</div>
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.slice(0, limit).map(({ job: j }) => (
            <Link key={j.id} href={jobHref(j.id, room.id)} className="group min-w-0">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                <MockShot seed={j.id} className="size-full transition-transform duration-300 group-hover:scale-[1.03]" />
                {j.first_seen === today && (
                  <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium">New</span>
                )}
              </div>
              <div className="mt-3 truncate text-sm font-medium">{j.company || "Untitled"}</div>
              <div className="truncate text-xs text-muted-foreground">{disguiseTitle(j.title, j.id)}</div>
            </Link>
          ))}
        </div>
      )}

      {filtered.length > limit && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit(limit + PAGE)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
