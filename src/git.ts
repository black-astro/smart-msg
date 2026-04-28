// git 명령 래퍼. 현재 디렉터리에서 git 실행하므로 어떤 프로젝트(자바/IntelliJ 등)에서 호출해도 동작.
import { execa } from "execa";

// 스테이징된 변경사항(diff)만 가져옴. 워킹 디렉터리 변경은 무시 → AI 가 의도된 것만 보게 함.
export async function getStagedDiff(): Promise<string> {
  const { stdout } = await execa("git", ["diff", "--staged"]);
  return stdout;
}

// 실제 커밋 실행. stdio: inherit 으로 git 출력(훅 결과 등)을 사용자 터미널에 그대로 보여줌.
export async function commit(message: string): Promise<void> {
  await execa("git", ["commit", "-m", message], {
    stdio: "inherit",
  });
}
