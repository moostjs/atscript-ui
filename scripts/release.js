import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const _rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));

// Find all workspace packages
const packageDirs = globSync("packages/*/package.json", { cwd: root }).map((p) => join(root, p));

const bumpType = process.argv[2] || "patch";
if (!["patch", "minor", "major"].includes(bumpType)) {
  console.error(`Usage: node scripts/release.js [patch|minor|major]`);
  process.exit(1);
}

function exec(cmd, opts = {}) {
  console.log(`\x1b[36m$ ${cmd}\x1b[0m`);
  return execSync(cmd, { stdio: "inherit", cwd: root, ...opts });
}

function readPkg(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writePkg(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split(".").map(Number);
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

// 1. Read current version from first package
const firstPkg = readPkg(packageDirs[0]);
const currentVersion = firstPkg.version;
const newVersion = bumpVersion(currentVersion, bumpType);

console.log(`\nReleasing: ${currentVersion} → ${newVersion} (${bumpType})\n`);

// 2. Bump version in all package.json files
const originalContents = new Map();

for (const pkgPath of packageDirs) {
  originalContents.set(pkgPath, readFileSync(pkgPath, "utf-8"));
  const pkg = readPkg(pkgPath);
  pkg.version = newVersion;
  writePkg(pkgPath, pkg);
  console.log(`  bumped ${pkg.name} → ${newVersion}`);
}

try {
  // 3. Format, lint, test, build
  console.log("\nRunning ready (fmt + lint + test + build)...\n");
  exec("pnpm run ready");

  // 4. Publish
  console.log("\nPublishing...\n");
  exec("pnpm -r publish --access public --no-git-checks");

  // 5. Commit + tag
  console.log("\nCommitting...\n");
  exec("git add .");
  exec(`git commit -m "${newVersion}"`);
  exec(`git tag v${newVersion}`);

  console.log(`\n\x1b[32mReleased v${newVersion}\x1b[0m`);
  console.log(`\nDon't forget: git push && git push --tags`);
} catch (error) {
  // Rollback version bumps on failure
  console.error("\n\x1b[31mRelease failed, rolling back version bumps...\x1b[0m\n", error);
  for (const [pkgPath, content] of originalContents) {
    writeFileSync(pkgPath, content);
  }
  process.exit(1);
}
