"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { checkPassword, type Room } from "@/lib/rooms";

export function PasswordDialog({
  room,
  title,
  open,
  onOpenChange,
  onOk,
}: {
  room: Room;
  title: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOk: () => void;
}) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (await checkPassword(room, pw)) {
      setPw("");
      setError(null);
      onOk();
    } else {
      setError("비밀번호가 맞지 않습니다");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setPw("");
          setError(null);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-2"
        >
          <Input type="password" autoFocus placeholder="비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} />
          {error && <div className="text-sm text-destructive">{error}</div>}
          <DialogFooter>
            <Button type="submit" disabled={!pw}>
              확인
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
