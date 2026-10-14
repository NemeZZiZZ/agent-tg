import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(pkgRoot));

test("skill copy is byte-identical to the core source", () => {
  const core = readFileSync(join(repoRoot, "packages/core/skill/SKILL.md"), "utf8");
  const copy = readFileSync(join(pkgRoot, "skills/agent-tg/SKILL.md"), "utf8");
  assert.equal(copy, core);
});

test("plugin.json parses and carries name/version/description", () => {
  const plugin = JSON.parse(readFileSync(join(pkgRoot, ".claude-plugin/plugin.json"), "utf8"));
  const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
  assert.equal(plugin.name, "claude-code-tg");
  assert.equal(plugin.version, pkg.version);
  assert.equal(typeof plugin.description, "string");
});

test("marketplace.json parses and its plugin source resolves", () => {
  const market = JSON.parse(readFileSync(join(repoRoot, ".claude-plugin/marketplace.json"), "utf8"));
  assert.equal(market.owner.name, "NemeZZiZZ");
  const entry = market.plugins.find((p) => p.name === "claude-code-tg");
  assert.ok(entry, "marketplace lists claude-code-tg");
  const sourceDir = join(repoRoot, entry.source);
  assert.ok(existsSync(join(sourceDir, ".claude-plugin/plugin.json")), "source points at the plugin dir");
});

test("package.json: name claude-code-tg, no bin, no exports", () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
  assert.equal(pkg.name, "claude-code-tg");
  assert.equal(pkg.bin, undefined);
  assert.equal(pkg.exports, undefined);
  assert.deepEqual(Object.keys(pkg.dependencies), ["agent-tg"]);
});
