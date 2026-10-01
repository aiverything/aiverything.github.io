# 다른 스크립트가 불러 쓰는 것: Section 의 폴더 이름 다루기.
# Section 의 폴더 이름은 sections/ 파일의 folder 값이고, 없으면 그 파일의 이름이다
# (사이트에서 Section 이름을 바꾸면 파일 이름은 바뀌고 folder 에 폴더 이름이 남는다).
section_keys() {
  local f key
  for f in sections/*.md; do
    [ -e "$f" ] || continue
    key=$(sed -n 's/^folder: *"\{0,1\}\([^"]*\)"\{0,1\} *$/\1/p' "$f" | head -1)
    [ -n "$key" ] || key=$(basename "$f" .md)
    printf '%s\n' "$key"
  done
}
has_section() {
  local key
  while IFS= read -r key; do
    [ "$key" = "$1" ] && return 0
  done < <(section_keys)
  return 1
}
