#!/usr/bin/env bash
# 새 글 파일 만들기
#   ./new.sh Section/소주제/…/파일이름 "글 제목"
# 예) ./new.sh 수필/autumn-walk "가을 산책"
#     ./new.sh 기술/음성인식/zipformer-lr "Zipformer 학습률 정리"
#       → _writing/기술/음성인식/zipformer-lr.md  (없는 소주제 폴더는 함께 만든다)
set -euo pipefail
cd "$(dirname "$0")"

if [ $# -lt 2 ]; then
  echo "사용법: ./new.sh Section/소주제/…/파일이름 \"글 제목\"" >&2
  exit 1
fi

path="${1%.md}"
title="$2"
section="${path%%/*}"

if [ "$section" = "$path" ] || [ ! -f "sections/$section.md" ]; then
  echo "맨 앞은 있는 Section 이어야 합니다: $(ls sections | sed 's/\.md$//' | paste -sd' ')" >&2
  echo "새 Section 은 sections/이름.md 를 먼저 만드세요 (README 참고)." >&2
  exit 1
fi

file="_writing/$path.md"

if [ -e "$file" ]; then
  echo "이미 있는 파일입니다: $file" >&2
  exit 1
fi

mkdir -p "$(dirname "$file")"
cat > "$file" <<EOF
---
title: "${title//\"/\\\"}"
date: $(TZ=Asia/Seoul date +'%F %H:%M')
summary:
---

EOF

echo "$file"
