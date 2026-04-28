# smart-msg

`smart-msg` 는 staged 된 git diff 를 분석하여 Conventional Commit 형식의 커밋 메시지를 자동으로 생성하는 CLI 도구입니다. OpenAI 와 Anthropic Claude 를 지원하며, 한국어와 영어 출력을 모두 제공합니다.

```bash
git add .
sm c
```

위 두 명령으로 staged 변경분에 대한 커밋 메시지가 추천되며, 확인 후 커밋이 진행됩니다.

---

## 사용 방법

### 1. 최초 설정

```bash
sm login
```

다음 네 가지 항목을 차례로 선택합니다.

1. AI provider — OpenAI 또는 Anthropic Claude
2. 모델 — provider 별 권장 모델 목록에서 선택
3. 출력 언어 — 한국어 또는 영어
4. 메시지 강도 — simple / middle / hard

선택이 완료되면 브라우저에서 API 키 발급 페이지가 자동으로 열립니다. 키 발급 후 입력란에 입력하여 등록을 마칩니다. 설정은 `~/.smart-msg/config.json` 에 저장되며 모든 프로젝트에서 동일하게 사용됩니다.

### 2. 변경사항 스테이징

```bash
git add .
```

### 3. 커밋

```bash
sm c
```

생성된 메시지가 출력되며, 확인 입력 후 자동으로 커밋이 진행됩니다.

---

## 명령어

| 명령 | 설명 |
| --- | --- |
| `sm login` | provider, 모델, 언어, 강도, API 키를 처음 설정합니다 |
| `sm c` (= `sm commit`) | staged diff 를 기반으로 메시지를 생성하고 커밋합니다 |
| `sm config` | 언어, 강도, 모델 설정을 변경합니다 |
| `sm status` | 현재 저장된 설정을 출력합니다 |
| `sm install-hook` | 현재 프로젝트에 git prepare-commit-msg hook 을 설치합니다 |
| `sm logout` | 저장된 API 키를 제거합니다 |
| `sm uninstall` | 모든 설정 및 hook 을 제거합니다 |

---

## 옵션

### Language

| 값 | 출력 언어 |
| --- | --- |
| `ko` | 한국어 (`feat`, `fix` 등 type 키워드는 영어 유지) |
| `en` | 영어 |

### Strength — 메시지 강도

#### simple

```
feat(auth): add OAuth login flow
```

#### middle

```
feat(auth): add OAuth login flow

- PKCE 기반 OAuth 콜백 처리 추가
- 로컬 콜백 서버를 임시로 생성
- 발급된 토큰을 ~/.smart-msg/config.json 에 저장
```

#### hard

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

### 설정 변경

```bash
sm config
```

메뉴에서 언어, 강도, 모델 중 하나를 선택하여 변경합니다.

---

## Git Hook

기본 사용 방식은 `sm c` 명령이지만, IntelliJ 의 커밋 창이나 VS Code 의 commit 창과 같이 IDE 내부에서 `git commit` 을 호출하는 환경에서는 hook 을 설치해야 자동 메시지 생성이 동작합니다.

```bash
cd /path/to/project
sm install-hook
```

| 상황 | 동작 |
| --- | --- |
| `git commit` (메시지 미지정) | AI 가 메시지를 자동 생성합니다 |
| IntelliJ 커밋 창 | AI 가 메시지를 자동 생성합니다 |
| `git commit -m "직접 메시지"` | hook 이 비켜서며 사용자 메시지를 우선합니다 |
| `git commit --amend` | 기존 메시지를 보호합니다 |
| merge / squash 커밋 | 보호합니다 |
| AI 호출 실패 | 커밋 자체는 정상 진행됩니다 |
| staged 변경 없음 | AI 를 호출하지 않습니다 |

hook 은 프로젝트당 1회만 설치하면 됩니다. 설치된 hook 은 `sm uninstall` 실행 시 한꺼번에 제거됩니다.

---

## 제거

```bash
sm uninstall
```

설정 디렉토리(`~/.smart-msg/`)와 설치된 hook 을 모두 제거합니다.
