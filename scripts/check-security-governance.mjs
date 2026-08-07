import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const baseIndex = process.argv.indexOf("--base");
const base = baseIndex === -1 ? "origin/main" : process.argv[baseIndex + 1];

if (!base) {
  console.error("Usage: node scripts/check-security-governance.mjs --base <git-ref>");
  process.exit(2);
}

function changedFiles() {
  const output = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", base, "HEAD"],
    { encoding: "utf8" }
  );
  return output.split("\n").filter(Boolean);
}

function readFile(filePath) {
  return readFileSync(filePath, "utf8");
}

function anonymousRpcNames(sql) {
  const names = [];
  const expression = /grant\s+execute\s+on\s+function\s+public\.([a-z_][a-z0-9_]*)\s*\([^;]*?\)\s+to\s+[^;]*\banon\b/gi;
  for (const match of sql.matchAll(expression)) names.push(match[1]);
  return names;
}

const failures = [];
const files = changedFiles();
const environmentFiles = files.filter(
  (filePath) =>
    /(^|\/)\.env(?:\.|$)/.test(filePath) &&
    !/\.env(?:\.[^.]+)?\.example$/.test(filePath)
);

if (environmentFiles.length > 0) {
  failures.push(`Environment files must not be committed: ${environmentFiles.join(", ")}`);
}

for (const filePath of files) {
  if (!existsSync(filePath)) continue;
  const content = readFile(filePath);
  if (content.includes("\u2014")) {
    failures.push(`Em dash found in changed file: ${filePath}`);
  }
}

const sqlFiles = files.filter(
  (filePath) => filePath.startsWith("supabase/") && filePath.endsWith(".sql")
);

if (sqlFiles.length > 0) {
  for (const requiredFile of ["supabase/SQL-MAP.md", "supabase/DEPLOYMENT.md"]) {
    if (!files.includes(requiredFile)) {
      failures.push(`SQL changes require an update to ${requiredFile}.`);
    }
  }

  const hasReleaseRecord = files.some((filePath) =>
    /^supabase\/releases\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(filePath)
  );
  if (!hasReleaseRecord) {
    failures.push("SQL changes require a dated record in supabase/releases/.");
  }

  const allowlistChanged = files.includes("supabase/public-rpc-allowlist.json");
  const allowlist = JSON.parse(readFile("supabase/public-rpc-allowlist.json"));
  const allowedNames = new Set((allowlist.functions ?? []).map((entry) => entry.name));

  for (const filePath of sqlFiles) {
    const sql = readFile(filePath);
    if (/security\s+definer/i.test(sql) && !/set\s+search_path\s*=\s*public/i.test(sql)) {
      failures.push(`${filePath} defines SECURITY DEFINER without SET search_path = public.`);
    }
    for (const name of anonymousRpcNames(sql)) {
      if (!allowlistChanged || !allowedNames.has(name)) {
        failures.push(
          `${filePath} grants anonymous access to ${name} without an approved allowlist update.`
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Security governance check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Security governance check passed.");
