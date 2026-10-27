"use client";

import { useEffect, useState } from "react";

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
import { listModels, loadSettings, saveSettings } from "@/lib/llm";
import { checkGh, clearGhToken, loadGh, saveGh } from "@/lib/rooms";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<{ id: string; display_name?: string }[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    setApiKey(s.apiKey);
    setModel(s.model);
    if (s.model) setModels([{ id: s.model }]);
  }, []);

  async function fetchModels() {
    setLoading(true);
    setStatus(null);
    try {
      const list = await listModels(apiKey.trim());
      setModels(list);
      if (!list.some((m) => m.id === model)) {
        const pick = list.find((m) => m.id.includes("sonnet")) ?? list[0];
        if (pick) setModel(pick.id);
      }
      setStatus(`모델 ${list.length}개를 불러왔습니다`);
    } catch (e) {
      setStatus(`불러오기 실패: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoading(false);
    }
  }

  function save() {
    saveSettings({ apiKey: apiKey.trim(), model });
    setStatus("저장했습니다");
  }

  return (
    <div className="flex flex-col gap-4">
    <GithubCard />
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Anthropic API</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="key">API 키</Label>
          <Input
            id="key"
            type="password"
            autoComplete="off"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">이 브라우저에만 저장되고 Anthropic API 외에는 전송되지 않습니다.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label>모델</Label>
          <div className="flex gap-2">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="모델 선택" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name ? `${m.display_name} (${m.id})` : m.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchModels} disabled={!apiKey.trim() || loading}>
              {loading ? "불러오는 중" : "모델 불러오기"}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={!apiKey.trim() || !model}>
            저장
          </Button>
          {status && <span className="text-sm text-muted-foreground">{status}</span>}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}

function GithubCard() {
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const g = loadGh();
    setToken(g.token);
    setRepo(g.repo);
  }, []);

  async function save() {
    setBusy(true);
    setStatus(null);
    const s = { token: token.trim(), repo: repo.trim() };
    try {
      const name = await checkGh(s);
      saveGh(s);
      setStatus(`${name} 연결을 확인하고 저장했습니다`);
    } catch (e) {
      setStatus(`확인 실패: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">GitHub</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="repo">저장소</Label>
          <Input id="repo" placeholder="계정/저장소" value={repo} onChange={(e) => setRepo(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="gh">토큰</Label>
          <Input
            id="gh"
            type="password"
            autoComplete="off"
            placeholder="github_pat_..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            이 저장소 하나에 Contents, Actions 읽기/쓰기 권한만 준 fine-grained 토큰. 이 브라우저에만 저장됩니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={!token.trim() || !repo.trim() || busy}>
            {busy ? "확인 중" : "확인 후 저장"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              clearGhToken();
              window.location.href = window.location.pathname.replace(/settings\/?$/, "");
            }}
          >
            이 브라우저에서 토큰 지우기
          </Button>
          {status && <span className="text-sm text-muted-foreground">{status}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
