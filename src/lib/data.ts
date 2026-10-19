"use client";

import { useEffect, useState } from "react";

export type Job = {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  career: string;
  deadline: string;
  url: string;
  category: string;
  score: number;
  fit?: Fit;
  queries: string[];
  first_seen: string;
  last_seen: string;
  stale?: boolean;
  has_detail?: boolean;
};

export type Detail = { id: string; text: string; fetched_at: string };

export type SourceRun = {
  source: string;
  label: string;
  fetched: number;
  matched: number;
  new: number;
  error: string | null;
};

export type Run = {
  started_at: string;
  finished_at?: string;
  sources: SourceRun[];
};

export const SOURCE_LABELS: Record<string, string> = {
  wanted: "원티드",
  saramin: "사람인",
  jobkorea: "잡코리아",
  jobplanet: "잡플래닛",
  jasoseol: "자소설닷컴",
  remember: "리멤버",
  catch: "캐치",
  linkedin: "링크드인",
};

export const CATEGORIES = ["AI·플랫폼 서비스 기획", "Technical PM", "프로덕트·UX 디자인", "DevEx·개발자 플랫폼"];

export type Fit = "적합" | "도전" | "상향" | "미기재";

// 연차 필터: 각 옵션이 보여줄 판정
export const FIT_FILTERS: Record<string, { label: string; keep: Fit[] | null }> = {
  noSenior: { label: "상향 제외", keep: ["적합", "도전", "미기재"] },
  fit: { label: "신입~3년만", keep: ["적합", "미기재"] },
  all: { label: "전체 연차", keep: null },
};

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function useJson<T>(file: string, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${base}/data/${file}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [file]);

  return { data, loading, error };
}

export function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function daysAgoKST(n: number) {
  return new Date(Date.now() + 9 * 3600 * 1000 - n * 86400 * 1000).toISOString().slice(0, 10);
}

export function safeName(id: string) {
  return id.replace(/[^A-Za-z0-9_-]/g, "_");
}

export function jobHref(id: string) {
  return `/job/?id=${encodeURIComponent(id)}`;
}
