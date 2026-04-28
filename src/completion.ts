// `sm completion <shell>` 의 동작을 정의한다.
// 사용자가 지정한 셸의 자동완성 등록 스크립트를 표준출력으로 뱉는다.
// 사용자는 그 출력을 자기 셸 rc 파일에 한 줄로 source 해두면 `sm <TAB>` 자동완성을 얻는다.
//
// 별도 의존성을 추가하지 않고 정적 스크립트로 처리하는 이유:
//   1) 서브커맨드 목록이 자주 바뀌지 않는다.
//   2) tabtab/omelette 같은 라이브러리는 OS별 파일 쓰기 동작이 있어 글로벌 CLI 의 잠재 부작용을 늘린다.
//   3) "스크립트만 뱉고 사용자가 직접 source" 가 gh/kubectl/npm 등이 채택한 사실상 표준이다.

// 자동완성 대상 서브커맨드. index.ts 의 program.command(...) 등록 순서와 동기화.
// alias 인 'c' 도 포함해 'sm c<TAB>' 도 자연스럽게 동작.
const SUB_COMMANDS = [
  "login",
  "logout",
  "config",
  "uninstall",
  "install-hook",
  "status",
  "commit",
  "c",
  "completion",
  "help",
];

// bash 용 등록 스크립트.
// 첫 번째 인자(서브커맨드) 위치에서만 후보를 제공해 over-completion 을 피한다.
function bashScript(): string {
  const cmds = SUB_COMMANDS.join(" ");
  return `# smart-msg (sm) bash completion
_sm_completion() {
  local cur cmds
  cur="\${COMP_WORDS[COMP_CWORD]}"
  cmds="${cmds}"
  if [ "\${COMP_CWORD}" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "$cmds" -- "$cur") )
  fi
}
complete -F _sm_completion sm
`;
}

// zsh 용 등록 스크립트.
// _describe 를 사용해 각 후보 옆에 한 줄 설명을 같이 보여준다 (zsh 기본 동작).
function zshScript(): string {
  const lines = [
    ["login", "AI provider/모델/언어/강도/API 키 설정"],
    ["logout", "저장된 API 키 제거"],
    ["config", "언어/강도/모델 변경"],
    ["uninstall", "설정 및 hook 제거"],
    ["install-hook", "현재 프로젝트에 git hook 설치"],
    ["status", "현재 저장된 설정 출력"],
    ["commit", "staged diff 로 메시지 생성 후 커밋"],
    ["c", "commit 의 alias"],
    ["completion", "셸 자동완성 스크립트 출력"],
    ["help", "도움말"],
  ]
    .map(([name, desc]) => `    '${name}:${desc}'`)
    .join("\n");

  return `#compdef sm
# smart-msg (sm) zsh completion
_sm() {
  local -a cmds
  cmds=(
${lines}
  )
  _describe 'command' cmds
}
compdef _sm sm
`;
}

// PowerShell 용 등록 스크립트.
// Register-ArgumentCompleter 가 PowerShell 5.1 / 7.x 모두 사용 가능한 표준 API.
function powershellScript(): string {
  const cmdsLiteral = SUB_COMMANDS.map((c) => `'${c}'`).join(",");
  return `# smart-msg (sm) PowerShell completion
Register-ArgumentCompleter -Native -CommandName sm -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    $commands = @(${cmdsLiteral})
    $commands |
        Where-Object { $_ -like "$wordToComplete*" } |
        ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
        }
}
`;
}

// clink 용 등록 스크립트.
// clink 는 Windows cmd.exe 위에 readline 기능을 입혀주는 서드파티 툴이다.
// clink.argmatcher API 가 자동완성 후보 등록의 표준이며, .lua 확장자로 clink 의 scripts 디렉토리에
// 저장하면 영구 적용된다 (clink info 로 경로 확인 가능).
function clinkScript(): string {
  const cmdsLiteral = SUB_COMMANDS.map((c) => `"${c}"`).join(", ");
  return `-- smart-msg (sm) clink completion
local sm = clink.argmatcher("sm")
sm:addarg({ ${cmdsLiteral} })
`;
}

// 셸 식별자 → 스크립트 생성기 매핑.
// cmd 는 동적 자동완성을 지원하는 메커니즘이 cmd.exe 자체에 없으므로 명시적으로 안내만 출력한다.
const GENERATORS: Record<string, () => string> = {
  bash: bashScript,
  zsh: zshScript,
  powershell: powershellScript,
  pwsh: powershellScript, // PowerShell Core 별칭
  clink: clinkScript,
};

// 사용자 등록 가이드. 잘못된 셸 또는 미지정 시 안내한다.
function printUsage(): void {
  console.log("사용법: sm completion <shell>");
  console.log("  지원 셸: bash, zsh, powershell (또는 pwsh), clink");
  console.log("");
  console.log("등록 예시:");
  console.log("");
  console.log("  bash:");
  console.log('    echo \'eval "$(sm completion bash)"\' >> ~/.bashrc');
  console.log("    source ~/.bashrc");
  console.log("");
  console.log("  zsh:");
  console.log('    echo \'eval "$(sm completion zsh)"\' >> ~/.zshrc');
  console.log("    source ~/.zshrc");
  console.log("");
  console.log("  PowerShell:");
  console.log("    sm completion powershell | Out-String | Invoke-Expression");
  console.log("    # 영구 적용은 위 줄을 $PROFILE 파일에 추가합니다.");
  console.log("");
  console.log("  clink (Windows cmd.exe 사용자):");
  console.log("    sm completion clink > %LOCALAPPDATA%\\clink\\sm.lua");
  console.log("    # 새 cmd 창부터 자동완성이 적용됩니다.");
}

// cmd 사용자가 잘못 알고 시도했을 때 보여줄 안내. cmd 자체가 동적 자동완성을 지원하지 않는다는 사실과
// 대안(PowerShell / clink) 을 같은 출력에서 한 번에 알려준다.
function printCmdNotSupported(): void {
  console.error("Windows cmd.exe 는 사용자 정의 자동완성을 지원하지 않습니다.");
  console.error("");
  console.error("다음 두 가지 대안 중 하나를 사용하시기 바랍니다.");
  console.error("");
  console.error("  1) PowerShell 사용 (Windows 11 기본 셸):");
  console.error("       sm completion powershell | Out-String | Invoke-Expression");
  console.error("");
  console.error("  2) clink 설치 후 cmd 사용 (https://chrisant996.github.io/clink):");
  console.error("       sm completion clink > %LOCALAPPDATA%\\clink\\sm.lua");
}

export async function runCompletion(shell?: string): Promise<void> {
  if (!shell) {
    printUsage();
    return;
  }

  const normalized = shell.toLowerCase();

  // cmd 는 명시적으로 지원 불가임을 알리고 종료. 사용자가 대안을 바로 시도할 수 있도록 안내문에 명령어까지 포함.
  if (normalized === "cmd") {
    printCmdNotSupported();
    process.exit(1);
    return;
  }

  const generate = GENERATORS[normalized];
  if (!generate) {
    console.error(`지원하지 않는 셸입니다: ${shell}`);
    console.error("");
    printUsage();
    process.exit(1);
    return;
  }

  // 표준출력으로만 출력하여 사용자가 eval / source / 리다이렉트로 바로 받아쓸 수 있게 한다.
  // 안내성 메시지(stderr) 와 분리되어 있어 파일로 리다이렉트해도 깔끔하게 스크립트만 저장된다.
  process.stdout.write(generate());
}
