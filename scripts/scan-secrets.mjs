import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const secretPatterns = [
  {
    name: "Anthropic API key",
    pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g
  }
];

const rawFileList = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" }
);

const files = rawFileList.split("\0").filter((file) => file.length > 0);
const findings = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");

  for (const { name, pattern } of secretPatterns) {
    const matches = content.matchAll(pattern);

    for (const match of matches) {
      const lineNumber = content.slice(0, match.index).split("\n").length;
      findings.push(`${file}:${lineNumber}: ${name} に見える文字列を検出しました`);
    }
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("Secret scan passed.");
