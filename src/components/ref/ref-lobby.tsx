"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Plus, Trash2 } from "lucide-react";

import { MockShot } from "@/components/ref/mock-shot";
import { PasswordDialog } from "@/components/rooms/password-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useJson, type Job } from "@/lib/data";
import { RoomAvatar } from "@/lib/room-icons";
import {
  deleteRoom,
  isUnlocked,
  markUnlocked,
  roomHit,
  roomKnownToData,
  useRooms,
  type Room,
} from "@/lib/rooms";

export function RefLobby() {
  const router = useRouter();
  const { rooms, loading, error, reload } = useRooms();
  const { data: jobs } = useJson<Job[]>("jobs.json", []);
  const [unlocking, setUnlocking] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const [deletePwOk, setDeletePwOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const info = useMemo(() => {
    const out: Record<string, { count: number; seeds: string[] }> = {};
    for (const room of rooms) {
      const known = roomKnownToData(room, jobs);
      const list = jobs.filter((j) => !j.stale && roomHit(room, j, known));
      out[room.id] = { count: list.length, seeds: list.slice(0, 3).map((j) => j.id) };
    }
    return out;
  }, [rooms, jobs]);

  function enter(room: Room) {
    if (isUnlocked(room)) router.push(`/room/?id=${encodeURIComponent(room.id)}`);
    else setUnlocking(room);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteRoom(deleting.id);
      setDeleting(null);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/room/new/">
            <Plus /> New collection
          </Link>
        </Button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading</div>
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rooms.map((room) => {
            const locked = !isUnlocked(room);
            const it = info[room.id] ?? { count: 0, seeds: [] };
            const seeds = [0, 1, 2].map((i) => (locked ? `${room.id}:${i}` : it.seeds[i] ?? `${room.id}:${i}`));
            return (
              <div key={room.id} className="group min-w-0 cursor-pointer" onClick={() => enter(room)}>
                <div className="grid aspect-[4/3] grid-cols-3 grid-rows-2 gap-1 overflow-hidden rounded-xl bg-muted">
                  <MockShot seed={seeds[0]} className="col-span-2 row-span-2 size-full" />
                  <MockShot seed={seeds[1]} className="size-full" />
                  <MockShot seed={seeds[2]} className="size-full" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <RoomAvatar icon={room.icon} image={room.image} className="size-6" />
                  <span className="truncate text-sm font-medium">{room.name}</span>
                  {room.lock && <Lock className="size-3 shrink-0 text-muted-foreground" />}
                  <button
                    type="button"
                    className="ml-auto text-muted-foreground/50 hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionError(null);
                      setDeletePwOk(!room.lock);
                      setDeleting(room);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {locked ? "Private" : `${it.count} shots`} / {room.created_at}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unlocking && (
        <PasswordDialog
          room={unlocking}
          title={unlocking.name}
          open
          onOpenChange={(v) => !v && setUnlocking(null)}
          onOk={() => {
            markUnlocked(unlocking.id);
            const id = unlocking.id;
            setUnlocking(null);
            router.push(`/room/?id=${encodeURIComponent(id)}`);
          }}
        />
      )}

      {deleting && deleting.lock && !deletePwOk && (
        <PasswordDialog
          room={deleting}
          title={deleting.name}
          open
          onOpenChange={(v) => !v && setDeleting(null)}
          onOk={() => setDeletePwOk(true)}
        />
      )}

      <Dialog open={!!deleting && deletePwOk} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete collection</DialogTitle>
            <DialogDescription>{deleting?.name} 컬렉션을 삭제합니다. 되돌릴 수 없습니다.</DialogDescription>
          </DialogHeader>
          {actionError && <div className="text-sm text-destructive">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy ? "Deleting" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
