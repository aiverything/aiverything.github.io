#!/usr/bin/env bash
# 글을 다른 항목으로 옮기기 (파일과 글 주소는 그대로 두고, 나무에서 놓인 자리만 바꾼다)
#   ./move-post.sh "기술/예시 주제/subtopics.md" 수필
#   ./move-post.sh "수필/first-essay.md" "기술/음성인식/Zipformer"
# 옮긴 기록은 _data/moves/ 에 파일로 쌓이고, 같은 글은 나중 기록이 이긴다.
# 원래 자리로 돌리려면 그 글의 기록 파일들을 지운다.
set -euo pipefail
cd "$(dirname "$0")"
. ./_sections.sh

if [ $# -lt 2 ]; then
  echo "사용법: ./move-post.sh Section/…/글파일.md 옮길-항목(Section[/소주제/…])" >&2
  exit 1
fi

post="_writing/${1#_writing/}"
to="${2%/}"
section="${to%%/*}"

if [ ! -f "$post" ]; then
  echo "없는 글 파일입니다: $post" >&2
  exit 1
fi
if ! has_section "$section"; then
  echo "옮길 항목의 맨 앞은 있는 Section 이어야 합니다: $(section_keys | paste -sd' ')" >&2
  exit 1
fi

mkdir -p _data/moves
file="_data/moves/$(TZ=Asia/Seoul date +%y%m%d-%H%M%S).yml"
printf 'post: "%s"\nto: "%s/"\n' "$post" "$to" > "$file"

echo "$file"
