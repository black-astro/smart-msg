# smart-msg

> AI 가 `git diff` 보고 커밋 메시지를 알아서 써드립니다. 더 이상 메시지 고민하지 마세요.

```bash
git add .
sm c
# ↓ 추천 메시지가 뜨고, y 한 번 누르면 commit 끝.
```

---

## ✨ Features

- ⚡ **빠름** — 저비용 모델 (`gpt-4.1-nano`, `claude-haiku-4-5`) 기반, 응답 1초 이내
- 💰 **저렴** — staged diff 만 전송. 1회당 약 **0.01원 미만**
- 🌐 **다국어** — 한국어 / 영어 선택
- 📏 **강도 조절** — `simple` / `middle` / `hard` 3단계
- 🤝 **AI 선택** — OpenAI (GPT) / Anthropic (Claude) 둘 다 지원
- 🪝 **Git Hook 통합** — IntelliJ·VSCode·CLI 어디서든 `git commit` 만으로 동작
- 🌍 **프로젝트 무관** — Java, Python, Node, 무엇이든 git 만 쓰면 동작
- 🔐 **안전** — 키는 사용자 홈 디렉토리(`~/.smart-msg/`)에만 저장

---

## 📦 Installation

### 사내 배포 (GitHub repo 직접 설치 — 추천)

```bash
npm install -g git+https://github.com/<your-github-id>/smart-msg.git
```

특정 버전 고정:

```bash
npm install -g git+https://github.com/<your-github-id>/smart-msg.git#v1.0.0
```

> [!TIP]
> private repo 도 가능합니다. SSH 키가 등록되어 있으면 `git+ssh://git@github.com/...` 로 설치하세요.

### 로컬 개발 / 테스트

```bash
git clone <repo-url>
cd smart-msg
npm install
npm run build
npm link        # 글로벌로 등록 (어느 폴더에서든 sm 명령 사용 가능)
```

링크 해제: `npm unlink -g smart-msg`

---

## 🚀 Quick Start

### 1단계 — 로그인

```bash
sm login
```

대화식으로 4가지를 묻습니다:

1. **AI 선택** — OpenAI (GPT) vs Anthropic (Claude)
2. **모델 선택** — 저렴한 순으로 추천 모델 표시
3. **언어 선택** — 한국어 / English
4. **강도 선택** — simple / middle / hard

그다음 브라우저로 API 키 발급 페이지가 자동으로 열립니다. 키를 발급받아 붙여넣으면 끝.

> [!NOTE]
> 한 번만 하면 어떤 프로젝트에서든 사용 가능합니다. 설정은 `~/.smart-msg/config.json` 에 저장.

### 2단계 — 변경사항 스테이징

```bash
git add .                # 또는 git add <files>
```

### 3단계 — 커밋

```bash
sm c
```

→ AI 가 추천 메시지 출력 → `y/n` 확인 → 자동 커밋.

---

## 📖 Commands

| 명령 | 설명 |
|---|---|
| `sm login` | AI · 모델 · 언어 · 강도 · API 키 첫 설정 |
| `sm c` (= `sm commit`) | staged diff → AI 메시지 생성 → 확정 → commit |
| `sm config` | 언어 / 강도 / 모델 변경 |
| `sm status` | 현재 저장된 설정 표시 |
| `sm install-hook` | 현재 프로젝트에 git hook 설치 (선택) |
| `sm logout` | 저장된 API 키만 제거 |
| `sm uninstall` | 모든 흔적 (config + hook) 제거 |

도움말은 `sm --help` 또는 `sm <명령> --help`.

---

## ⚙️ Configuration

### Provider · Model

| Provider | 추천 모델 (저렴한 순) |
|---|---|
| **OpenAI** | `gpt-4.1-nano`, `gpt-4o-mini`, `gpt-4.1-mini` |
| **Anthropic** | `claude-haiku-4-5`, `claude-3-5-haiku-latest` |

언제든 `sm config` 로 변경 가능.

### Language

| 값 | 출력 |
|---|---|
| `ko` | 한국어 (단, `feat`/`fix` 같은 type 키워드는 영어 유지) |
| `en` | 영어 |

### Strength — 메시지 길이/상세도

#### `simple` (기본 추천)

```
feat(auth): add OAuth login flow
```

#### `middle`

```
feat(auth): add OAuth login flow

- PKCE 기반 OAuth 콜백 처리 추가
- 로컬 콜백 서버를 임시로 띄움
- 발급된 토큰을 ~/.smart-msg/config.json 에 저장
```

#### `hard` — 간단한 README 수준

```
feat(auth): add OAuth login flow

기존 API 키 입력 방식은 매번 발급 페이지로 이동해 복사·붙여넣는
부담이 있었음. 표준 OAuth 흐름을 도입해 이를 해소.

- PKCE flow 로 안전하게 토큰 획득
- 로컬 8765 포트에 임시 콜백 서버 운영
- 토큰은 OS keychain 에 보관
- 토큰 만료 시 자동 갱신

영향: 기존 API 키 사용자도 그대로 동작 (fallback).
```

### 설정 변경

```bash
sm config
```

메뉴에서 언어 / 강도 / 모델을 골라 변경할 수 있습니다.

---

## 🪝 Git Hook (Optional)

기본 사용은 `sm c` 명령이지만, **IntelliJ 커밋 창**이나 **VSCode commit 창**처럼 IDE 내부에서 `git commit` 을 호출하는 경우엔 hook 을 깔아야 합니다.

```bash
cd /your/project
sm install-hook
```

이 명령은 해당 프로젝트의 `.git/hooks/prepare-commit-msg` 에 짧은 스크립트를 설치합니다.

### Hook 설치 후 동작

| 상황 | 동작 |
|---|---|
| 빈 `git commit` | ✅ AI 가 메시지 자동 채움 |
| IntelliJ Ctrl+K (커밋창) | ✅ 메시지 자동 채움 |
| `git commit -m "직접 메시지"` | ⏭️ hook 비켜섬 (사용자 의도 우선) |
| `git commit --amend` | ⏭️ 기존 메시지 보호 |
| merge / squash 커밋 | ⏭️ 보호 |
| AI 호출 실패 | ⏭️ commit 자체는 그대로 진행 |
| staged 없음 | ⏭️ AI 호출 안 함 (토큰 절약) |

> [!TIP]
> 프로젝트마다 한 번만 깔면 됩니다. `sm uninstall` 로 한꺼번에 제거 가능.

---

## 🔬 How It Works

```
┌─────────────────────────────────────────────────────────┐
│  git add <files>                                        │
│        ↓                                                │
│  sm c  (또는 git commit + hook)                          │
│        ↓                                                │
│  ① git diff --staged   ← 변경분만 추출 (전체 코드 X)        │
│        ↓                                                │
│  ② 8000자로 자르기                                       │
│        ↓                                                │
│  ③ language + strength 로 프롬프트 구성                  │
│        ↓                                                │
│  ④ provider 호출 (OpenAI 또는 Anthropic)                 │
│        ↓                                                │
│  ⑤ 결과 메시지 → 사용자 확인 → git commit                │
└─────────────────────────────────────────────────────────┘
```

### 토큰 사용량

> [!IMPORTANT]
> smart-msg 는 **프로젝트 전체를 읽지 않습니다.** `git diff --staged` 결과만 보냅니다 — 마지막 커밋 이후 스테이지된 변경분만.

| 항목 | 양 |
|---|---|
| 입력 — 프롬프트 지시문 | ~500자 (고정) |
| 입력 — diff | 변경된 부분만, 최대 8000자 |
| 출력 — `simple` | ~50자 |
| 출력 — `middle` | ~300자 |
| 출력 — `hard` | ~800자 |

`gpt-4.1-nano` 기준 **하루 10회 커밋해도 월 30원 미만**. 사실상 무료라고 봐도 됩니다.

---

## 🗂 File Layout

```
~/.smart-msg/
└── config.json    # provider, model, language, strength, API 키, hook 추적
```

`config.json` 은 사람이 읽을 수 있는 형식입니다. 직접 편집해도 OK.

---

## 🧹 Uninstall

```bash
sm uninstall                  # ① 설정 폴더 + 깔아놓은 hook 들 자동 제거
npm uninstall -g smart-msg    # ② 패키지 본체 제거
```

> [!WARNING]
> npm 은 글로벌 패키지 uninstall 시 lifecycle script 실행을 막아둡니다(악성 패키지 방지). 그래서 두 단계로 나눠서 제거해야 합니다. `sm uninstall` 을 먼저 실행하지 않으면 `~/.smart-msg/` 가 남아 API 키도 그대로 남습니다.

---

## ❓ FAQ

### Q. 왜 GitHub 처럼 OAuth 웹 로그인이 안 되나요?

OpenAI 와 Anthropic 은 third-party 도구가 OAuth client 로 등록할 수 있게 해주지 않습니다 (자사 1st-party 앱만 OAuth 허용). 그래서 시중 모든 third-party CLI 도구가 API 키 입력 방식을 씁니다. smart-msg 는 그 대신 키 발급 페이지를 자동으로 열어주고 password 입력으로 보호하는 식으로 UX 를 보완했습니다.

### Q. 한국어로 커밋 메시지 쓰고 싶어요.

```bash
sm config
# → language → ko
```

### Q. 메시지가 너무 짧아요 / 너무 길어요.

```bash
sm config
# → strength → simple | middle | hard
```

### Q. AI 응답이 이상해요.

`sm c` 결과가 마음에 안 들면 그냥 `n` 으로 거절하고 다시 `sm c` 를 실행하세요. 매번 새로 호출됩니다. 또는 강도를 바꿔보세요.

### Q. 토큰 사용량이 걱정됩니다.

이미 최소화되어 있습니다. 변경분만 보내고, 8000자 제한이 있고, 저비용 모델을 씁니다. [How It Works](#-how-it-works) 섹션을 참조하세요.

### Q. 모노레포에서 쓸 수 있나요?

네. `git diff --staged` 가 알아서 처리하므로 어떤 폴더에서 실행해도 그 git 저장소의 staged 변경만 봅니다.

### Q. Windows 에서도 hook 이 동작하나요?

네. Git for Windows 가 `.git/hooks/` 의 sh 스크립트를 git-bash 로 자동 실행해줍니다.

### Q. API 키를 어디에 저장하나요?

`~/.smart-msg/config.json` (사용자 홈, 평문 JSON). 사내 보안 정책이 엄격하다면 OS keychain 으로 옮길 계획이 있습니다 — 이슈로 알려주세요.

---

## 🛠 Troubleshooting

### `sm: command not found`

글로벌 설치가 제대로 안 됐습니다. 다음 중 하나:

```bash
npm list -g --depth=0          # smart-msg 가 보이는지 확인
which sm                       # 또는 where sm (Windows)
npm config get prefix          # 글로벌 bin 경로가 PATH 에 있나 확인
```

### `로그인이 필요합니다.`

```bash
sm login
```

### `<provider> API 키가 없습니다.`

provider 를 바꿨는데 그쪽 키가 없는 경우. `sm login` 으로 새 키를 등록하세요.

### Hook 이 동작 안 함

```bash
sm status                      # 설정 확인
ls -la .git/hooks/prepare-commit-msg   # 파일 존재 + 실행 권한
cat .git/hooks/prepare-commit-msg      # 내용 확인 (smart-msg-managed 마커 있어야)
```

---

## 🤝 Contributing

이슈와 PR 환영합니다.

```bash
git clone <repo>
cd smart-msg
npm install
npm run dev -- <command>       # 빌드 없이 실행 (tsx)
npm run build                  # 정식 빌드
```

---

## 📄 License

ISC
