"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import { MockShot } from "@/components/ref/mock-shot";
import { safeName, useJson, type Detail, type Job } from "@/lib/data";
import { disguiseTitle } from "@/lib/disguise";
import { isUnlocked, useRooms } from "@/lib/rooms";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function RefJob({ id, roomId }: { id: string; roomId: string }) {
  const { rooms } = useRooms();
  const room = rooms.find((r) => r.id === roomId);
  const { data: jobs, loading } = useJson<Job[]>("jobs.json", []);
  const job = jobs.find((j) => j.id === id);
  const [notes, setNotes] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${base}/data/details/${safeName(id)}.json`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Detail | null) => setNotes(d?.text ?? null))
      .catch(() => setNotes(null));
  }, [id]);

  const back = room ? `/room/?id=${encodeURIComponent(room.id)}` : "/";
  const backLink = (
    <Link href={back} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> {room?.name ?? "Collections"}
    </Link>
  );

  if (loading) return <div className="text-sm text-muted-foreground">Loading</div>;
  if (room && !isUnlocked(room))
    return (
      <div className="flex flex-col gap-3">
        {backLink}
        <div className="text-sm text-muted-foreground">Private</div>
      </div>
    );
  if (!job)
    return (
      <div className="flex flex-col gap-3">
        {backLink}
        <div className="text-sm text-muted-foreground">Not found</div>
      </div>
    );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {backLink}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{job.company || "Untitled"}</h1>
        <div className="mt-1 text-muted-foreground">{disguiseTitle(job.title, job.id)}</div>
      </div>
      <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
        <MockShot seed={job.id} className="size-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <Meta label="Added" value={job.first_seen} />
        <Meta label="Location" value={job.location || "-"} />
        <Meta label="Until" value={job.deadline || "-"} />
        <div>
          <div className="text-xs text-muted-foreground">Source</div>
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
            Open <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
      {notes && (
        <div className="border-t pt-4">
          <button type="button" className="text-sm font-medium" onClick={() => setOpen(!open)}>
            {open ? "Hide notes" : "Notes"}
          </button>
          {open && <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{notes}</div>}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate">{value}</div>
    </div>
  );
}
