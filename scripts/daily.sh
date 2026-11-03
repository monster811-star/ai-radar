#!/bin/zsh
# 매일 업데이트를 Claude Code로 실행한다. scripts/install_schedule.sh가 이 파일을 매일 07:00에 돌린다.
cd "$(dirname "$0")/.." || exit 1
mkdir -p logs
TODAY=$(TZ=Asia/Seoul date +%F)
{
echo "=== $(date '+%F %T') 시작"
claude -p "UPDATE.md 절차를 오늘(${TODAY}) 기준으로 그대로 실행해.
1) 후보는 candidates/${TODAY}.json에 쓰고 merge.py로 반영한다. 각 후보는 UPDATE.md의 '인기 점수 매기기'대로 웹 검색으로 popularity(0~100)를 반드시 채운다. 신규가 0개여도 daily.json은 갱신한다.
2) fetch_images.py로 이미지를 받는다. 로고·배너만 있으면 지우고 image=false로 바꾼다.
3) python3 scripts/build_artifact.py를 실행한다.
4) 마지막에 추가한 항목 수와 게시 결과를 한 줄로 출력한다." \
  --permission-mode acceptEdits \
  --allowedTools "WebSearch,WebFetch,Read,Write,Edit,Bash(python3 scripts/*),Bash(rm images/*),Bash(ls *)"
echo "=== $(date '+%F %T') 종료 (코드 $?)"
} >> "logs/${TODAY}.log" 2>&1
