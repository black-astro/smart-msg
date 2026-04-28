<div align="center">

# smart-msg

**AI 기반 Git 커밋 메시지 자동 생성 도구**

staged 된 git diff 를 분석하여 Conventional Commit 형식의 메시지를 자동으로 생성합니다.<br>
OpenAI 와 Anthropic Claude 를 지원하며, 한국어와 영어 출력을 모두 제공합니다.

<br>

[![version](https://img.shields.io/badge/version-1.0.0-555555?style=flat-square)](https://github.com/black-astro/smart-msg)
[![license](https://img.shields.io/badge/license-ISC-555555?style=flat-square)](#license)
[![node](https://img.shields.io/badge/node-%3E%3D18-555555?style=flat-square)](https://nodejs.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-supported-black?style=flat-square)](https://platform.openai.com)
[![Claude](https://img.shields.io/badge/Claude-supported-black?style=flat-square)](https://www.anthropic.com)

</div>

<br>

```bash
git add .
sm c
```

위 두 명령으로 staged 변경분에 대한 커밋 메시지가 추천되며, 확인 후 커밋이 진행됩니다.

```text
$ sm c

생성된 커밋 메시지:
feat(auth): add OAuth login flow

? 이 메시지로 커밋을 진행하시겠습니까? › (Y/n)
```

<br>

---

## 목차

<table>
<tr>
<td>

- [설치](#설치)
- [최초 설정](#최초-설정)
- [기본 사용법](#기본-사용법)
- [명령어](#명령어)

</td>
<td>

- [옵션](#옵션)
- [Git Hook](#git-hook)
- [제거](#제거)

</td>
</tr>
</table>

<br>

---

## 설치

### npm 글로벌 설치 (권장)

```bash
npm install -g smart-msg
```

설치 시 `prepare` 스크립트가 자동으로 빌드를 수행하므로, 별도의 후속 절차는 필요하지 않습니다.

### GitHub repository 직접 설치

npm registry 에 게시되지 않은 환경 또는 사내 환경에서는 GitHub repository 에서 직접 설치할 수 있습니다.

```bash
npm install -g git+https://github.com/black-astro/smart-msg.git
```

특정 태그를 고정하려면 `#v1.0.0` 과 같이 지정합니다.

```bash
npm install -g git+https://github.com/black-astro/smart-msg.git#v1.0.0
```

### 동작 환경

- Node.js 18 이상
- git 2.x 이상
- Windows / macOS / Linux 모두 지원

설치가 완료되면 다음 명령으로 동작을 확인할 수 있습니다.

```bash
sm --version
```

> [!NOTE]
> 설치 직후 [최초 설정](#최초-설정) 단계로 진행하시기 바랍니다. `sm login` 의 마지막 단계에서 현재 프로젝트가 git 저장소인 경우 자동으로 hook 설치 여부를 묻습니다. 이 흐름을 따르면 IDE 커밋 창 통합까지 한 번에 완료됩니다.

<br>

---

## 최초 설정

```bash
sm login
```

다음 네 가지 항목을 차례로 선택합니다.

|  단계  | 항목                  | 선택지                          |
| :--: | ------------------- | ---------------------------- |
|  1   | AI provider         | OpenAI / Anthropic Claude    |
|  2   | 모델                  | provider 별 권장 모델 목록           |
|  3   | 출력 언어               | 한국어 / 영어                     |
|  4   | 메시지 강도              | simple / middle / hard       |

선택이 완료되면 브라우저에서 API 키 발급 페이지가 자동으로 열립니다. 키 발급 후 입력란에 입력하여 등록을 마칩니다.

> [!NOTE]
> 설정은 `~/.smart-msg/config.json` 에 저장되며, 모든 프로젝트에서 동일하게 사용됩니다. 최초 1회만 수행하면 됩니다.

<br>

---

## 기본 사용법

#### 1. 변경사항 스테이징

```bash
git add .
```

#### 2. 커밋 실행

```bash
sm c
```

생성된 메시지가 출력되며, 확인 입력 후 자동으로 커밋이 진행됩니다.

<br>

---

## 명령어

| 명령                          | 설명                                                  |
| --------------------------- | --------------------------------------------------- |
| `sm login`                  | provider, 모델, 언어, 강도, API 키를 처음 설정합니다              |
| `sm c` <sub>(= `sm commit`)</sub> | staged diff 를 기반으로 메시지를 생성하고 커밋합니다                   |
| `sm config`                 | 언어, 강도, 모델 설정을 변경합니다                                |
| `sm status`                 | 현재 저장된 설정을 출력합니다                                    |
| `sm install-hook`           | 현재 프로젝트에 git prepare-commit-msg hook 을 설치합니다        |
| `sm logout`                 | 저장된 API 키를 제거합니다                                    |
| `sm uninstall`              | 모든 설정 및 hook 을 제거합니다                                |

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

<br>

### 설정 변경

```bash
sm config
```

메뉴에서 언어, 강도, 모델 중 하나를 선택하여 변경합니다.

<br>

---

## Git Hook

기본 사용 방식은 `sm c` 명령이지만, IntelliJ 의 커밋 창이나 VS Code 의 commit 창과 같이 IDE 내부에서 `git commit` 을 호출하는 환경에서는 hook 을 설치해야 자동 메시지 생성이 동작합니다.

```bash
cd /path/to/project
sm install-hook
```

<table>
<thead>
<tr>
<th align="left">상황</th>
<th align="left">동작</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>git commit</code> &nbsp;<sub>(메시지 미지정)</sub></td>
<td>AI 가 메시지를 자동 생성합니다</td>
</tr>
<tr>
<td>IntelliJ 커밋 창</td>
<td>AI 가 메시지를 자동 생성합니다</td>
</tr>
<tr>
<td><code>git commit -m "..."</code></td>
<td>hook 이 비켜서며 사용자 메시지를 우선합니다</td>
</tr>
<tr>
<td><code>git commit --amend</code></td>
<td>기존 메시지를 보호합니다</td>
</tr>
<tr>
<td>merge / squash 커밋</td>
<td>보호합니다</td>
</tr>
<tr>
<td>AI 호출 실패</td>
<td>커밋 자체는 정상 진행됩니다</td>
</tr>
<tr>
<td>staged 변경 없음</td>
<td>AI 를 호출하지 않습니다</td>
</tr>
</tbody>
</table>

> [!TIP]
> hook 은 프로젝트당 1회만 설치하면 됩니다. 설치된 hook 은 `sm uninstall` 실행 시 한꺼번에 제거됩니다.

<br>

---

## 제거

```bash
sm uninstall
```

설정 디렉토리(`~/.smart-msg/`)와 설치된 hook 을 모두 제거합니다.

<br>

---

## License

ISC

<br>

<div align="center">
<sub>Built with TypeScript &nbsp;·&nbsp; Powered by OpenAI &amp; Anthropic Claude</sub>
</div>
