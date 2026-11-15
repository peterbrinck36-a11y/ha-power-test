import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const pidFile = path.join(process.cwd(), "test-results", "e2e-server.pid");

export default async function globalTeardown(): Promise<void> {
  if (!fs.existsSync(pidFile)) return;
  const pid = Number(fs.readFileSync(pidFile, "utf8").trim());

  try {
    if (process.platform === "win32") {
      // /T kills the whole tree (parent + Next.js worker child), /F forces it.
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
    }
    console.log(`[e2e] server stopped (pid ${pid})`);
  } catch {
    // already gone — fine
  }
  fs.rmSync(pidFile, { force: true });
}
