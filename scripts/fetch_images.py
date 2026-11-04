#!/usr/bin/env python3
"""items.json에서 image가 없는 항목의 원문 대표 이미지(og:image)를 받아 images/<id>.jpg로 저장한다.
가로 960px JPEG로 줄여 저장한다. 못 받으면 image를 null로 둔다.
로고·배너만 있는 이미지는 사람이 보고 image를 false로 바꾸면 다음부터 받지 않는다 (화면은 카테고리 타일로 대체)."""
import html
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# 대상 파일: 인자로 지정 (예: data/news.json). 기본은 data/items.json
_arg = next((a for a in sys.argv[1:] if not a.startswith("--")), None)
ITEMS = (Path(_arg) if _arg and Path(_arg).is_absolute() else ROOT / (_arg or "data/items.json"))
IMG = ROOT / "images"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
META = re.compile(r'<meta[^>]+(?:property|name)=["\'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["\'][^>]*>', re.I)
CONTENT = re.compile(r'content=["\']([^"\']+)["\']', re.I)


def get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def og_image(page_url):
    page = get(page_url).decode("utf-8", "ignore")
    for tag in META.findall(page):
        m = CONTENT.search(tag)
        if m:
            return urllib.request.urljoin(page_url, html.unescape(m.group(1)))
    return None


def main():
    force = "--force" in sys.argv  # 이미 받은 이미지도 다시 받음 (image=false 항목은 제외)
    IMG.mkdir(exist_ok=True)
    items = json.loads(ITEMS.read_text("utf-8"))
    for it in items:
        out = IMG / f"{it['id']}.jpg"
        if it.get("image") is False:
            continue  # 로고·배너뿐이라 쓰지 않기로 한 항목 → 카테고리 타일로 표시
        if it.get("image") and out.exists() and not force:
            continue
        try:
            src = it.get("image_src") or og_image(it["source_url"])
            if not src:
                raise ValueError("og:image 없음")
            raw = IMG / f"{it['id']}.raw"
            raw.write_bytes(get(src))
            subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "72", "--resampleWidth", "960",
                            str(raw), "--out", str(out)], check=True, capture_output=True)
            raw.unlink()
            it["image"] = f"images/{out.name}"
            print(f"  OK  {it['id']}")
        except Exception as e:  # noqa: BLE001 — 한 항목 실패가 전체를 막지 않게
            it["image"] = it.get("image") if out.exists() else None
            print(f"  --  {it['id']}: {e}")
    ITEMS.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", "utf-8")


if __name__ == "__main__":
    main()
