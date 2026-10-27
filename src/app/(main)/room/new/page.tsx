"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { careerLabel, todayKST } from "@/lib/data";
import { ROOM_ICONS, RoomAvatar } from "@/lib/room-icons";
import { PRESETS, addRoom, hashPassword, loadGh, markUnlocked, newSalt, type Room } from "@/lib/rooms";

export default function NewRoomPage() {
  const router = useRouter();
  const [hasToken, setHasToken] = useState(true);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("briefcase");
  const [image, setImage] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);
  const [careerStart, setCareerStart] = useState("");
  const [lock, setLock] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setHasToken(Boolean(loadGh().token)), []);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const problems = [
    !name.trim() && "방 이름",
    roles.length === 0 && "직무 1개 이상",
    !careerStart && "경력 시작일",
    lock && (!pw || pw !== pw2) && "비밀번호 확인",
  ].filter(Boolean) as string[];

  async function onImage(f: File | undefined) {
    if (!f) return;
    try {
      setImage(await resizeImage(f, 128));
    } catch {
      setError("이미지를 읽지 못했습니다");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const salt = newSalt();
      const room: Room = {
        id: `r-${newSalt().slice(0, 10)}`,
        name: name.trim(),
        icon: image ? null : icon,
        image,
        created_at: todayKST(),
        roles,
        domains,
        keywords,
        exclude,
        career_start: careerStart,
        lock: lock ? { salt, hash: await hashPassword(salt, pw) } : null,
      };
      await addRoom(room);
      markUnlocked(room.id);
      router.push(`/room/?id=${encodeURIComponent(room.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-lg font-semibold">새 방 만들기</h1>
      {!hasToken && (
        <Card>
          <CardContent className="py-4 text-sm">
            방을 저장하려면 <Link href="/settings/" className="underline">설정</Link>에서 GitHub 토큰을 먼저 저장해야 합니다.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">이름과 아이콘</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <RoomAvatar icon={icon} image={image} className="size-14" />
            <Input
              placeholder="방 이름"
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ROOM_ICONS).map(([key, Icon]) => (
              <Button
                key={key}
                type="button"
                variant={!image && icon === key ? "default" : "outline"}
                size="icon"
                onClick={() => {
                  setImage(null);
                  setIcon(key);
                }}
              >
                <Icon />
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e.target.files?.[0])} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              이미지 업로드
            </Button>
            {image && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setImage(null)}>
                이미지 빼기
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">직무</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PRESETS.roles.map((r) => (
            <Button
              key={r.id}
              type="button"
              size="sm"
              variant={roles.includes(r.id) ? "default" : "outline"}
              onClick={() => toggle(roles, setRoles, r.id)}
            >
              {r.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">도메인</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {PRESETS.domains.map((d) => (
              <Button
                key={d.id}
                type="button"
                size="sm"
                variant={domains.includes(d.id) ? "default" : "outline"}
                onClick={() => toggle(domains, setDomains, d.id)}
              >
                {d.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">선택하지 않으면 도메인 구분 없이 직무만으로 모읍니다.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">키워드</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <TagInput label="추가 키워드" placeholder="예: 디지털 트윈, Kubernetes" values={keywords} onChange={setKeywords} />
          <TagInput label="제외 키워드" placeholder="예: 인턴, 계약직" values={exclude} onChange={setExclude} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">경력</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Label htmlFor="career">경력 시작일</Label>
          <Input
            id="career"
            type="date"
            className="w-[180px]"
            value={careerStart}
            max={todayKST()}
            onChange={(e) => setCareerStart(e.target.value)}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setCareerStart(todayKST())}>
            신입
          </Button>
          {careerStart && <span className="text-sm text-muted-foreground">{careerLabel(careerStart)}</span>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">잠금</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Checkbox id="lock" checked={lock} onCheckedChange={(v) => setLock(v === true)} />
            <Label htmlFor="lock">비밀번호로 잠그기</Label>
          </div>
          {lock && (
            <div className="flex flex-wrap gap-2">
              <Input type="password" placeholder="비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} className="max-w-[200px]" />
              <Input type="password" placeholder="비밀번호 확인" value={pw2} onChange={(e) => setPw2(e.target.value)} className="max-w-[200px]" />
              {pw2 && pw !== pw2 && <span className="self-center text-sm text-destructive">비밀번호가 다릅니다</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={busy || problems.length > 0 || !hasToken}>
          {busy ? "만드는 중" : "방 만들기"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {problems.length > 0 ? `필요: ${problems.join(", ")}` : "만든 뒤에는 수정할 수 없습니다"}
        </span>
      </div>
    </div>
  );
}

function TagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const items = text
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !values.includes(s));
    if (items.length) onChange([...values, ...items]);
    setText("");
  };
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
          className="max-w-sm"
        />
        <Button type="button" variant="outline" onClick={add} disabled={!text.trim()}>
          추가
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function resizeImage(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      // 가운데를 정사각형으로 잘라 축소
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}
