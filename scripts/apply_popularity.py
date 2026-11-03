#!/usr/bin/env python3
"""{id: 점수} JSON을 받아 data/items.json의 각 항목에 popularity(0~100 정수)를 채운다.

사용:
  python3 scripts/apply_popularity.py data/pop-scores.json
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "data" / "items.json"


def main():
    if len(sys.argv) < 2:
        sys.exit("사용: apply_popularity.py <점수맵.json>")
    scores = json.loads(Path(sys.argv[1]).read_text("utf-8"))
    items = json.loads(ITEMS.read_text("utf-8"))
    applied, missing = 0, []
    for it in items:
        if it["id"] in scores:
            v = int(scores[it["id"]])
            if not 0 <= v <= 100:
                sys.exit(f"범위 오류 {it['id']}: {v} (0~100)")
            it["popularity"] = v
            applied += 1
        elif "popularity" not in it:
            missing.append(it["id"])
    ITEMS.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"popularity 적용 {applied}개 / 전체 {len(items)}개")
    if missing:
        print("아직 점수 없음:", ", ".join(missing))


if __name__ == "__main__":
    main()
