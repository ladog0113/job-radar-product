import re

from config import (
    BONUS_DOMAINS,
    CAREER_FIT_MAX,
    CAREER_STRETCH_MAX,
    CATEGORIES,
    EXCLUDE_OVERRIDE,
    EXCLUDE_TERMS,
    HARD_EXCLUDE_TERMS,
    SENIOR_TERMS,
)


def _pattern(term: str) -> re.Pattern:
    # 영문 단어는 앞뒤가 영문자가 아닐 때만 매칭 (pm이 npm에, ui가 gui에 걸리지 않도록)
    if re.fullmatch(r"[a-z0-9 ./\-]+", term):
        return re.compile(r"(?<![a-z])" + re.escape(term) + r"(?![a-z])")
    return re.compile(re.escape(term))


def _compile(terms):
    return [_pattern(t) for t in terms] if terms is not None else None


_EXCLUDE = _compile(EXCLUDE_TERMS)
_HARD = _compile(HARD_EXCLUDE_TERMS)
_OVERRIDE = _compile(EXCLUDE_OVERRIDE)
_BONUS = _compile(BONUS_DOMAINS)
_SENIOR = _compile(SENIOR_TERMS)
_CATS = [(name, [(_compile(roles), _compile(domains)) for roles, domains in rules]) for name, rules in CATEGORIES]


def _hits(patterns, text):
    return [p.pattern for p in patterns if p.search(text)]


def classify(title: str) -> dict | None:
    """제목 기준으로 관련 공고인지 판단하고 분류와 점수를 돌려준다. 무관하면 None."""
    t = title.lower()
    if _hits(_HARD, t):
        return None
    if _hits(_EXCLUDE, t) and not _hits(_OVERRIDE, t):
        return None
    for rank, (name, rules) in enumerate(_CATS):
        for roles, domains in rules:
            if not _hits(roles, t):
                continue
            if domains is not None and not _hits(domains, t):
                continue
            score = 100 - rank * 5 + min(len(_hits(_BONUS, t)), 3) * 10
            return {"category": name, "score": score}
    return None


_RANGE_RE = re.compile(r"(\d+)\s*(?:년)?\s*[~\-]\s*(\d+)\s*년")
_MIN_RE = re.compile(r"(\d+)\s*년\s*(?:이상|↑|\+)?")


def career_fit(title: str, career: str) -> str:
    """공고 제목과 경력 조건으로 지원 적합도를 판정한다: 적합 / 도전 / 상향 / 미기재"""
    if _hits(_SENIOR, title.lower()):
        return "상향"
    c = career.replace(" ", "")
    if not c:
        return "미기재"
    if re.search(r"\d+년(↓|이하)", c):
        return "적합"
    m = _RANGE_RE.search(c) or _MIN_RE.search(c)
    if m:
        low = int(m.group(1))
        if low <= CAREER_FIT_MAX:
            return "적합"
        return "도전" if low <= CAREER_STRETCH_MAX else "상향"
    if "신입" in c or "무관" in c:
        return "적합"
    return "미기재"
