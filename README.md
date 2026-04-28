<div align="center">

# smart-msg

**AI 기반 Git 커밋 메시지 자동 생성 도구**

staged 된 git diff 를 분석하여 Conventional Commit 형식의 메시지를 자동으로 생성합니다.<br>
OpenAI 와 Anthropic Claude 를 지원하며, 한국어와 영어 출력을 모두 제공합니다.

<br>

[![version](https://img.shields.io/badge/version-1.0.1-555555?style=flat-square)](https://www.npmjs.com/package/smart-msg)
[![license](https://img.shields.io/badge/license-ISC-555555?style=flat-square)](#license)
[![node](https://img.shields.io/badge/node-%3E%3D18-555555?style=flat-square)](https://nodejs.org)
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
- [사용 방법](#사용-방법)
- [명령어](#명령어)

</td>
<td>

- [옵션](#옵션)
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

|  단계  | 항목                  | 선택지                          |
| :--: | ------------------- | ---------------------------- |
|  1   | AI provider         | OpenAI / Anthropic Claude    |
|  2   | 모델                  | provider 별 권장 모델 목록           |
|  3   | 출력 언어               | 한국어 / 영어                     |
|  4   | 메시지 강도              | simple / middle / hard       |
|  5   | API 키               | 자동으로 열린 발급 페이지에서 발급 후 입력      |
|  6   | 글로벌 hook 설치 여부      | **Yes** 권장 (모든 git 저장소에서 자동) |

설정은 `~/.smart-msg/config.json` 에 저장되며, 모든 프로젝트에서 동일하게 사용됩니다.

> [!TIP]
> 6 단계의 글로벌 hook 을 설치하면 별도의 추가 작업 없이 모든 git 저장소에서 자동 메시지 생성이 동작합니다. 프로젝트마다 따로 설정할 필요가 없습니다.

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
| `sm login`                  | 최초 설정 (provider, 모델, 언어, 강도, 키, 글로벌 hook)            |
| `sm c` <sub>(= `sm commit`)</sub> | staged diff 로 메시지를 생성하고 즉시 commit                    |
| `sm config`                 | 언어, 강도, 모델 변경                                      |
| `sm status`                 | 현재 저장된 설정 출력                                       |
| `sm logout`                 | 저장된 API 키 제거                                       |
| `sm uninstall`              | 모든 설정 및 hook 제거                                    |

<br>

---

## 옵션

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

메뉴에서 언어, 강도, 모델 중 하나를 선택하여 변경합니다.

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
<sub>Built with TypeScript &nbsp;·&nbsp; Powered by OpenAI &amp; Anthropic Claude</sub>
</div>
