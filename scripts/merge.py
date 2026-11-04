#!/usr/bin/env python3
"""후보 JSON을 검증해 data의 피드 파일(items.json / news.json)에 누적하고 daily 요약을 갱신한다.

사용:
  # 제품 (기본)
  python3 scripts/merge.py candidates/2026-11-04.json --summary "오늘의 한 줄 요약"
  python3 scripts/merge.py seed.json --backfill            # 초기 적재: date_added = date_announced
  python3 scripts/merge.py candidates/x.json --dry-run      # 검증만
  # 뉴스
  python3 scripts/merge.py candidates/news-2026-11-04.json --feed news --summary "..."
"""
import argparse
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KST = timezone(timedelta(hours=9))
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
AVAIL = {"출시", "사전예약", "공개만"}
STATUS = {"확인됨", "미확인"}

# 피드별 설정: 카테고리·필드·점수 키
FEEDS = {
    "product": {
        "items": ROOT / "data" / "items.json",
        "daily": ROOT / "data" / "daily.json",
        "cats": ["웨어러블·안경", "홈·로봇", "새 입력 방식", "쇼핑·결제", "매장·리테일",
                 "패션·뷰티", "콘텐츠 제작", "SNS 트렌드", "참고(규제)"],
        "fields": ["id", "date_added", "date_announced", "title", "company", "product", "price",
                   "availability", "what_is_new", "categories", "idea", "novelty", "popularity",
                   "source_url", "status", "image"],
        "score": "popularity",
    },
    "news": {
        "items": ROOT / "data" / "news.json",
        "daily": ROOT / "data" / "news-daily.json",
        "cats": ["모델·연구", "기업·자본", "정책·규제", "인프라·칩", "개발자·도구", "안전·윤리", "산업 도입"],
        "fields": ["id", "date_added", "date_announced", "title", "company", "what_is_new",
                   "why_it_matters", "categories", "importance", "source_url", "status", "image"],
        "score": "importance",
    },
}


def norm(s):
    return re.sub(r"[^0-9a-z가-힣]", "", (s or "").lower())


def n_chars(s):
    return len(re.sub(r"\s", "", s or ""))


def check(it, today, backfill, cfg):
    """오류(errors)는 등록 불가, 경고(warns)는 확인 후 등록 가능."""
    errors, warns = [], []
    for f in cfg["fields"]:
        if f not in it and f not in ("date_added", "image"):
            errors.append(f"필드 누락: {f}")
    if errors:
        return errors, warns
    if not DATE_RE.match(it["date_announced"]):
        errors.append("date_announced 형식")
    if it["status"] == "확인":
        it["status"] = "확인됨"
    if it["status"] not in STATUS:
        errors.append(f"status: {it['status']}")
    cats = it["categories"]
    if not (isinstance(cats, list) and 1 <= len(cats) <= 2 and all(c in cfg["cats"] for c in cats)):
        errors.append(f"categories: {cats}")
    if not str(it["source_url"]).startswith("http"):
        errors.append("source_url")
    score = cfg["score"]
    if not (isinstance(it.get(score), int) and 0 <= it[score] <= 100):
        errors.append(f"{score}: {it.get(score)} (0~100 정수)")

    if "availability" in cfg["fields"] and it.get("availability") not in AVAIL:
        errors.append(f"availability: {it.get('availability')}")
    if "novelty" in cfg["fields"] and not (isinstance(it.get("novelty"), int) and 1 <= it["novelty"] <= 5):
        errors.append(f"novelty: {it.get('novelty')}")

    if it["company"] and it["company"].lower() in it["title"].lower():
        warns.append("제목에 회사명 포함")
    if n_chars(it["title"]) > 18:
        warns.append(f"제목 {n_chars(it['title'])}자 (15자 내외 권장)")
    if n_chars(it["what_is_new"]) > 75:
        warns.append(f"what_is_new {n_chars(it['what_is_new'])}자 (60자 내외 권장)")
    if "idea" in cfg["fields"] and n_chars(it["idea"]) > 40:
        warns.append(f"idea {n_chars(it['idea'])}자 (40자 내외 권장)")
    if "why_it_matters" in cfg["fields"] and n_chars(it["why_it_matters"]) > 90:
        warns.append(f"why_it_matters {n_chars(it['why_it_matters'])}자 (70자 내외 권장)")
    if not backfill and DATE_RE.match(it["date_announced"]):
        age = (today - date.fromisoformat(it["date_announced"])).days
        if age > 2:
            warns.append(f"발표 {age}일 전 (48시간 기준 초과)")
    return errors, warns


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--feed", choices=list(FEEDS), default="product", help="product(기본) | news")
    ap.add_argument("--date", help="date_added (기본: 오늘 KST)")
    ap.add_argument("--summary", help="daily 요약 한 줄")
    ap.add_argument("--backfill", action="store_true", help="date_added를 date_announced로 채움 (초기 적재용)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    cfg = FEEDS[a.feed]
    ITEMS, DAILY = cfg["items"], cfg["daily"]
    score = cfg["score"]

    now = datetime.now(KST)
    today = date.fromisoformat(a.date) if a.date else now.date()
    items = json.loads(ITEMS.read_text("utf-8")) if ITEMS.exists() else []
    ids = {it["id"] for it in items}
    pairs = {(norm(it["company"]), norm(it.get("product") or it["title"])) for it in items}

    added, skipped = [], []
    for f in a.files:
        for it in json.loads(Path(f).read_text("utf-8")):
            it = dict(it)
            it.pop("evidence", None)
            it["id"] = it["id"].strip().lower()
            errors, warns = check(it, today, a.backfill, cfg)
            key = (norm(it.get("company")), norm(it.get("product") or it.get("title")))
            if errors:
                skipped.append((it.get("id"), "오류: " + ", ".join(errors)))
                continue
            if it["id"] in ids or key in pairs:
                skipped.append((it["id"], "중복"))
                continue
            it["date_added"] = it["date_announced"] if a.backfill else today.isoformat()
            clean = {k: it.get(k) for k in cfg["fields"]}
            added.append(clean)
            ids.add(it["id"])
            pairs.add(key)
            for w in warns:
                print(f"  경고 {it['id']}: {w}")

    for i, why in skipped:
        print(f"  제외 {i}: {why}")
    print(f"[{a.feed}] 추가 {len(added)}개 / 제외 {len(skipped)}개")
    if a.dry_run:
        return

    items.extend(added)
    items.sort(key=lambda it: (it["date_added"], it.get(score, 0), it["date_announced"]), reverse=True)
    ITEMS.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", "utf-8")

    latest = max(it["date_added"] for it in items) if items else today.isoformat()
    prev = json.loads(DAILY.read_text("utf-8")) if DAILY.exists() else {}
    count = sum(1 for it in items if it["date_added"] == latest)
    summary = a.summary or (prev.get("summary") if prev.get("date") == latest else None)
    if not summary:
        print("주의: --summary 없음. daily 요약을 직접 써 주세요.", file=sys.stderr)
        summary = f"오늘 {'새 소식' if a.feed == 'news' else '새로 나온 AI 제품'} {count}개"
    DAILY.write_text(json.dumps({
        "date": latest,
        "summary": summary,
        "count": count,
        "updated_at": now.isoformat(timespec="minutes"),
    }, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"[{a.feed}] daily: {latest} · {count}개")


if __name__ == "__main__":
    main()
