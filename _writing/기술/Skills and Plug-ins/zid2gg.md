---
title: "UI UX Pro Max: AI가 만든 화면이 다 비슷해 보일 때"
date: 2026-10-24 11:14
summary: "GitHub 별 13만 9천 개를 받은 디자인 스킬 UI UX Pro Max가 누구의 어떤 문제를 풀어 주는지, Claude에는 어떻게 설치하는지 정리했습니다."
---

AI에게 화면을 만들어 달라고 하면 결과가 어딘가 다 비슷합니다.
보라색 그라데이션, 이모지 아이콘, 어디서 본 듯한 배치.
UI UX Pro Max는 이런 화면을 업종에 맞는 디자인으로 바꿔 주는 스킬입니다. README도 피해야 할 것으로 "AI 느낌의 보라·분홍 그라데이션"과 "아이콘 대신 쓴 이모지"를 꼽습니다.

- GitHub 별 **13만 9천 개**, 포크 1만 4천 개. 2025년 11월 말에 공개되고 1년이 안 돼 쌓인 숫자입니다.
- 설치 도구(npm)는 한 달에 **6만 6천 번** 넘게 내려받힙니다.
- MIT 라이선스라 무료로 씁니다.
- 숫자는 모두 2026년 10월 24일 기준입니다.

## 이런 분께 좋습니다

| 이런 상황이라면 | 이렇게 도와줍니다 |
|---|---|
| 디자이너 없이 혼자 랜딩 페이지나 대시보드를 만들어야 한다 | 업종에 맞는 페이지 구성, 스타일, 색, 글꼴을 한 벌로 골라 줍니다 |
| AI가 만든 화면이 다 비슷해 보인다 | 업종마다 피해야 할 패턴을 걸러 내서 흔한 "AI 티"를 줄입니다 |
| 병원, 은행, 스파처럼 업종 분위기를 맞춰야 한다 | 업종 규칙이 192가지 있습니다. 예를 들어 은행 앱에는 보라·분홍 그라데이션을 쓰지 말라는 식입니다 |
| 접근성과 반응형을 자주 빠뜨린다 | 넘기기 전 점검표로 글자 대비 4.5:1, 키보드 초점, 375~1440px 화면을 확인하게 합니다 |
| 이미 만든 앱의 분위기만 바꾸고 싶다 | 구조와 동작은 그대로 두고 색, 글꼴, 간격 같은 토큰만 바꾸는 절차를 안내합니다 |
| Claude Code, Cursor, Copilot을 섞어 쓴다 | 같은 자료를 도구마다 똑같이 설치할 수 있습니다 |

- 디자이너와 자체 디자인 시스템이 이미 있는 팀이라면 그쪽 규칙이 먼저입니다. 이 스킬은 참고 자료로 쓰면 됩니다.

## 들어 있는 자료

| 자료 | 개수 | 내용 |
|---|---|---|
| UI 스타일 | 79개 (기본 추천 50개) | Glassmorphism, Minimalism, Brutalism, Bento Grid 등 |
| 색 조합 | 192개 | 제품 종류 192가지에 하나씩 맞춘 색 |
| 글꼴 짝 | 74개 | Google Fonts 불러오기 포함 |
| 차트 | 25종 | 대시보드용 차트 추천 |
| 기술 스택 | 22개 | React, Next.js, Vue, Svelte, SwiftUI, Flutter, Tailwind 등 |
| UX 지침 | 119개 | 접근성, 피해야 할 패턴 등 |
| 업종별 규칙 | 192개 | 업종에 맞는 디자인을 고르는 규칙 |

## 동작 방식

v2.0부터 들어간 디자인 시스템 생성기가 중심입니다.

1. 요청을 받습니다. 예: "Build a landing page for my beauty spa"
2. 다섯 갈래로 동시에 찾습니다. 제품 종류, 스타일, 색, 랜딩 페이지 구성, 글꼴입니다.
3. 업종 규칙으로 고릅니다. 검색 순위(BM25)를 매기고, 그 업종에서 피해야 할 패턴을 걸러냅니다.
4. 디자인 시스템 한 벌을 내놓습니다. 페이지 구성, 스타일, 색, 글꼴, 효과, 피할 것, 넘기기 전 점검표까지 들어 있습니다.

README에 실린 뷰티 스파 예시의 결과는 이렇습니다.

| 항목 | 결과 |
|---|---|
| 페이지 구성 | Hero → Services → Testimonials → Booking → Contact |
| 스타일 | Soft UI Evolution |
| 색 | 주색 #E8B4B8, 보조색 #A8D5BA, 버튼 #D4AF37, 바탕 #FFF5F5, 글자 #2D3436 |
| 글꼴 | Cormorant Garamond / Montserrat |
| 피할 것 | 형광색, 거친 움직임, 다크 모드, AI 느낌의 보라·분홍 그라데이션 |
| 점검표 | 아이콘은 이모지 대신 SVG, 글자 대비 4.5:1 이상, 키보드 초점 표시, 375·768·1024·1440px 반응형 등 |

- Claude Code에서는 따로 명령을 부르지 않아도 됩니다. 화면을 만들거나 고쳐 달라고 하면 스킬이 알아서 켜집니다.
- 스택을 말하지 않으면 HTML + Tailwind로 만듭니다.
- 결과는 디자인 지침입니다. 이미 있는 앱을 알아서 고쳐 주지는 않으니, 바꿔 달라는 요청을 따로 해야 합니다.

## 설치 전에 필요한 것

- Python 3: 검색 스크립트가 씁니다. 표준 라이브러리만 쓰고, 아무것도 설치하지 않으며 인터넷에도 접속하지 않는다고 적혀 있습니다.
- Node.js(npm): 아래 방법 2(CLI)로 설치할 때만 필요합니다.

```bash
python3 --version
```

## Claude Code에 설치하기

### 방법 1. 플러그인 마켓플레이스

Claude Code 입력 칸에 두 줄을 차례로 입력합니다.

```
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```

- 첫 줄은 이 저장소를 플러그인 목록(마켓플레이스)으로 등록하고, 둘째 줄은 그 안의 ui-ux-pro-max 플러그인을 설치합니다.
- v2.5.1 이전 판에서는 "Zip file contains a symbolic link" 오류가 났습니다. 이 오류가 나면 방법 2를 씁니다.

### 방법 2. CLI

README가 권장하는 방법입니다.

```bash
npm install -g ui-ux-pro-max-cli
cd /path/to/your/project
uipro init --ai claude
```

- 첫 줄은 CLI 설치입니다. 패키지 이름은 ui-ux-pro-max-cli이고 명령 이름은 uipro입니다.
- 마지막 줄을 실행하면 그 프로젝트의 .claude/skills/ 아래에 설치됩니다.
- 모든 프로젝트에서 쓰려면 --global을 붙입니다. ~/.claude/skills/ 아래에 설치됩니다.

```bash
uipro init --ai claude --global
```

- npm 전역 설치가 권한 문제로 안 되면, 설치 없이 바로 실행할 수도 있습니다.

```bash
npx ui-ux-pro-max-cli init --ai claude
```

- 예전 이름인 uipro-cli 패키지는 2.2.3에서 멈춘 옛 판이라 쓰지 않습니다.

### 업데이트와 삭제

```bash
npm install -g ui-ux-pro-max-cli@latest
uipro update
uipro uninstall --ai claude
uipro uninstall --global
```

- 새 판이 나오면 첫 줄로 CLI부터 올리고, uipro update로 설치된 스킬 파일을 새로 고칩니다.
- 셋째 줄은 프로젝트에 설치한 것을, 넷째 줄은 전역 설치를 지웁니다.

### Claude.ai(웹)에서는

- 웹의 "Upload a skill"에 저장소 ZIP을 올리면 파일이 200개를 넘어서 실패합니다.
- 개발용 저장소 전체라서 그렇고, 웹에 올릴 ZIP은 따로 배포하지 않습니다(2026년 10월 기준).

## 직접 돌려 보기

CLI로 프로젝트에 설치했다면 검색 스크립트를 직접 실행할 수도 있습니다. 전역 설치라면 경로 앞에 ~/를 붙입니다.

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "beauty spa wellness" --design-system -p "Serenity Spa"
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "glassmorphism" --domain style
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "form validation" --stack react
```

- 첫 줄은 위 예시처럼 디자인 시스템 한 벌을 만듭니다.
- 둘째 줄은 스타일만, 셋째 줄은 React 지침만 찾습니다.
- --persist를 붙이면 design-system/프로젝트이름/MASTER.md에 저장하고, --page로 페이지별 규칙 파일을 따로 만들 수 있습니다.

## 기본 정보

- 저장소: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
- 만든 곳: Next Level Builder
- 이용 조건: MIT (무료, 오픈소스)
- 판: v2.15.0 (2026년 8월 배포, 이 글은 2026년 10월 기준)
- 누리집: [uupm.cc](https://uupm.cc)

## 참고

- 이 저장소는 무료 기본판입니다. 브랜드, 로고, 배너, 슬라이드까지 다루는 유료판은 uupm.cc에서 따로 안내합니다.
- Claude Code가 "response exceeded the ... output token maximum"을 내면 스킬 문제가 아니라 한 번에 낼 수 있는 답의 길이 제한입니다. 작업을 나눠 달라고 하거나, 모델이 허용하면 CLAUDE_CODE_MAX_OUTPUT_TOKENS 값을 늘린 뒤 Claude Code를 다시 시작합니다.

## 출처

- [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)의 README (v2.15.0, MIT). 숫자와 명령은 2026년 10월 24일에 확인한 것입니다.
