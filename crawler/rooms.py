"""방(rooms/rooms.json) 설정을 읽어 검색어를 만들고, 공고가 어느 방에 속하는지 판정한다.

직무, 도메인 프리셋은 웹과 같은 파일(src/lib/presets.json)을 쓴다.
판정 규칙은 웹의 src/lib/rooms.ts 와 같다 (웹은 제목만, 수집기는 제목 + 본문).
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRESETS = json.loads((ROOT / "src" / "lib" / "presets.json").read_text(encoding="utf-8"))
ROOMS_FILE = ROOT / "rooms" / "rooms.json"

ROLE = {r["id"]: r for r in PRESETS["roles"]}
DOMAIN = {d["id"]: d for d in PRESETS["domains"]}

MAX_QUERIES_PER_ROOM = 16
MAX_QUERIES = 36          # 전체 검색어 상한. 넘으면 날짜별로 돌아가며 사용
MAX_LINKEDIN_QUERIES = 10


def _pattern(term: str) -> re.Pattern:
    term = term.lower()
    # 영문 단어는 앞뒤가 영문자가 아닐 때만 매칭 (pm이 npm에, ui가 gui에 걸리지 않도록)
    if re.fullmatch(r"[a-z0-9 ./+\-]+", term):
        return re.compile(r"(?<![a-z])" + re.escape(term) + r"(?![a-z])")
    return re.compile(re.escape(term))


_cache: dict[str, re.Pattern] = {}


def _hit(term: str, text: str) -> bool:
    p = _cache.get(term)
    if p is None:
        p = _cache[term] = _pattern(term)
    return bool(p.search(text))


def _any(terms, text) -> bool:
    return any(_hit(t, text) for t in terms)


def load_rooms() -> list[dict]:
    if not ROOMS_FILE.exists():
        return []
    data = json.loads(ROOMS_FILE.read_text(encoding="utf-8"))
    return data.get("rooms", [])


def match_room(room: dict, title: str, detail: str = "") -> dict | None:
    t = (title or "").lower()
    if _any(PRESETS["hard_exclude"], t):
        return None
    if _any(room.get("exclude", []), t):
        return None

    role_ok = False
    for rid in room.get("roles", []):
        r = ROLE.get(rid)
        if r and _any(r["terms"], t) and not _any(r["not_terms"], t):
            role_ok = True
            break
    if not role_ok:
        return None

    domains = [DOMAIN[d] for d in room.get("domains", []) if d in DOMAIN]
    keywords = room.get("keywords", [])
    if not domains and not keywords:
        return {"domains": [], "score": 50}

    dom_hits = [d["label"] for d in domains if _any(d["terms"], t)]
    kw_hits = [k for k in keywords if _hit(k, t)]
    if dom_hits or kw_hits:
        return {"domains": dom_hits, "score": 60 + 10 * len(dom_hits) + 10 * len(kw_hits)}

    # 제목에 도메인이 없으면 본문에서 확인: 키워드 1개 이상 또는 도메인 단어 2종 이상
    if detail:
        d = detail.lower()
        kw_d = [k for k in keywords if _hit(k, d)]
        dom_d = []
        terms_hit = 0
        for dm in domains:
            n = sum(1 for term in dm["terms"] if _hit(term, d))
            if n:
                dom_d.append(dm["label"])
                terms_hit += n
        if kw_d or terms_hit >= 2:
            return {"domains": dom_d, "score": 30 + 5 * len(dom_d) + 5 * len(kw_d), "by_detail": True}
    return None


def match_rooms(rooms: list[dict], title: str, detail: str = "") -> dict:
    out = {}
    for room in rooms:
        m = match_room(room, title, detail)
        if m:
            out[room["id"]] = m
    return out


def room_queries(room: dict) -> list[str]:
    roles = [ROLE[r] for r in room.get("roles", []) if r in ROLE]
    domains = [DOMAIN[d] for d in room.get("domains", []) if d in DOMAIN]
    role_q = [r["q"][0] for r in roles if r["q"]]
    qs: list[str] = list(room.get("keywords", []))
    if domains:
        # 도메인마다 최소 한 번씩 들어가도록 (도메인 x 직무) 조합을 도메인 순서로 번갈아 쌓는다
        max_dq = max(len(dm["q"]) for dm in domains)
        for qi in range(max_dq):
            for rq in role_q:
                for dm in domains:
                    if qi < len(dm["q"]):
                        qs.append(f"{dm['q'][qi]} {rq}")
    else:
        for r in roles:
            qs.extend(r["q"])
    seen, out = set(), []
    for q in qs:
        if q.lower() not in seen:
            seen.add(q.lower())
            out.append(q)
    return out[:MAX_QUERIES_PER_ROOM]


def _rotate(items: list[str], cap: int) -> list[str]:
    if len(items) <= cap:
        return items
    start = (date.today().toordinal() * cap) % len(items)
    return [items[(start + i) % len(items)] for i in range(cap)]


def all_queries(rooms: list[dict]) -> list[str]:
    seen, out = set(), []
    # 방마다 앞쪽 검색어부터 번갈아 넣어 한 방이 상한을 독차지하지 않게 한다
    per = [room_queries(r) for r in rooms]
    for i in range(max((len(p) for p in per), default=0)):
        for p in per:
            if i < len(p) and p[i].lower() not in seen:
                seen.add(p[i].lower())
                out.append(p[i])
    return _rotate(out, MAX_QUERIES)


def linkedin_queries(rooms: list[dict]) -> list[str]:
    seen, out = set(), []
    for room in rooms:
        roles = [ROLE[r] for r in room.get("roles", []) if r in ROLE and ROLE[r]["en"]]
        domains = [DOMAIN[d] for d in room.get("domains", []) if d in DOMAIN]
        for r in roles:
            if domains:
                for dm in domains:
                    q = f"{dm['en'][0]} {r['en'][0]}"
                    if q not in seen:
                        seen.add(q)
                        out.append(q)
            elif r["en"][0] not in seen:
                seen.add(r["en"][0])
                out.append(r["en"][0])
    return _rotate(out, MAX_LINKEDIN_QUERIES)
