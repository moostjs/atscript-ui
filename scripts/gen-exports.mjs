import { globSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function scan(pkgRoot) {
  const root = globSync("src/components/*.vue", { cwd: pkgRoot });
  const defaults = globSync("src/components/defaults/*.vue", { cwd: pkgRoot });
  const entries = {};
  const seen = new Map();
  for (const p of [...root, ...defaults].toSorted()) {
    const name = basename(p, ".vue");
    if (seen.has(name)) {
      throw new Error(`Naming collision for '${name}': ${seen.get(name)} vs ${p}`);
    }
    seen.set(name, p);
    entries[name] = p;
  }
  return entries;
}

export function getEntries(pkgRoot = process.cwd()) {
  return { index: "src/index.ts", ...scan(pkgRoot) };
}

function updatePackageJson(pkgRoot) {
  const pkgPath = resolve(pkgRoot, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const components = scan(pkgRoot);
  const barrel = pkg.exports["."];
  const hasCjs = typeof barrel === "object" && barrel !== null && "require" in barrel;
  const next = { ".": barrel };
  for (const name of Object.keys(components).toSorted()) {
    const entry = {
      types: `./dist/${name}.d.mts`,
      import: `./dist/${name}.mjs`,
    };
    if (hasCjs) entry.require = `./dist/${name}.cjs`;
    next[`./${name}`] = entry;
  }
  for (const [k, v] of Object.entries(pkg.exports)) {
    if (k === "." || k.startsWith("./as-")) continue;
    next[k] = v;
  }
  if (JSON.stringify(pkg.exports) === JSON.stringify(next)) return false;
  pkg.exports = next;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return true;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const changed = updatePackageJson(process.cwd());
  console.log(
    changed ? "package.json exports updated." : "package.json exports already up to date.",
  );
}
