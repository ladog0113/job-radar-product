"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Plus, Trash2 } from "lucide-react";

import { PasswordDialog } from "@/components/rooms/password-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { careerLabel, useJson, type Job } from "@/lib/data";
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

export default function LobbyPage() {
  const router = useRouter();
  const { rooms, loading, error, reload } = useRooms();
  const { data: jobs } = useJson<Job[]>("jobs.json", []);
  const [unlocking, setUnlocking] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const [deletePwOk, setDeletePwOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const room of rooms) {
      const known = roomKnownToData(room, jobs);
      out[room.id] = jobs.filter((j) => !j.stale && roomHit(room, j, known)).length;
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">방 목록</h1>
        <Button asChild>
          <Link href="/room/new/">
            <Plus /> 새 방 만들기
          </Link>
        </Button>
      </div>

      {error && <div className="text-sm text-destructive">방 목록을 불러오지 못했습니다 ({error})</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">불러오는 중</div>
      ) : rooms.length === 0 && !error ? (
        <div className="text-sm text-muted-foreground">만들어진 방이 없습니다</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const locked = !isUnlocked(room);
            return (
              <Card key={room.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => enter(room)}>
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <RoomAvatar icon={room.icon} image={room.image} className="size-12" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold">{room.name}</span>
                        {room.lock && <Lock className="size-3.5 shrink-0 text-muted-foreground" />}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {locked ? "잠김" : `공고 ${counts[room.id] ?? 0}건`}
                        {room.career_start && ` / 경력 ${careerLabel(room.career_start)}`}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionError(null);
                        setDeletePwOk(!room.lock);
                        setDeleting(room);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">{room.created_at} 생성</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {unlocking && (
        <PasswordDialog
          room={unlocking}
          title={`${unlocking.name} 잠금 해제`}
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
          title={`${deleting.name} 삭제: 비밀번호 확인`}
          open
          onOpenChange={(v) => !v && setDeleting(null)}
          onOk={() => setDeletePwOk(true)}
        />
      )}

      <Dialog open={!!deleting && deletePwOk} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>방 삭제</DialogTitle>
            <DialogDescription>
              {deleting?.name} 방을 삭제합니다. 이 방의 검색어는 다음 수집부터 빠지고, 삭제한 방은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          {actionError && <div className="text-sm text-destructive">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>
              취소
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy ? "삭제 중" : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
