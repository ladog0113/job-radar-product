"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PasswordDialog } from "@/components/rooms/password-dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SOURCE_LABELS,
  daysAgoKST,
  todayKST,
  useJson,
  jobHref,
  careerFit,
  careerLabel,
  careerYears,
  requiredText,
  FIT_LABEL,
  companyRating,
  type Company,
  type FitKey,
  type Job,
  type Run,
} from "@/lib/data";
import { RoomAvatar } from "@/lib/room-icons";
import {
  isUnlocked,
  markUnlocked,
  roomHit,
  roomKnownToData,
  roomSummary,
  useRooms,
  type Room,
  type RoomHit,
} from "@/lib/rooms";

const PERIODS: Record<string, number | null> = {
  today: 0,
  "7d": 7,
  "30d": 30,
  all: null,
};

const PAGE = 50;

// 연차 필터: 값 = 보여줄 적합도 목록
const FIT_FILTERS: Record<string, FitKey[] | null> = {
  no_over: ["fit", "stretch", "hard", "under", "unknown"],
  fit: ["fit"],
  fit_stretch: ["fit", "stretch"],
  all: null,
};

const FIT_VARIANT: Record<FitKey, "default" | "secondary" | "outline" | "destructive"> = {
  fit: "default",
  stretch: "secondary",
  hard: "outline",
  over: "destructive",
  under: "outline",
  unknown: "outline",
};

export default function RoomPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">불러오는 중</div>}>
      <RoomGate />
    </Suspense>
  );
}

function RoomGate() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { rooms, loading, error } = useRooms();
  const room = rooms.find((r) => r.id === id);
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    if (room) setUnlocked(isUnlocked(room));
  }, [room]);

  if (loading) return <div className="text-sm text-muted-foreground">불러오는 중</div>;
  if (error) return <div className="text-sm text-destructive">방 목록을 불러오지 못했습니다 ({error})</div>;
  if (!room)
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <div className="text-sm text-muted-foreground">방을 찾을 수 없습니다. 삭제된 방일 수 있습니다.</div>
      </div>
    );
  if (!unlocked)
    return (
      <>
        <BackLink />
        <PasswordDialog
          room={room}
          title={`${room.name} 잠금 해제`}
          open
          onOpenChange={(v) => !v && router.push("/")}
          onOk={() => {
            markUnlocked(room.id);
            setUnlocked(true);
          }}
        />
      </>
    );
  return <JobsPage room={room} />;
}

function BackLink() {
  return (
    <Link href="/" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline">
      <ArrowLeft className="size-4" /> 방 목록
    </Link>
  );
}

function JobsPage({ room }: { room: Room }) {
  const router = useRouter();
  const { data: jobs, loading, error } = useJson<Job[]>("jobs.json", []);
  const { data: runs } = useJson<Run[]>("runs.json", []);
  const { data: companies } = useJson<Record<string, Company>>("companies.json", {});

  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("7d");
  const [category, setCategory] = useState("all");
  const [source, setSource] = useState("all");
  const [showStale, setShowStale] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [fitFilter, setFitFilter] = useState("no_over");
  const careerStart = room.career_start;
  const years = careerStart ? careerYears(careerStart) : null;
  const { roles, domains } = roomSummary(room);

  // 이 방에 속한 공고만, 방별 판정 결과와 함께
  const roomJobs = useMemo(() => {
    const known = roomKnownToData(room, jobs);
    const out: { job: Job; hit: RoomHit }[] = [];
    for (const j of jobs) {
      const hit = roomHit(room, j, known);
      if (hit) out.push({ job: j, hit });
    }
    return out;
  }, [room, jobs]);

  const today = todayKST();
  const week = daysAgoKST(7);

  const stats = useMemo(() => {
    const list = roomJobs.map((r) => r.job);
    return {
      today: list.filter((j) => j.first_seen === today).length,
      week: list.filter((j) => j.first_seen >= week).length,
      active: list.filter((j) => !j.stale).length,
    };
  }, [roomJobs, today, week]);

  const lastRun = runs.length ? runs[runs.length - 1] : null;

  const filtered = useMemo(() => {
    const days = PERIODS[period];
    const since = days === null ? "" : daysAgoKST(days);
    const needle = q.trim().toLowerCase();
    return roomJobs
      .filter(({ job: j }) => showStale || !j.stale)
      .filter(({ job: j }) => !since || j.first_seen >= since)
      .filter(({ hit }) => category === "all" || hit.domains.includes(category))
      .filter(({ job: j }) => source === "all" || j.source === source)
      .filter(({ job: j }) => {
        const allow = FIT_FILTERS[fitFilter];
        return !allow || years === null || allow.includes(careerFit(j, years));
      })
      .filter(
        ({ job: j }) =>
          !needle ||
          j.title.toLowerCase().includes(needle) ||
          j.company.toLowerCase().includes(needle),
      )
      .sort((a, b) =>
        a.job.first_seen === b.job.first_seen
          ? b.hit.score - a.hit.score
          : a.job.first_seen < b.job.first_seen
            ? 1
            : -1,
      );
  }, [roomJobs, q, period, category, source, showStale, fitFilter, years]);

  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <RoomAvatar icon={room.icon} image={room.image} className="size-12" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="text-lg font-semibold">{room.name}</div>
            <div className="flex flex-wrap gap-1">
              {roles.map((r) => (
                <Badge key={r}>{r}</Badge>
              ))}
              {domains.map((d) => (
                <Badge key={d} variant="secondary">{d}</Badge>
              ))}
              {room.keywords.map((k) => (
                <Badge key={k} variant="outline">{k}</Badge>
              ))}
              {room.exclude.map((k) => (
                <Badge key={k} variant="outline" className="line-through">{k}</Badge>
              ))}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {careerStart ? `경력 ${careerLabel(careerStart)} (${careerStart}부터)` : "경력 미입력"}
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="오늘 신규" value={stats.today} />
        <StatCard title="최근 7일 신규" value={stats.week} />
        <StatCard title={`활성 공고`} value={stats.active} />
        <StatCard
          title="마지막 수집"
          value={lastRun ? lastRun.started_at.slice(5, 16).replace("T", " ") : "-"}
        />
      </div>

      <Card>
        <CardHeader className="gap-4 space-y-0 md:flex-row md:flex-wrap md:items-end">
          <div className="flex-1 md:min-w-[220px]">
            <Input
              placeholder="제목, 회사명 검색"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
            />
          </div>
          <FilterSelect
            value={period}
            onChange={(v) => {
              setPeriod(v);
              setLimit(PAGE);
            }}
            options={[
              ["today", "오늘 수집"],
              ["7d", "최근 7일"],
              ["30d", "최근 30일"],
              ["all", "전체 기간"],
            ]}
          />
          <FilterSelect
            value={category}
            onChange={(v) => {
              setCategory(v);
              setLimit(PAGE);
            }}
            options={[["all", "전체 도메인"], ...domains.map((c) => [c, c] as [string, string])]}
          />
          <FilterSelect
            value={source}
            onChange={(v) => {
              setSource(v);
              setLimit(PAGE);
            }}
            options={[
              ["all", "전체 사이트"],
              ...Object.entries(SOURCE_LABELS).map(([k, v]) => [k, v] as [string, string]),
            ]}
          />
          <FilterSelect
            value={fitFilter}
            onChange={(v) => {
              setFitFilter(v);
              setLimit(PAGE);
            }}
            options={[
              ["no_over", "10년 이상 제외"],
              ["fit_stretch", "적합 + 상향"],
              ["fit", "적합만"],
              ["all", "연차 전체"],
            ]}
          />
          <div className="flex items-center gap-2">
            <Switch id="stale" checked={showStale} onCheckedChange={setShowStale} />
            <Label htmlFor="stale" className="text-sm text-muted-foreground">
              마감 추정 포함
            </Label>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 text-sm text-muted-foreground">
            {filtered.length}건{careerStart ? ` (경력 ${careerLabel(careerStart)} 기준)` : ""}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">수집일</TableHead>
                  <TableHead className="w-[140px]">도메인</TableHead>
                  <TableHead className="min-w-[240px]">공고</TableHead>
                  <TableHead className="w-[90px]">사이트</TableHead>
                  <TableHead className="w-[150px]">요구 경력</TableHead>
                  <TableHead className="w-[110px]">마감</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      불러오는 중
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-destructive">
                      데이터를 불러오지 못했습니다 ({error})
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      조건에 맞는 공고가 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.slice(0, limit).map(({ job: j, hit }) => (
                    <TableRow
                      key={j.id}
                      onClick={() => router.push(jobHref(j.id, room.id))}
                      className={`cursor-pointer ${j.stale ? "opacity-50" : ""}`}
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {j.first_seen.slice(5)}
                        {j.first_seen === today && (
                          <Badge className="ml-2 px-1.5 py-0 text-[10px]">NEW</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          {hit.domains.length ? (
                            hit.domains.map((d) => (
                              <Badge key={d} variant="secondary" className="whitespace-nowrap">{d}</Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">직무 일치</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={jobHref(j.id, room.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium hover:underline"
                        >
                          {j.title}
                        </Link>
                        <div className="text-sm text-muted-foreground">
                          {[j.company, j.location].filter(Boolean).join(" / ")}
                          {companyRating(companies[j.company_key ?? ""]) != null && (
                            <span className="ml-2 whitespace-nowrap text-foreground">
                              잡플래닛 {companyRating(companies[j.company_key ?? ""])!.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {SOURCE_LABELS[j.source] ?? j.source}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex flex-col items-start gap-1">
                          {years !== null && (
                            <Badge variant={FIT_VARIANT[careerFit(j, years)]} className="whitespace-nowrap">
                              {FIT_LABEL[careerFit(j, years)]}
                            </Badge>
                          )}
                          <span>{requiredText(j) || j.career}</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {j.stale ? "마감 추정" : j.deadline}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > limit && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setLimit(limit + PAGE)}>
                {Math.min(PAGE, filtered.length - limit)}건 더 보기
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="truncate text-lg font-semibold md:text-2xl">{value}</div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="md:w-[150px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
