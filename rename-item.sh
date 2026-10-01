#!/usr/bin/env bash
# 항목의 보이는 이름 바꾸기 (폴더 이름과 글 주소는 그대로 둔다)
#   ./rename-item.sh 기술 "기술 메모"                  → Section 이름
#   ./rename-item.sh 기술/음성인식 "음성 인식 (ASR)"    → 소주제 이름
# 바꾼 기록은 _data/names/ 에 파일로 쌓이고, 같은 항목은 나중 기록이 이긴다.
# 원래 이름으로 돌리려면 그 항목의 기록 파일들을 지운다.
set -euo pipefail
cd "$(dirname "$0")"
. ./_sections.sh

if [ $# -lt 2 ]; then
  echo "사용법: ./rename-item.sh Section[/소주제/…] \"바꿀 이름\"" >&2
  exit 1
fi

path="${1%/}"
name="$2"
section="${path%%/*}"

if ! has_section "$section"; then
  echo "맨 앞은 있는 Section 이어야 합니다: $(section_keys | paste -sd' ')" >&2
  exit 1
fi
if [ "$section" != "$path" ] && [ ! -d "_writing/$path" ] && [ ! -e "_items/$path.md" ] && [ ! -d "_items/$path" ]; then
  echo "없는 항목입니다: $path (폴더 이름으로 적어야 합니다)" >&2
  exit 1
fi
case "$name" in
  *[/\\\#?%\"\<\>\|*:]*) echo "이름에 / \\ # ? % \" < > | * : 는 쓸 수 없습니다" >&2; exit 1 ;;
esac

mkdir -p _data/names
file="_data/names/$(TZ=Asia/Seoul date +%y%m%d-%H%M%S).yml"
printf 'path: "%s/"\nname: "%s"\n' "$path" "$name" > "$file"

echo "$file"
