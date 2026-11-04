# AI 업계 뉴스 · 매일 업데이트 절차

AI 업계 종사자가 **그날 알아야 하는** 뉴스를 글로벌 서치로 모은다. 소비자 제품은 제품 레이더(`UPDATE.md`)가 다루므로, 여기서는 **제품 레이더가 일부러 빼는 것**(모델·연구·자본·정책·인프라·도구·안전·산업 도입)을 담는다.
작업 폴더: `ai-radar/` · 오늘 날짜는 KST 기준 · 결과는 `candidates/news-YYYY-MM-DD.json`.

## 0. 준비
- `data/news.json`을 읽어 기존 `id`와 `(company, title)` 목록을 확보한다 (중복 방지).

## 1. 글로벌 서치 (카테고리별 각각, 지난 24~48시간)
영어 소스 위주로 전 세계를 훑는다. 카테고리마다 따로 검색한다.

| 카테고리 | 검색 예시 |
|---|---|
| 모델·연구 | new AI model release, frontier model, benchmark SOTA, research paper breakthrough |
| 기업·자본 | AI funding round, AI startup raise, AI acquisition M&A, AI company earnings/strategy |
| 정책·규제 | AI regulation, AI executive order, EU AI Act, AI policy bill |
| 인프라·칩 | AI chip GPU launch, datacenter compute, Nvidia/AMD/TPU, AI cluster |
| 개발자·도구 | AI API launch, SDK/framework, open-source model release, pricing change, dev tool |
| 안전·윤리 | AI safety, alignment, model risk, AI incident, deepfake, copyright lawsuit |
| 산업 도입 | enterprise AI deployment, AI in healthcare/finance/gov, notable adoption |

소스 우선순위: 1차 회사·기관 공식 발표/블로그/arXiv/GitHub → 2차 TechCrunch·The Verge·The Information·Bloomberg·Reuters·CNBC·VentureBeat·Ars Technica·Hacker News. 뉴스레터·애그리게이터는 원문을 열어 날짜·사실을 확인한다. 확인 못 하면 `status: "미확인"`.

## 2. 포함 판정 (업자 기준)
- **업계 종사자의 의사결정·업무에 실제로 영향**을 주는가 (모델 선택, 가격, 규제 대응, 경쟁 구도, 기술 방향)
- 발표가 최근 24~48시간 이내 (중대 사건은 후속 전개도 그날 기준으로 포함)
- 제외: 단순 소비자 가젯 출시(→ 제품 레이더), 홍보성 발표, 근거 약한 루머·전망
- 하루 **중요도 높은 순 약 10건**으로 압축한다. 넘치면 중요도 낮은 것을 떨군다.

## 3. 작성 규칙
- 원문 복사 금지. 쉬운 한국어로 새로 쓴다.
- `title` 15자 내외, 회사명 가급적 빼고 핵심 사건으로
- `what_is_new` 최대 2문장, 60자 내외 — **무슨 일인가**
- `why_it_matters` 1~2문장, 70자 내외 — **왜 중요한가(실무 시사점)**. "~라서 ~해야/~바뀐다" 식으로 실무 관점.
- `categories` 최대 2개, 첫 번째가 대표 (위 7개 중)
- `importance`: **0~100 정수 중요도** — 아래 기준
- `id`: `주체-키워드-YYYYMMDD` (소문자 영문 슬러그, 발표일)

### 중요도 점수 (importance, 0~100)
업계에 미치는 파급 + 글로벌 화제도를 함께 본다.
- **85~100**: 업계 판을 바꾸는 사건 (대형 프런티어 모델 출시, 중대 규제 발효, 초대형 M&A)
- **70~84**: 많은 팀의 결정에 영향 (주요 모델/API/가격 변화, 큰 투자, 핵심 칩 발표)
- **50~69**: 일부 분야에 뚜렷한 영향 (주목받는 오픈소스, 특정 산업 도입, 소송)
- **30~49**: 알아두면 좋은 수준
- **0~29**: 참고
글로벌 보도량(주요 매체 다수 여부)·소셜 반응도 가점 요소. 블록버스터와 소소한 건을 넓게 분포시킨다.

```json
{
  "id": "openai-gpt6-20261104",
  "date_announced": "2026-11-04",
  "title": "", "company": "",
  "what_is_new": "", "why_it_matters": "",
  "categories": [""], "importance": 70,
  "source_url": "", "status": "확인됨 | 미확인",
  "evidence": "원문에서 날짜를 확인한 근거 한 줄 (news.json에는 저장되지 않음)"
}
```

## 4. 반영
```bash
cd ai-radar
python3 scripts/merge.py candidates/news-2026-11-04.json --feed news --dry-run                 # 검증·중복 확인
python3 scripts/merge.py candidates/news-2026-11-04.json --feed news --summary "오늘의 한 줄 요약"
python3 scripts/fetch_images.py data/news.json                                                  # 원문 og:image 수신
```
- 로고·배너뿐인 이미지는 지우고 해당 항목 `image`를 `false`로 바꾼다 (카테고리 타일로 표시).
- `merge.py --feed news`가 형식(중요도 0~100 등)·중복을 거른다. `date_added`는 오늘로 채운다.
- `news-daily.json`의 `summary`는 오늘 뉴스를 보고 한 문장으로 쓴다.

## 5. 확인
- 신규가 0건이어도 `news-daily.json`은 갱신한다.
