#!/usr/bin/env python3
"""후보 JSON을 검증해 data/items.json에 누적하고 data/daily.json을 갱신한다.

사용:
  python3 scripts/merge.py candidates/2026-10-29.json --summary "오늘의 한 줄 요약"
  python3 scripts/merge.py seed.json --backfill            # 초기 적재: date_added = date_announced
  python3 scripts/merge.py candidates/x.json --dry-run      # 검증만
"""
import argparse
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "data" / "items.json"
DAILY = ROOT / "data" / "daily.json"
KST = timezone(timedelta(hours=9))

CATS = ["웨어러블·안경", "홈·로봇", "새 입력 방식", "쇼핑·결제", "매장·리테일",
        "패션·뷰티", "콘텐츠 제작", "SNS 트렌드", "참고(규제)"]
AVAIL = {"출시", "사전예약", "공개만"}
STATUS = {"확인됨", "미확인"}
FIELDS = ["id", "date_added", "date_announced", "title", "company", "product", "price",
          "availability", "what_is_new", "categories", "idea", "novelty", "popularity", "source_url", "status", "image"]
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def norm(s):
    return re.sub(r"[^0-9a-z가-힣]", "", (s or "").lower())


def check(it, today, backfill):
    """오류(errors)는 등록 불가, 경고(warns)는 확인 후 등록 가능."""
    errors, warns = [], []
    for f in FIELDS:
        if f not in it and f not in ("date_added", "image"):
            errors.append(f"필드 누락: {f}")
    if errors:
        return errors, warns
    if not DATE_RE.match(it["date_announced"]):
        errors.append("date_announced 형식")
    if it["availability"] not in AVAIL:
        errors.append(f"availability: {it['availability']}")
    if it["status"] == "확인": it["status"] = "확인됨"
    if it["status"] not in STATUS:
        errors.append(f"status: {it['status']}")
    cats = it["categories"]
    if not (isinstance(cats, list) and 1 <= len(cats) <= 2 and all(c in CATS for c in cats)):
        errors.append(f"categories: {cats}")
    if not (isinstance(it["novelty"], int) and 1 <= it["novelty"] <= 5):
        errors.append(f"novelty: {it['novelty']}")
    if not (isinstance(it.get("popularity"), int) and 0 <= it["popularity"] <= 100):
        errors.append(f"popularity: {it.get('popularity')} (0~100 정수)")
    if not str(it["source_url"]).startswith("http"):
        errors.append("source_url")
    if it["company"] and it["company"].lower() in it["title"].lower():
        warns.append("제목에 회사명 포함")
    # 글자 수는 공백을 빼고 센다
    n = lambda s: len(re.sub(r"\s", "", s))
    if n(it["title"]) > 18:
        warns.append(f"제목 {n(it['title'])}자 (15자 내외 권장)")
    if n(it["what_is_new"]) > 75:
        warns.append(f"what_is_new {n(it['what_is_new'])}자 (60자 내외 권장)")
    if n(it["idea"]) > 40:
        warns.append(f"idea {n(it['idea'])}자 (40자 내외 권장)")
    if not backfill and DATE_RE.match(it["date_announced"]):
        age = (today - date.fromisoformat(it["date_announced"])).days
        if age > 2:
            warns.append(f"발표 {age}일 전 (48시간 기준 초과)")
    return errors, warns


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--date", help="date_added (기본: 오늘 KST)")
    ap.add_argument("--summary", help="daily.json 한 줄 요약")
    ap.add_argument("--backfill", action="store_true", help="date_added를 date_announced로 채움 (초기 적재용)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    now = datetime.now(KST)
    today = date.fromisoformat(a.date) if a.date else now.date()
    items = json.loads(ITEMS.read_text("utf-8")) if ITEMS.exists() else []
    ids = {it["id"] for it in items}
    pairs = {(norm(it["company"]), norm(it["product"])) for it in items}

    added, skipped = [], []
    for f in a.files:
        for it in json.loads(Path(f).read_text("utf-8")):
            it = dict(it)
            it.pop("evidence", None)
            it["id"] = it["id"].strip().lower()
            errors, warns = check(it, today, a.backfill)
            key = (norm(it.get("company")), norm(it.get("product")))
            if errors:
                skipped.append((it.get("id"), "오류: " + ", ".join(errors)))
                continue
            if it["id"] in ids or key in pairs:
                skipped.append((it["id"], "중복"))
                continue
            it["date_added"] = it["date_announced"] if a.backfill else today.isoformat()
            clean = {k: it.get(k) for k in FIELDS}
            added.append(clean)
            ids.add(it["id"])
            pairs.add(key)
            for w in warns:
                print(f"  경고 {it['id']}: {w}")

    for i, why in skipped:
        print(f"  제외 {i}: {why}")
    print(f"추가 {len(added)}개 / 제외 {len(skipped)}개")
    if a.dry_run:
        return

    items.extend(added)
    items.sort(key=lambda it: (it["date_added"], it.get("popularity", 0), it["date_announced"]), reverse=True)
    ITEMS.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", "utf-8")

    latest = max(it["date_added"] for it in items) if items else today.isoformat()
    prev = json.loads(DAILY.read_text("utf-8")) if DAILY.exists() else {}
    count = sum(1 for it in items if it["date_added"] == latest)
    summary = a.summary or (prev.get("summary") if prev.get("date") == latest else None)
    if not summary:
        print("주의: --summary 없음. daily.json 요약을 직접 써 주세요.", file=sys.stderr)
        summary = f"오늘 새로 나온 AI 제품 {count}개"
    DAILY.write_text(json.dumps({
        "date": latest,
        "summary": summary,
        "count": count,
        "updated_at": now.isoformat(timespec="minutes"),
    }, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"daily.json: {latest} · {count}개")


if __name__ == "__main__":
    main()
