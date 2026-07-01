<div align="center">

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=0:000000,45:022a0e,100:00ff41&height=180&section=header&text=smart-msg&fontSize=50&fontColor=00ff41&fontAlignY=38&desc=AI-powered%20Git%20commit%20message%20generator&descAlignY=60&descSize=15&animation=fadeIn"/>

**AI 기반 Git 커밋 메시지 자동 생성 도구**

staged 된 git diff 를 분석하여 Conventional Commit 형식의 메시지를 자동으로 생성합니다.<br>
Google Gemini, Groq (Llama), OpenAI, Anthropic Claude, Ollama (로컬) 를 지원하며, 한국어와 영어 출력을 모두 제공합니다.

<br>

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js%20%E2%89%A518-000000?style=for-the-badge&logo=node.js&logoColor=00ff41)
![npm](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)
![Anthropic](https://img.shields.io/badge/Claude-D97757?style=for-the-badge&logo=anthropic&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=00ff41)

<br>

[![version](https://img.shields.io/badge/version-1.3.0-00ff41?style=flat-square&labelColor=0d0208)](https://www.npmjs.com/package/smart-msg)
[![license](https://img.shields.io/badge/license-ISC-00ff41?style=flat-square&labelColor=0d0208)](#-license)
[![node](https://img.shields.io/badge/node-%3E%3D18-00ff41?style=flat-square&labelColor=0d0208)](https://nodejs.org)

</div>

<br>

<br>

---

## `$ 목차`

<table>
<tr>
<td>

- [시작하기](#시작하기)
- [Provider 선택 가이드](#provider-선택-가이드)
- [사용 방법](#사용-방법)
- [명령어](#명령어)
- [1.3.0 신규 기능](#130-신규-기능)

</td>
<td>

- [옵션](#옵션)
- [업데이트](#업데이트)
- [자동완성](#자동완성)
- [지원 환경](#지원-환경)
- [제거](#제거)

</td>
</tr>
</table>

<br>

---

## `$ 시작하기`

단 두 단계로 모든 설정이 완료됩니다.

### 1. 설치

```bash
npm install -g smart-msg
```

> [!NOTE]
> Node.js 18 이상이 필요합니다. nvm 사용자라면 `nvm use 24` 권장.

### 2. 로그인

```bash
sm login
```

다음 항목을 차례로 선택합니다.

|  단계  | 항목                  | 선택지                                                |
| :--: | ------------------- | -------------------------------------------------- |
|  1   | **언어 (Language)**   | **English (기본)** / 한국어 — 이후 모든 prompt 가 선택 언어로 진행 |
|  2   | AI provider         | **Google Gemini (무료, 기본)** / Groq / OpenAI / Claude / Ollama (로컬) |
|  3   | 모델                  | provider 별 권장 모델 목록                                  |
|  4   | 메시지 강도              | simple / middle / hard                             |
|  5   | API 키               | 자동으로 열린 발급 페이지에서 발급 후 입력 (Ollama 는 키 불필요)            |
|  6   | 글로벌 hook 설치 여부      | **Yes** 권장 (모든 git 저장소에서 자동)                       |

> [!NOTE]
> 첫 단계의 언어 선택 화면은 항상 영어로 표시됩니다. 한국어를 선택하시면 이후의 모든 prompt 가 한국어로 자동 전환됩니다.

설정은 `~/.smart-msg/config.json` 에 저장되며, 모든 프로젝트에서 동일하게 사용됩니다.

> [!TIP]
> 6 단계의 글로벌 hook 을 설치하면 별도의 추가 작업 없이 모든 git 저장소에서 자동 메시지 생성이 동작합니다. 프로젝트마다 따로 설정할 필요가 없습니다.

<br>

---

## `$ Provider 선택 가이드`

| Provider                | 비용                | 키 발급                                              | 추천 대상                              |
| ----------------------- | ----------------- | ------------------------------------------------- | ---------------------------------- |
| **Groq (Llama)** ⭐      | 무료 티어 제공          | [Groq Console](https://console.groq.com/keys) (카드 등록 불필요) | **무료 사용 권장** — 자체 LPU 인프라로 503 거의 없음 + 매우 빠름 |
| Google Gemini           | 무료 티어 제공          | [Google AI Studio](https://aistudio.google.com/app/apikey) (카드 등록 불필요) | 무료 티어 트래픽이 몰리면 503 자주 발생할 수 있음     |
| **Ollama (로컬)** 🔒      | 완전 무료 (로컬)        | 키 불필요                                            | 인터넷 단절 / 회사 보안 환경 — 코드가 외부로 나가지 않음 |
| OpenAI (GPT)            | 사용량만큼 과금 (유료)     | [OpenAI Platform](https://platform.openai.com/api-keys) (카드 등록 필수)    | OpenAI 생태계를 이미 사용 중인 경우            |
| Anthropic Claude        | 사용량만큼 과금 (유료)     | [Anthropic Console](https://console.anthropic.com/settings/keys) (카드 등록 필수) | Claude 의 메시지 품질을 선호하는 경우           |

> [!IMPORTANT]
> **ChatGPT Plus / Claude Max 등 구독 결제로는 API 호출이 동작하지 않습니다.** 구독 상품과 개발자 API 는 결제 시스템이 분리되어 있으며, OpenAI / Claude 를 사용하시려면 콘솔에서 별도로 카드 등록 또는 크레딧 충전이 필요합니다. **무료로 사용하시려면 Groq, Google Gemini, 또는 Ollama 를 선택하시기 바랍니다.**

> [!NOTE]
> Gemini 무료 티어는 인기 많은 시간대에 503 (high demand) 응답이 자주 발생할 수 있습니다. 자동 재시도가 적용되어 있긴 하지만 빈도가 높다면 **Groq 으로 전환**을 권장합니다 (`sm login` 다시 실행). 또는 `sm config` → `fallback` 에서 Groq 을 폴백으로 등록해두시면, Gemini 실패 시 자동으로 Groq 으로 전환합니다.

### Ollama 사용 시

Ollama 는 로컬에 LLM 을 실행하는 도구입니다. 코드가 외부 서버로 전송되지 않으므로 회사 보안 환경에 적합합니다.

```bash
# 1) Ollama 설치 (https://ollama.com)
# 2) 모델 미리 받기
ollama pull llama3.2

# 3) smart-msg 등록
sm login   # provider 선택에서 'Ollama' 선택, 모델은 llama3.2 입력
```

기본 endpoint 는 `http://localhost:11434` 이며, 원격 Ollama 서버를 사용하시려면 `sm config` → `baseUrl` 에서 변경할 수 있습니다.

<br>

---

## `$ 사용 방법`

설치와 로그인이 완료되었다면, 이후의 사용은 평소 git 사용과 동일합니다.

```bash
git add .
git commit
```

`git commit` 명령을 실행하면 AI 가 staged 된 변경분을 분석하여 메시지를 자동으로 채워줍니다. 에디터(또는 IDE 커밋 창)에서 메시지를 검토한 뒤 그대로 commit 하거나 수정하여 commit 합니다.

### 동작 예시

```text
$ git add .
$ git commit

# 에디터(또는 IDE 커밋 창)에 다음 메시지가 자동 입력됩니다.
feat(auth): add OAuth login flow
```

### 명령줄에서 직접 호출하는 방식 (선택)

IDE 커밋 창 대신 터미널에서 즉시 메시지를 생성하고 commit 까지 한 번에 진행하려면 다음을 사용합니다.

```bash
git add .
sm c
```

```text
$ sm c

생성된 커밋 메시지:
feat(auth): add OAuth login flow

  y: 그대로 commit
  r: 메시지 다시 생성
  e: 에디터로 열어 수정 후 commit
  n: 취소
? 이 메시지로 커밋을 진행하시겠습니까? [Y/r/e/n]
```

- `y` (또는 Enter) — 그대로 commit
- `r` — AI 가 다시 메시지 생성 (최대 5회)
- `e` — `$EDITOR` (또는 git core.editor) 로 메시지를 열어 수정 후 commit
- `n` — 취소

`sm c --dry-run` 을 사용하면 commit 없이 메시지만 생성하여 출력합니다.

<br>

---

## `$ 명령어`

| 명령                          | 설명                                                  |
| --------------------------- | --------------------------------------------------- |
| `sm login`                  | 최초 설정 (언어, provider, 모델, 강도, 키, 글로벌 hook)            |
| `sm c` <sub>(= `sm commit`)</sub> | staged diff 로 메시지를 생성하고 즉시 commit (y/r/e/n 선택)   |
| `sm c --dry-run`            | commit 없이 메시지만 생성하여 출력                              |
| `sm c --intent "..."`       | 이번 변경의 "왜" 한 줄을 명시 (1.3.0+)                          |
| `sm c --skip-risk`          | 위험도 평가/confirm 건너뜀 (1.3.0+)                          |
| `sm c --skip-revert`        | revert 감지 건너뜀 (1.3.0+)                                |
| `sm v` <sub>(= `sm voice`)</sub> | 음성 녹음 → Whisper 전사 → intent → commit (1.3.0+)      |
| `sm v --file <path>`        | 미리 녹음한 오디오 파일로 전사 (1.3.0+)                           |
| `sm pr [--base <ref>]`      | 현재 브랜치의 base..HEAD 변경으로 PR 본문 (Summary + Test plan) 생성 |
| `sm amend`                  | 마지막 commit 의 메시지를 AI 로 재생성하여 amend                  |
| `sm split [--no-ai]`        | 큰 staged diff 분할 제안 — 로컬 휴리스틱 + AI 두 제안 (1.3.0+ 로컬 추가) |
| `sm style learn / show / clear` | 저장소 commit 스타일 학습 → prompt 자동 반영 (1.3.0+)         |
| `sm config`                 | 언어/강도/모델/톤/gitmoji/autoIssue/fallback/verbose/baseUrl/intent/risk/revert/privacy 변경 |
| `sm status`                 | 현재 저장된 설정 + 버전(현재/최신) 비교 출력                          |
| `sm update`                 | npm registry 의 최신 버전으로 자체 업데이트                       |
| `sm logout`                 | 저장된 API 키 제거 (다른 설정/hook 정보는 보존)                   |
| `sm uninstall`              | 모든 설정 및 hook 제거                                    |
| `sm completion <shell>`     | 셸 자동완성 등록 스크립트 출력 (bash/zsh/powershell/clink)        |
| `sm help [command]`         | 도움말 출력. 특정 명령을 인자로 주면 그 명령의 상세 도움말 (예: `sm help commit`) |

### sm pr 활용

```bash
# 자동 base 탐지 (origin/main → main → master → develop 순)
sm pr

# 특정 base 지정
sm pr --base origin/develop

# gh CLI 와 파이프 연결로 바로 PR 생성
sm pr | gh pr create --body-file -
```

### sm amend 활용

```bash
# 마지막 commit 메시지가 마음에 안 들 때 (push 전)
sm amend
# → 마지막 commit 의 diff 로 새 메시지를 AI 가 생성
# → y/r/e/n 선택 후 git commit --amend
```

<br>

---

## `$ 1.3.0 신규 기능`

1.3.0 은 commit 워크플로우 자체를 한 단계 발전시키는 7 가지 기능을 추가했습니다. 모두 **기본값에서 비차단성** (안내만, 사용자 흐름 끊지 않음) 이고 옵션으로 끄거나 강화할 수 있습니다.

### 1. Intent capture — 커밋 전 "왜" 한 줄 입력

diff 만 분석하면 "무엇을 바꿨는지" 는 잘 잡지만 "왜" 는 잡히지 않습니다. `sm c` 가 메시지 생성 직전 한 줄 의도를 받아 prompt 의 별도 블록으로 주입합니다.

```bash
sm c                          # 인터랙티브 prompt (빈 Enter 로 스킵)
sm c --intent "IE 로그인 루프 수정"  # 인라인 명시
sm c --no-intent              # prompt 강제 스킵 (always 모드도 우회)
SM_INTENT="..." sm c          # non-TTY (hook/CI) 환경용
```

`sm config` → `captureIntent`: `ask` (기본) / `always` (필수) / `never`

### 2. Risk score + 시간대 게이트

staged diff 의 영향도를 휴리스틱으로 **1~5점** 평가. DB migration, prod env, CI 설정, 큰 diff 등이 가산. 금요일 18시+ / 주말 / 야간 (22:00~06:00) 은 별도 **시간대 경고**.

```
위험도 평가:
  점수    : ★★★★☆ (4/5)
  - DB migration
  - CI/CD config
  시간대  : ⚠ 위험 시간대 (Friday 18:00+)
고위험 변경입니다. 그래도 진행하시겠습니까? [y/N]
```

`sm config` → `riskCheck`: `warn` (기본 — 4점+ AND 위험 시간대만 confirm) / `on` (4점+ 항상 confirm) / `off`

### 3. Auto-revert detector

`sm c` 가 staged 변경을 **최근 N 개 (기본 20) commit** 의 patch 와 비교해, 이 commit 이 과거 commit 을 (부분) 되돌리는지 감지하고 안내합니다. "fix A 했는데 며칠 뒤 무관한 작업에서 그 라인을 되돌려 A 재발" 패턴을 잡습니다.

```
⚠ 최근 commit 을 되돌릴 가능성 (2 건):
src/auth.ts: removes line(s) added in abc1234 "auth: persist session token"
    - session.token = token;
```

`sm config` → `revertCheck`: `on` (기본) / `off`. `revertLookback` 으로 스캔 깊이 조정.

### 4. Repo style learner

`sm style learn` 으로 저장소의 commit 메시지 스타일 (CC 채택률, 자주 쓰는 type/scope, 본문 길이, bullet 스타일, 출력 언어, 이슈 footer 형식 등) 을 학습 → `~/.smart-msg/styles/<repoKey>.json` 저장 → 이후 `sm c` 가 prompt 에 **자동 주입**.

```bash
sm style learn               # 최근 200 개 분석 (--sample 으로 조정, 10~2000)
sm style show                # 현재 프로필 출력
sm style clear               # 프로필 제거
```

generic Conventional Commits 가 아니라 **"그 팀이 쓴 듯한 톤"** 이 나오게 만드는 장기 lock-in 기능.

### 5. Semantic split — 로컬 휴리스틱 분류

`sm split` 이 LLM 없이 파일 경로/내용으로 카테고리를 즉시 분류하고 권장 분할 + git 명령 시퀀스를 출력. AI 텍스트 제안과 **병행** 노출.

```bash
sm split            # 로컬 + AI 둘 다
sm split --no-ai    # 로컬만 (네트워크/비용 절감)
```

카테고리: `formatting` / `docs` / `tests` / `ci` / `deps` / `config` / `typesOnly` / `feature`. 정렬: 부수적인 것 먼저, 큰 feature 가 마지막.

### 6. Privacy mode — 의미 보존 PII 토큰화

기존 `[REDACTED]` 마스킹 위에 **의미 보존 토큰화** 추가. email/JWT/UUID/IP/CC/phone/auth-URL 등이 `<EMAIL_1>`, `<UUID_1>`, ... 형태로 치환되며 **같은 값은 같은 토큰**. 모델이 의미를 잃지 않고 메시지 작성 가능.

`sm config` → `privacyMode`: `off` / `standard` (기본 — 보편 PII) / `strict` (+일반 URL +Bearer)

IPv4 옥텟 검증 + 신용카드 Luhn 검증으로 false positive 차단.

### 7. Voice-driven commit

`sm v` (alias `sm voice`) — ffmpeg 마이크 녹음 또는 `--file` 입력 → Whisper API 전사 → 그 텍스트를 intent 로 사용해 `sm c` 흐름 진입. 큰 변경에 긴 본문이 필요할 때 typing 비용 0.

```bash
sm v                         # 10초 녹음
sm v --seconds 20            # 20초 녹음
sm v --file pre-recorded.wav # ffmpeg 불필요
sm v --dry-run               # 메시지만 출력
```

OpenAI 키 필요 (메인 provider 가 openai 가 아니어도 `openaiApiKey` 만 있으면 동작). 10 초 클립 비용 ≈ **$0.0001 USD**.

<br>

---

## `$ 옵션`

### Provider 별 권장 모델

| Provider | 권장 모델                                                                          |
| -------- | ------------------------------------------------------------------------------ |
| Gemini   | `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`                |
| Groq     | `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `gemma2-9b-it`              |
| OpenAI   | `gpt-4.1-nano`, `gpt-4o-mini`, `gpt-4.1-mini`                                  |
| Claude   | `claude-haiku-4-5`, `claude-3-5-haiku-latest`                                  |
| Ollama   | `llama3.2`, `qwen2.5-coder`, `mistral`, `phi3` (또는 직접 입력)                    |

### Language

|  값  | 출력 언어                                          |
| :-: | ---------------------------------------------- |
| `ko` | 한국어 (`feat`, `fix` 등 type 키워드는 영어 유지) |
| `en` | 영어                                            |

<br>

### Strength

메시지의 길이와 상세도를 결정합니다.

<details>
<summary><b>simple</b> &nbsp;—&nbsp; 한 줄 (Conventional Commit 형식)</summary>

<br>

```
feat(auth): add OAuth login flow
```

</details>

<details>
<summary><b>middle</b> &nbsp;—&nbsp; 첫 줄 + 본문 2~5줄</summary>

<br>

```
feat(auth): add OAuth login flow

- PKCE 기반 OAuth 콜백 처리 추가
- 로컬 콜백 서버를 임시로 생성
- 발급된 토큰을 ~/.smart-msg/config.json 에 저장
```

</details>

<details>
<summary><b>hard</b> &nbsp;—&nbsp; 첫 줄 + README 수준 본문</summary>

<br>

```
feat(auth): add OAuth login flow

기존 API 키 입력 방식은 매번 발급 페이지로 이동하여 복사 및 붙여넣기를
수행하는 부담이 있었습니다. 표준 OAuth 흐름을 도입하여 이를 해소합니다.

- PKCE flow 로 토큰을 안전하게 획득
- 로컬 8765 포트에 임시 콜백 서버 운영
- 토큰은 OS keychain 에 보관
- 토큰 만료 시 자동 갱신

영향: 기존 API 키 사용자의 동작은 변경되지 않습니다.
```

</details>

### Tone (한국어 출력 종결 톤)

한국어 출력에만 적용되는 본문 종결 스타일입니다. 영어 출력에는 영향이 없습니다.

|  값        | 출력 예시                                                    |
| --------- | -------------------------------------------------------- |
| `report` (기본) | `메뉴 항목 추가`, `엔드포인트 분리`, `스레드 풀 제거. 필요 시 추후 확장.` (명사형/음슴체) |
| `polite`  | `~를 추가했습니다.`, `~로 변경했습니다.`, `~를 분리하기 위해 변경했습니다.` (정중체)  |

`sm config` → `tone` 메뉴에서 변경 가능합니다.

> [!NOTE]
> 신규 설치 + 기존 설치(미설정) 모두 `report` 톤이 기본 적용됩니다. commit 메시지는 짧은 기술 보고서 톤이 자연스럽다는 판단입니다. 정중체를 원하시면 `sm config` 에서 `polite` 로 전환하시기 바랍니다.

### Gitmoji (이모지 prefix)

`sm config` → `gitmoji` 를 `on` 으로 설정하면 commit type 앞에 이모지가 자동으로 붙습니다.

```
✨ feat(auth): add OAuth login flow
🐛 fix(parser): handle empty input
♻️ refactor(api): split endpoint by pageType
```

매핑: `feat → ✨`, `fix → 🐛`, `docs → 📝`, `refactor → ♻️`, `perf → ⚡️`, `test → ✅`, `chore → 🔧`, `build → 📦`, `style → 💄`

### Auto Issue (브랜치명 → 이슈키 footer 자동 첨부)

`sm config` → `autoIssue` 를 `on` 으로 설정하면 현재 브랜치명에서 이슈 키를 추출하여 commit 메시지 footer 에 `Refs:` 로 자동 첨부합니다.

```bash
git checkout -b feature/AUTH-123-oauth-login
git add .
sm c
# →
# feat(auth): add OAuth login flow
#
# - PKCE 기반 OAuth 콜백 처리 추가
# ...
#
# Refs: AUTH-123
```

추출 패턴:
- JIRA 류: `AUTH-123`, `PROJ-9999` 등 (대문자 prefix + 숫자)
- GitHub 류: `#123`, `gh-123`, `issue-123`, `issue/123` 등

### Fallback Provider

`sm config` → `fallback` 에서 폴백 provider 를 등록하면, 메인 provider 가 실패 (503, timeout 등) 했을 때 자동으로 다른 provider 로 재시도합니다.

```
provider : gemini    ← 메인
fallback : groq      ← Gemini 503 시 자동으로 Groq 호출
```

두 provider 의 키가 모두 `sm login` 으로 등록되어 있어야 동작합니다.

### Verbose / 디버그

문제 진단이 필요할 때 `sm config` → `verbose` 를 `on` 으로 설정하면 prompt 와 응답이 stderr 에 출력됩니다. 환경변수로도 활성화 가능합니다.

```bash
SM_DEBUG=1 sm c
```

### Diff 마스킹 (자동)

`.env` 류의 secret, AWS/GitHub 토큰, PEM private key 등은 AI 에 보내기 전 자동으로 `[REDACTED]` 로 마스킹됩니다. 사용자가 실수로 secret 을 staged 한 경우의 1차 방어선입니다.

> [!WARNING]
> 마스킹은 완전한 보호 수단이 아닙니다. secret 파일은 `.gitignore` 처리하는 것이 우선입니다.

### On-failure (AI 호출 실패 시 동작)

|  값        | 동작                                                           |
| --------- | ------------------------------------------------------------ |
| `fallback` (기본) | 안내 코멘트가 담긴 빈 템플릿을 적어 git 에디터가 열림. 사용자가 직접 메시지 작성 가능 |
| `abort`   | 메시지를 비워둬 git 이 commit 자체를 취소                                 |

`sm config` → `on-failure` 메뉴에서 변경 가능.

> [!NOTE]
> Gemini 의 503 (high demand), 일시 네트워크 단절 등으로 AI 메시지 생성이 실패하는 경우가 있습니다. 자동 재시도(429/5xx 대상, 백오프 0.6초·1.2초, 단일 호출 30초 타임아웃) + 폴백 provider (등록 시) 가 1차 방어선이며, 그래도 실패한 경우 위 옵션이 적용됩니다.

### Custom Base URL (Azure OpenAI / 원격 Ollama 등)

`sm config` → `baseUrl` 에서 OpenAI 호환 endpoint 또는 원격 Ollama 서버의 URL 을 지정할 수 있습니다.

- OpenAI: Azure OpenAI, OpenRouter, 자체 호스팅 vLLM 등에 사용 (`https://your-resource.openai.azure.com/...`)
- Ollama: 원격 머신에서 실행 중인 Ollama (`http://192.168.1.10:11434`)

### 설정 변경

```bash
sm config
```

메뉴에서 변경할 항목을 선택합니다. provider 자체를 바꾸려면 `sm login` 을 다시 실행합니다 (다른 provider 의 키는 보존됩니다).

<br>

---

## `$ 업데이트`

```bash
sm update
```

`sm update` 를 실행하면 현재 버전과 npm registry 의 최신 버전을 비교한 뒤, 다른 경우에 한해 자동으로 `npm install -g smart-msg@latest` 를 수행합니다.

수동으로 진행하시려면 다음과 동일합니다.

```bash
npm install -g smart-msg@latest
```

### 버전 확인

```bash
sm --version       # 현재 버전만 출력
sm status          # 현재 버전 + 최신 버전 비교 + 설정 정보 함께 출력
```

`sm status` 출력 예시:

```text
provider : gemini
model    : gemini-2.5-flash
language : ko
strength : middle
tone     : report
gitmoji  : off
autoIssue: on
fallback : groq
onFail   : fallback
verbose  : off
config   : C:\Users\you\.smart-msg\config.json
version  : 1.1.54 → latest 1.2.0  ⇣  run `sm update` to upgrade
```

> [!NOTE]
> 업데이트 후에도 기존 `~/.smart-msg/config.json` 의 설정과 API 키는 그대로 유지됩니다. 다시 로그인할 필요가 없습니다.
>
> 새로 추가된 provider (예: Ollama) 를 사용하려면 `sm login` 을 다시 실행하여 추가 키를 등록할 수 있습니다. 기존 키는 덮어쓰여지지 않습니다.

<br>

---

## `$ 자동완성`

`sm <TAB>` 입력 시 서브커맨드(`login`, `logout`, `commit`, `pr`, `amend`, `split` 등) 가 자동으로 완성되도록 셸별 등록 스크립트를 제공합니다.

### bash

```bash
echo 'eval "$(sm completion bash)"' >> ~/.bashrc
source ~/.bashrc
```

### zsh

```bash
echo 'eval "$(sm completion zsh)"' >> ~/.zshrc
source ~/.zshrc
```

### PowerShell

```powershell
sm completion powershell | Out-String | Invoke-Expression
```

영구 적용을 원하시는 경우 위 줄을 `$PROFILE` 파일에 추가합니다. (`notepad $PROFILE`)

### clink (Windows cmd 사용자)

`cmd.exe` 자체는 사용자 정의 자동완성을 지원하지 않습니다. [clink](https://chrisant996.github.io/clink) 를 설치하시면 cmd 위에서도 자동완성이 동작합니다.

```cmd
sm completion clink > %LOCALAPPDATA%\clink\sm.lua
```

새 cmd 창부터 자동완성이 적용됩니다.

> [!NOTE]
> 순수 `cmd.exe` 는 자동완성을 지원하지 않습니다. PowerShell 또는 clink 를 사용하시기 바랍니다.

<br>

---

## `$ 지원 환경`

`smart-msg` 는 git 명령이 동작하는 모든 환경에서 동일하게 사용할 수 있습니다.

### 터미널

Git Bash, PowerShell, Windows CMD, macOS Terminal, iTerm2, Linux Bash / Zsh 모두 별도 설정 없이 동작합니다.

> [!NOTE]
> PowerShell 에서 `sm` 실행이 차단되는 경우 다음 명령으로 정책을 완화합니다.
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

### IDE

| IDE | 사용 방법 |
| --- | --- |
| IntelliJ IDEA / WebStorm / PyCharm | `Ctrl + K` 로 커밋 창을 열면 메시지가 자동으로 채워집니다 |
| VS Code, Cursor | `Ctrl + Shift + G` 로 Source Control 패널을 열고 commit 시 메시지가 자동으로 채워집니다 |
| 그 외 IDE | 내장 터미널이 있는 모든 IDE 에서 동일하게 동작합니다 |

> [!TIP]
> IDE 커밋 창 통합은 `sm login` 의 마지막 단계에서 글로벌 hook 을 설치한 경우에만 동작합니다. 설치하지 않은 경우 `sm login` 을 다시 실행하여 활성화할 수 있습니다.

### 비 Node.js 프로젝트

`smart-msg` 는 글로벌 CLI 이므로 프로젝트 언어와 무관하게 동작합니다. Java, Python, Go 등 어떤 언어 프로젝트에서도 동일하게 사용할 수 있으며, `node_modules` 폴더가 프로젝트에 생성되지 않습니다.

<br>

---

## `$ 제거`

```bash
sm uninstall
npm uninstall -g smart-msg
```

`sm uninstall` 이 다음 항목을 모두 정리합니다.

- 설정 디렉토리 (`~/.smart-msg/`)
- 글로벌 git hook 설정 (이전 값이 있다면 복원)
- 프로젝트별 설치된 hook (있는 경우)

이후 `npm uninstall -g smart-msg` 로 패키지 본체를 제거하면 완전히 정리됩니다.

> [!WARNING]
> npm 은 글로벌 패키지 uninstall 시 lifecycle script 의 실행을 차단합니다. `sm uninstall` 을 먼저 실행하지 않으면 `~/.smart-msg/` 가 그대로 남아 API 키도 보존됩니다.

<br>

---

## `$ License`

ISC

<br>

<br>

<div align="center">
<sub>Built with TypeScript &nbsp;·&nbsp; Powered by Google Gemini, Groq, OpenAI, Anthropic Claude &amp; Ollama</sub>

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=0:00ff41,45:022a0e,100:000000&height=100&section=footer"/>
</div>
