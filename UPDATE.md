# AI 신제품 레이더 · 매일 업데이트 절차

이 문서는 사람이 읽어도, 에이전트(`claude -p`)에게 그대로 넘겨도 되는 실행 지시서다.
작업 폴더: `ai-radar/` · 오늘 날짜는 KST 기준.

## 0. 준비
- `data/items.json`을 읽어 기존 `id`와 `(company, product)` 목록을 확보한다.
- 결과는 `candidates/YYYY-MM-DD.json`에 배열로 쓴다 (감사 기록용, 삭제하지 않음).

## 1. 검색 (카테고리별 각각)
지난 48시간 신규 발표를 9개 카테고리마다 따로 검색한다.

| 카테고리 | 검색 예시 |
|---|---|
| 웨어러블·안경 | AI glasses launch, smart ring AI, AI wearable preorder, AI ring voice notes |
| 홈·로봇 | home robot preorder, humanoid companion robot launch, Alexa/Google Home new device |
| 새 입력 방식 | gesture control AI, neural wristband, voice-only device |
| 쇼핑·결제 | agentic checkout, AI shopping assistant launch |
| 매장·리테일 | in-store AI kiosk, smart mirror store, retail AI pilot |
| 패션·뷰티 | virtual try-on launch, AI stylist app, beauty AI device |
| 콘텐츠 제작 | AI video app launch, AI photo feature consumer |
| SNS 트렌드 | Instagram/TikTok/Snapchat/YouTube/Pinterest AI feature |
| 참고(규제) | AI labeling law effective, AI companion age rule |

카테고리 검색과 별도로 보도자료 배포처를 직접 훑는다: Business Wire·GlobeNewswire·PR Newswire의 지난 48시간 "AI" 릴리스 목록, StockTitan(상장사 릴리스 모음). 소형·상장 스타트업 발표는 일반 뉴스 검색에 잘 안 잡힌다.
이미 발표된 제품은 **새 사건**(정식 출시·배송 시작·가격 공개)이 있을 때만 그 날짜로 다시 넣는다.

소스 우선순위: 1차 회사 발표·GlobeNewswire·Business Wire·공식 블로그/X → 2차 TechCrunch·The Verge·Engadget·CNBC·Bloomberg·Product Hunt.
뉴스레터·애그리게이터에서 찾은 항목은 원문을 열어 날짜와 사실을 확인한다. 확인 못 하면 `status: "미확인"`.

## 2. 포함 판정 (모두 충족해야 포함)
- 실제 회사가 출시·공개·사전예약을 열었다 (루머·전망·투자 소식 제외)
- 형태나 경험이 새롭다: 새 폼팩터, 새 입력 방식, 새 사용 장면, 새 서비스 구조
- 일반 소비자나 매장 현장에서 체감할 수 있다
- 발표가 최근 48시간 이내
- 제외: 모델 성능·벤치마크, 투자·인수·실적, 일반 정책, 현장 체감 없는 백오피스 툴
- 예외: 제품 사용 방식에 직접 영향을 주는 규제 → `참고(규제)`

## 3. 작성 규칙
- 원문 문장 복사 금지. 쉬운 한국어로 새로 쓴다.
- `title` 15자 내외, "무엇을 하는 무엇" 구조, 회사명 금지
- `what_is_new` 최대 2문장, 60자 내외, 전문용어 금지
- `idea` 1문장, 40자 내외, "~하기/~만들기/~넣기"로 끝남
- `categories` 최대 2개, 첫 번째가 대표
- `novelty`: 5 세상에 처음 / 4 기존 형태를 크게 바꿈 / 3 새 기능 / 2 개선 / 1 참고
- `popularity`: 웹에서 얼마나 화제인지 **0~100 정수** (화면 정렬·표시의 기본값). 아래 "인기 점수" 절차로 매긴다.
- `id`: `회사-제품-YYYYMMDD` (소문자 영문 슬러그, 발표일)

### 인기 점수 매기기 (popularity, 0~100)
각 후보마다 제품·회사명으로 웹 검색을 한 번 더 해 **화제도**를 점수화한다. 판단 근거:
- 서로 다른 매체·결과가 얼마나 많이 다루는가 (보도 폭)
- 어떤 매체인가 — TechCrunch·The Verge·Engadget·CNBC·Bloomberg·Reuters·Wired 등 주요 매체 = 높음 / 보도자료·니치 블로그만 = 낮음
- 소셜·영상 반응 — 유튜브 조회수, Reddit·X 언급량, Product Hunt 추천 수 등 보이면 반영
- 회사의 전반적 주목도 (대형 브랜드 출시는 보통 보도량이 많다)

점수대: **85~100** 주요 매체 다수 + 소셜 화제 / **70~84** 주요 매체 여러 곳 보도 / **50~69** 몇몇 매체 + 어느 정도 관심 / **30~49** 보도자료 + 소수 픽업 / **0~29** 거의 안 알려짐.
블록버스터(대형 Apple·Amazon·Meta 기기)와 무명 스타트업을 확실히 구분해 점수를 넓게 분포시킨다. 검색 한두 번이면 충분하고, 전문 읽기는 필요 없다(결과 수·매체명이 신호).

```json
{
  "id": "brand-product-20261029",
  "date_announced": "2026-10-29",
  "title": "", "company": "", "product": "",
  "price": null,
  "availability": "출시 | 사전예약 | 공개만",
  "what_is_new": "", "categories": [""], "idea": "",
  "novelty": 3, "popularity": 50, "source_url": "", "status": "확인됨 | 미확인",
  "evidence": "원문에서 날짜를 확인한 근거 한 줄 (items.json에는 저장되지 않음)"
}
```

## 4. 반영
```bash
cd ai-radar
python3 scripts/merge.py candidates/2026-10-29.json --dry-run      # 검증·중복 확인
python3 scripts/merge.py candidates/2026-10-29.json --summary "오늘의 한 줄 요약"
```
- 이어서 `python3 scripts/fetch_images.py`로 원문 대표 이미지(og:image)를 `images/`에 받는다. 로고·배너뿐인 이미지는 지우고 해당 항목 `image`를 `false`로 바꾼다 (화면에서 카테고리 타일로 표시).
- `merge.py`가 형식 오류를 막고, `id`와 `(회사, 제품)`으로 중복을 거른다. `date_added`는 오늘로 채운다.
- 경고(제목 길이, 48시간 초과 등)가 나오면 원고를 고친 뒤 다시 실행한다.
- `daily.json`의 `summary`는 오늘 항목을 보고 한 문장으로 쓴다 (예: "안경 화면이 컬러로, 쇼핑은 AI에게 맡기는 쪽으로").

## 5. 확인
- `python3 -m http.server 8000` 후 http://localhost:8000 에서 오늘 개수·1위·카드가 맞는지 본다.
- 신규 항목이 0개여도 `daily.json`은 갱신한다 (화면에 "오늘은 조용한 날"이 뜬다).
