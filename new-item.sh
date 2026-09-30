#!/usr/bin/env bash
# 새 항목 만들기 (글이 없어도 왼쪽 나무에 먼저 보이게)
#   ./new-item.sh 여행 "여행하며 적은 글"     → 새 Section   (sections/여행.md)
#   ./new-item.sh 기술/음성인식/Zipformer      → 새 소주제    (_items/기술/음성인식/Zipformer.md)
# 글을 바로 쓸 거라면 이 스크립트 없이 ./new.sh 만 써도 폴더가 함께 만들어진다.
set -euo pipefail
cd "$(dirname "$0")"

if [ $# -lt 1 ]; then
  echo "사용법: ./new-item.sh Section이름 [\"설명\"]   또는   ./new-item.sh Section/소주제/…" >&2
  exit 1
fi

path="${1%/}"
section="${path%%/*}"

if [ "$section" = "$path" ]; then
  # 새 Section: 메뉴 순서는 지금 있는 것들의 맨 뒤
  file="sections/$section.md"
  if [ -e "$file" ]; then
    echo "이미 있는 Section 입니다: $section" >&2
    exit 1
  fi
  last=$(cat sections/*.md 2>/dev/null | sed -n 's/^order: *\([0-9][0-9]*\).*/\1/p' | sort -n | tail -1)
  title="${section//\"/\\\"}"
  desc="${2:-}"
  cat > "$file" <<EOF
---
title: "$title"
description: "${desc//\"/\\\"}"
order: $(( ${last:-0} + 1 ))
---
EOF
else
  if [ ! -f "sections/$section.md" ]; then
    echo "맨 앞은 있는 Section 이어야 합니다: $(ls sections | sed 's/\.md$//' | paste -sd' ')" >&2
    echo "새 Section 은 ./new-item.sh $section 으로 먼저 만드세요." >&2
    exit 1
  fi
  if [ -d "_writing/$path" ] || [ -e "_items/$path.md" ]; then
    echo "이미 있는 항목입니다: $path" >&2
    exit 1
  fi
  file="_items/$path.md"
  mkdir -p "$(dirname "$file")"
  printf -- '---\n---\n' > "$file"
fi

echo "$file"
