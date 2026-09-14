import { execFileSync, spawn } from "node:child_process";

let token;
try {
  token = execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
} catch {
  console.error("Unable to read a GitHub token. Run `gh auth login` first.");
  process.exit(1);
}

const child = spawn(process.execPath, ["src/server.js"], {
  env: { ...process.env, COLD_RUN_PROVIDER: "github", GITHUB_TOKEN: token },
  stdio: "inherit",
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
