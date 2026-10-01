#!/usr/bin/env bash
# 새 글 파일 만들기
#   ./new.sh Section/소주제/… "글 제목"
# 예) ./new.sh 수필 "가을 산책"
#     ./new.sh 기술/음성인식 "Zipformer 학습률 정리"
#       → _writing/기술/음성인식/k3x9q2.md  (없는 소주제 폴더는 함께 만든다)
# 파일 이름은 자동으로 만든 짧은 코드이고, 글 주소는 /p/코드/ 가 된다 (항목을 옮겨도 바뀌지 않는다).
# 맨 앞은 Section 의 폴더 이름으로 적는다 (사이트에서 이름을 바꿨어도 폴더 이름은 그대로다).
set -euo pipefail
cd "$(dirname "$0")"
. ./_sections.sh

if [ $# -lt 2 ]; then
  echo "사용법: ./new.sh Section/소주제/… \"글 제목\"" >&2
  exit 1
fi

path="${1%/}"
title="$2"
section="${path%%/*}"

if ! has_section "$section"; then
  echo "맨 앞은 있는 Section 이어야 합니다: $(section_keys | paste -sd' ')" >&2
  echo "새 Section 은 sections/이름.md 를 먼저 만드세요 (README 참고)." >&2
  exit 1
fi

# 다른 글과 겹치지 않는 코드를 고른다 (글 주소는 폴더와 상관없이 파일 이름만 쓰므로 전체에서 겹치면 안 된다)
while :; do
  code=$(head -c 300 /dev/urandom | LC_ALL=C tr -dc 'abcdefghijkmnpqrstuvwxyz23456789' | cut -c1-6)
  [ -z "$(find _writing -name "$code.md" -print -quit)" ] && break
done
file="_writing/$path/$code.md"

mkdir -p "$(dirname "$file")"
cat > "$file" <<EOF
---
title: "${title//\"/\\\"}"
date: $(TZ=Asia/Seoul date +'%F %H:%M')
summary:
---

EOF

echo "$file"
