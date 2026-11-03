# AI 신제품 레이더

매일 새로 나온 AI 제품·서비스를 9개 카테고리로 모아 보여주는 정적 사이트. 화면은 `data/items.json`과 `data/daily.json`만 읽는다.

| 파일 | 역할 |
|---|---|
| `index.html` · `styles.css` · `app.js` | 사이트 (메인 = 오늘 뭐가 새로워? / `#archive` = 전에 뭐 있었지?) |
| `data/items.json` | 전체 항목 누적 |
| `data/daily.json` | 오늘 날짜·한 줄 요약·개수·업데이트 시각 |
| `candidates/` | 날짜별 후보 원고 (검증 근거 `evidence` 포함, 감사 기록) |
| `UPDATE.md` | 매일 업데이트 절차 (사람·에이전트 공용) |
| `scripts/merge.py` | 후보 검증 → 중복 제거 → items.json 반영 → daily.json 갱신 |
| `scripts/daily.sh` | `claude -p`로 UPDATE.md 절차 실행 (cron/launchd용) |
| `scripts/build_artifact.py` | claude.ai 게시용 단일 페이지(`dist/`) 생성 |

## 로컬에서 보기
```bash
cd ai-radar && python3 -m http.server 8000   # http://localhost:8000
```
파일을 더블클릭으로 열면 브라우저가 JSON 읽기를 막는다.

## 초기 데이터
2026-10-13~26 발표분은 `--backfill`로 넣어 `date_added = date_announced`. 10-27~29 발표분은 10-29 업데이트로 추가했다.
