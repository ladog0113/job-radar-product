"use client";

import { useEffect, useState } from "react";
import { Layers, Radar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkGh, detectRepo, loadGh, saveGh } from "@/lib/rooms";
import { useUiMode } from "@/lib/ui-mode";

const NEW_TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";

/** GitHub 토큰이 저장돼 있어야 사이트에 들어갈 수 있다 */
export function TokenGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "need" | "ok">("checking");
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { mode } = useUiMode();

  useEffect(() => {
    const g = loadGh();
    setRepo(g.repo || detectRepo());
    setState(g.token ? "ok" : "need");
  }, []);

  async function enter() {
    setBusy(true);
    setError(null);
    const s = { token: token.trim(), repo: repo.trim() };
    try {
      await checkGh(s);
      saveGh(s);
      setState("ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") return null;
  if (state === "ok") return <>{children}</>;

  if (mode === "cli")
    return (
      <form
        className="min-h-svh bg-[#0c0c0c] p-4 font-mono text-sm text-[#d4d4d4]"
        onSubmit={(e) => {
          e.preventDefault();
          enter();
        }}
      >
        <div className="text-[#6b6b6b]">Last login: {new Date().toString().slice(0, 24)} on ttys001</div>
        <label className="mt-2 flex gap-2">
          <span>token:</span>
          <input
            type="password"
            autoFocus
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="flex-1 bg-transparent outline-none"
          />
        </label>
        <label className="flex gap-2">
          <span>repo:</span>
          <input value={repo} onChange={(e) => setRepo(e.target.value)} className="flex-1 bg-transparent outline-none" />
        </label>
        {error && <div className="text-[#f87171]">error: {error}</div>}
        {busy && <div className="text-[#6b6b6b]">checking...</div>}
        <button type="submit" className="sr-only">enter</button>
      </form>
    );

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {mode === "ref" ? <Layers className="size-5" /> : <Radar className="size-5" />}
          </div>
          <CardTitle className="text-lg">{mode === "ref" ? "Reference Shelf" : "Job Radar"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              enter();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="gate-token">GitHub 토큰</Label>
              <Input
                id="gate-token"
                type="password"
                autoComplete="off"
                autoFocus
                placeholder="github_pat_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <a href={NEW_TOKEN_URL} target="_blank" rel="noopener noreferrer" className="w-fit text-xs text-muted-foreground underline">
                토큰 만들기
              </a>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gate-repo">저장소</Label>
              <Input id="gate-repo" placeholder="계정/저장소" value={repo} onChange={(e) => setRepo(e.target.value)} />
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <Button type="submit" disabled={!token.trim() || !repo.trim() || busy}>
              {busy ? "확인 중" : "입장"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
