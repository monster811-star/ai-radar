#!/usr/bin/env python3
"""index.html을 claude.ai Artifact용 페이지(dist/index.html)로 변환한다.
Artifact는 문서 뼈대를 자동으로 씌우므로 doctype/html/head/body 태그를 걷어낸다."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / "index.html").read_text("utf-8")
src = re.sub(r"<!doctype html>\s*|</?html[^>]*>\s*|</?head>\s*|</?body>\s*", "", src, flags=re.I)
src = re.sub(r'<meta (charset|name="viewport")[^>]*>\s*', "", src)
src = re.sub(r'<link rel="stylesheet" href="https://cdn\.jsdelivr[^>]*>\s*', "", src)  # Artifact CSP는 Google Fonts 스타일시트만 허용
# CSS·JS는 인라인으로 넣는다 (데이터 JSON만 함께 게시해 fetch)
css = (ROOT / "styles.css").read_text("utf-8")
js = (ROOT / "app.js").read_text("utf-8")
src = src.replace('<link rel="stylesheet" href="styles.css">', f"<style>\n{css}</style>")
src = src.replace('<script src="app.js"></script>', f"<script>\n{js}</script>")
out = ROOT / "dist" / "index.html"
out.parent.mkdir(exist_ok=True)
out.write_text(src, "utf-8")
print(out)
