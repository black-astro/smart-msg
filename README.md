<div align="center">

# smart-msg

**AI 기반 Git 커밋 메시지 자동 생성 도구**

staged 된 git diff 를 분석하여 Conventional Commit 형식의 메시지를 자동으로 생성합니다.<br>
Google Gemini, OpenAI, Anthropic Claude 를 지원하며, 한국어와 영어 출력을 모두 제공합니다.

<br>

[![version](https://img.shields.io/badge/version-1.1.51-555555?style=flat-square)](https://www.npmjs.com/package/smart-msg)
[![license](https://img.shields.io/badge/license-ISC-555555?style=flat-square)](#license)
[![node](https://img.shields.io/badge/node-%3E%3D18-555555?style=flat-square)](https://nodejs.org)
[![Gemini](https://img.shields.io/badge/Gemini-free%20tier-34A853?style=flat-square)](https://aistudio.google.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-supported-black?style=flat-square)](https://platform.openai.com)
[![Claude](https://img.shields.io/badge/Claude-supported-black?style=flat-square)](https://www.anthropic.com)

</div>

<br>

---

## 목차

<table>
<tr>
<td>

- [시작하기](#시작하기)
- [Provider 선택 가이드](#provider-선택-가이드)
- [사용 방법](#사용-방법)
- [명령어](#명령어)

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

## 시작하기

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
|  2   | AI provider         | **Google Gemini (무료, 기본)** / OpenAI / Anthropic Claude |
|  3   | 모델                  | provider 별 권장 모델 목록                                  |
|  4   | 메시지 강도              | simple / middle / hard                             |
|  5   | API 키               | 자동으로 열린 발급 페이지에서 발급 후 입력                            |
|  6   | 글로벌 hook 설치 여부      | **Yes** 권장 (모든 git 저장소에서 자동)                       |

> [!NOTE]
> 첫 단계의 언어 선택 화면은 항상 영어로 표시됩니다. 한국어를 선택하시면 이후의 모든 prompt 가 한국어로 자동 전환됩니다.

설정은 `~/.smart-msg/config.json` 에 저장되며, 모든 프로젝트에서 동일하게 사용됩니다.

> [!TIP]
> 6 단계의 글로벌 hook 을 설치하면 별도의 추가 작업 없이 모든 git 저장소에서 자동 메시지 생성이 동작합니다. 프로젝트마다 따로 설정할 필요가 없습니다.

<br>

---

## Provider 선택 가이드

| Provider                | 비용                | 키 발급                                              | 추천 대상                              |
| ----------------------- | ----------------- | ------------------------------------------------- | ---------------------------------- |
| **Google Gemini** ⭐     | 무료 티어 제공          | [Google AI Studio](https://aistudio.google.com/app/apikey) (카드 등록 불필요) | 대부분의 사용자 — 개인 커밋 용도로 한도가 매우 넉넉합니다  |
| OpenAI (GPT)            | 사용량만큼 과금 (유료)     | [OpenAI Platform](https://platform.openai.com/api-keys) (카드 등록 필수)    | OpenAI 생태계를 이미 사용 중인 경우            |
| Anthropic Claude        | 사용량만큼 과금 (유료)     | [Anthropic Console](https://console.anthropic.com/settings/keys) (카드 등록 필수) | Claude 의 메시지 품질을 선호하는 경우           |

> [!IMPORTANT]
> **ChatGPT Plus / Claude Max 등 구독 결제로는 API 호출이 동작하지 않습니다.** 구독 상품과 개발자 API 는 결제 시스템이 분리되어 있으며, OpenAI / Claude 를 사용하시려면 콘솔에서 별도로 카드 등록 또는 크레딧 충전이 필요합니다. **무료로 사용하시려면 Google Gemini 를 선택하시기 바랍니다.**

<br>

---

## 사용 방법

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

? 이 메시지로 커밋을 진행하시겠습니까? › (Y/n)
```

<br>

---

## 명령어

| 명령                          | 설명                                                  |
| --------------------------- | --------------------------------------------------- |
| `sm login`                  | 최초 설정 (언어, provider, 모델, 강도, 키, 글로벌 hook)            |
| `sm c` <sub>(= `sm commit`)</sub> | staged diff 로 메시지를 생성하고 즉시 commit                    |
| `sm config`                 | 언어, 강도, 모델 변경                                      |
| `sm status`                 | 현재 저장된 설정 + 버전(현재/최신) 비교 출력                          |
| `sm update`                 | npm registry 의 최신 버전으로 자체 업데이트                       |
| `sm logout`                 | 저장된 API 키 제거                                       |
| `sm uninstall`              | 모든 설정 및 hook 제거                                    |
| `sm completion <shell>`     | 셸 자동완성 등록 스크립트 출력 (bash/zsh/powershell/clink)        |
| `sm help [command]`         | 도움말 출력. 특정 명령을 인자로 주면 그 명령의 상세 도움말 (예: `sm help commit`) |

<br>

---

## 옵션

### Provider 별 권장 모델

| Provider | 권장 모델                                                            |
| -------- | ---------------------------------------------------------------- |
| Gemini   | `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`  |
| OpenAI   | `gpt-4.1-nano`, `gpt-4o-mini`, `gpt-4.1-mini`                    |
| Claude   | `claude-haiku-4-5`, `claude-3-5-haiku-latest`                    |

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

### 설정 변경

```bash
sm config
```

메뉴에서 언어, 강도, 모델 중 하나를 선택하여 변경합니다. provider 자체를 바꾸려면 `sm login` 을 다시 실행합니다 (다른 provider 의 키는 보존됩니다).

<br>

---

## 업데이트

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
config   : C:\Users\you\.smart-msg\config.json
version  : 1.1.50 → latest 1.1.51  ⇣  run `sm update` to upgrade
```

> [!NOTE]
> 업데이트 후에도 기존 `~/.smart-msg/config.json` 의 설정과 API 키는 그대로 유지됩니다. 다시 로그인할 필요가 없습니다.
>
> 새로 추가된 provider (예: Gemini) 를 사용하려면 `sm login` 을 다시 실행하여 추가 키를 등록할 수 있습니다. 기존 키는 덮어쓰여지지 않습니다.

<br>

---

## 자동완성

`sm <TAB>` 입력 시 서브커맨드(`login`, `logout`, `commit` 등) 가 자동으로 완성되도록 셸별 등록 스크립트를 제공합니다.

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

## 지원 환경

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

## 제거

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

## License

ISC

<br>

<div align="center">
<sub>Built with TypeScript &nbsp;·&nbsp; Powered by Google Gemini, OpenAI &amp; Anthropic Claude</sub>
</div>
