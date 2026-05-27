// 사용자 $EDITOR (또는 git core.editor / 폴백) 를 띄워서 텍스트를 편집하게 한다.
// sm c 의 [e]dit 옵션, sm amend 의 메시지 수정 등에 사용.
import { execa } from "execa";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 우선순위: $GIT_EDITOR > git config core.editor > $VISUAL > $EDITOR > 폴백.
async function resolveEditor(): Promise<string> {
  if (process.env.GIT_EDITOR) return process.env.GIT_EDITOR;
  try {
    const { stdout } = await execa("git", ["config", "--get", "core.editor"]);
    if (stdout.trim()) return stdout.trim();
  } catch {
    // 미설정.
  }
  if (process.env.VISUAL) return process.env.VISUAL;
  if (process.env.EDITOR) return process.env.EDITOR;
  // OS 별 합리적 폴백.
  return process.platform === "win32" ? "notepad" : "vi";
}

// 임시 파일에 초기 내용을 적고 에디터를 띄운 뒤, 사용자가 저장/종료한 결과를 읽어 반환한다.
// 사용자가 파일을 비우면 빈 문자열을 반환 → 호출자가 '취소' 로 해석할 수 있다.
export async function editText(initial: string, suffix = ".txt"): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "smart-msg-"));
  const path = join(dir, `EDIT_MSG${suffix}`);
  await writeFile(path, initial, "utf-8");

  const editor = await resolveEditor();
  // 일부 editor 명령은 인자가 함께 옴 (예: 'code --wait'). 공백으로 분리해 인자 처리.
  const parts = editor.split(/\s+/).filter(Boolean);
  const cmd = parts[0];
  const args = [...parts.slice(1), path];

  try {
    await execa(cmd, args, { stdio: "inherit" });
  } catch (e) {
    // editor 실행 실패는 사용자가 알아채야 하므로 그대로 throw.
    await rm(dir, { recursive: true, force: true });
    throw new Error(`에디터 실행 실패 (${editor}): ${(e as Error).message}`);
  }

  let result = "";
  try {
    result = await readFile(path, "utf-8");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  return result.trim();
}
