#!/usr/bin/env node
/**
 * Contract tests for tools/skill-lint.mjs — written test-first (TDD).
 * Every test is Arrange / Act / Assert. Run: node --test tools/
 *
 * The suite pins the contract, not the implementation: exit code, error/warning
 * codes, and the exact situations each check must catch. A check that cannot be
 * made to fail by a fixture is not a check (same rule as the gitleaks gate).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const LINT = join(dirname(fileURLToPath(import.meta.url)), "skill-lint.mjs");

/** Arrange helper: build a throwaway skill root, run the lint, return parsed output. */
function runLint(files) {
  const root = mkdtempSync(join(tmpdir(), "skill-lint-"));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const p = join(root, rel);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, content);
    }
    const r = spawnSync(process.execPath, [LINT, root, "--json"], { encoding: "utf8" });
    const parsed = r.stdout.trim() ? JSON.parse(r.stdout) : { errors: [], warnings: [] };
    return { status: r.status, ...parsed, stderr: r.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const skill = (fm, body = "\n# Skill\n") => `---\n${fm}\n---\n${body}`;
const codes = (list) => list.map((x) => x.code);

// ---------------------------------------------------------------- E1: frontmatter

test("E1: skill directory without SKILL.md fails", () => {
  // Arrange
  const files = { "demo/README.md": "no skill here\n" };
  // Act
  const out = runLint(files);
  // Assert
  assert.equal(out.status, 1);
  assert.ok(codes(out.errors).includes("E1"), JSON.stringify(out.errors));
});

test("E1: missing frontmatter fails", () => {
  // Arrange
  const files = { "demo/SKILL.md": "# no frontmatter\n" };
  // Act
  const out = runLint(files);
  // Assert
  assert.equal(out.status, 1);
  assert.ok(codes(out.errors).includes("E1"));
});

test("E1: frontmatter without `description` fails, and names the field", () => {
  // Arrange
  const files = { "demo/SKILL.md": skill("name: demo") };
  // Act
  const out = runLint(files);
  // Assert
  assert.equal(out.status, 1);
  assert.ok(out.errors.some((e) => e.code === "E1" && /description/.test(e.msg)), JSON.stringify(out.errors));
});

test("E1: UTF-8 BOM before frontmatter is tolerated (Windows editors add it)", () => {
  // Arrange
  const files = { "demo/SKILL.md": "\uFEFF" + skill("name: demo\ndescription: Does x. Use when x.") };
  // Act
  const out = runLint(files);
  // Assert
  assert.equal(out.status, 0, JSON.stringify(out.errors));
  assert.deepEqual(out.errors, []);
});

// ------------------------------------------------------------ E2/E3: files & links

test("E2: reference file not mentioned in SKILL.md fails", () => {
  // Arrange
  const files = {
    "demo/SKILL.md": skill("name: demo\ndescription: Does x. Use when x."),
    "demo/references/orphan.md": "# orphan\n",
  };
  // Act
  const out = runLint(files);
  // Assert
  assert.equal(out.status, 1);
  assert.ok(codes(out.errors).includes("E2"), JSON.stringify(out.errors));
});

test("E2: referenced support file passes", () => {
  // Arrange
  const files = {
    "demo/SKILL.md": skill("name: demo\ndescription: Does x. Use when x.", "\nSee `references/used.md`.\n"),
    "demo/references/used.md": "# used\n",
  };
  // Act
  const out = runLint(files);
  // Assert
  assert.equal(out.status, 0, JSON.stringify(out.errors));
});

test("E3: link to a non-existent reference fails", () => {
  // Arrange
  const files = {
    "demo/SKILL.md": skill("name: demo\ndescription: Does x. Use when x.", "\nSee `references/missing.md`.\n"),
  };
  // Act
  const out = runLint(files);
  // Assert
  assert.equal(out.status, 1);
  assert.ok(codes(out.errors).includes("E3"), JSON.stringify(out.errors));
});

// ------------------------------------------------------------------ W1: routing

test("W1: description without a routing trigger warns", () => {
  // Arrange
  const files = { "demo/SKILL.md": skill("name: demo\ndescription: Helps with PDFs.") };
  // Act
  const out = runLint(files);
  // Assert
  assert.equal(out.status, 0, "warnings must not fail the run");
  assert.ok(codes(out.warnings).includes("W1"), JSON.stringify(out.warnings));
});

test("W1: quoted description still matches the trigger", () => {
  // Arrange
  const files = { "demo/SKILL.md": skill('name: demo\ndescription: "Does x. Use when x."') };
  // Act
  const out = runLint(files);
  // Assert
  assert.deepEqual(out.warnings, [], JSON.stringify(out.warnings));
});

test("W4: quoted `name` equal to directory name produces no warning", () => {
  // Arrange
  const files = { "demo/SKILL.md": skill('name: "demo"\ndescription: "Does x. Use when x."') };
  // Act
  const out = runLint(files);
  // Assert
  assert.deepEqual(out.warnings, [], JSON.stringify(out.warnings));
});

test("W4: name/directory mismatch is its own code, not W1", () => {
  // Arrange
  const files = { "demo/SKILL.md": skill("name: other\ndescription: Does x. Use when x.") };
  // Act
  const out = runLint(files);
  // Assert
  assert.ok(codes(out.warnings).includes("W4"), JSON.stringify(out.warnings));
  assert.ok(!codes(out.warnings).includes("W1"), "W1 must mean exactly one thing");
});

// ------------------------------------------------------------- W2/W3: size rules

test("W2: oversized SKILL.md warns", () => {
  // Arrange
  const files = { "demo/SKILL.md": skill("name: demo\ndescription: Does x. Use when x.", "\nline\n".repeat(101)) };
  // Act
  const out = runLint(files);
  // Assert
  assert.ok(codes(out.warnings).includes("W2"), JSON.stringify(out.warnings));
});

test("W3: long reference without `## Index` warns", () => {
  // Arrange
  const files = {
    "demo/SKILL.md": skill("name: demo\ndescription: Does x. Use when x.", "\nSee `references/big.md`.\n"),
    "demo/references/big.md": "# big\n\n" + "line\n".repeat(50),
  };
  // Act
  const out = runLint(files);
  // Assert
  assert.ok(codes(out.warnings).includes("W3"), JSON.stringify(out.warnings));
});

test("W3: long reference with `## Index` does not warn", () => {
  // Arrange
  const files = {
    "demo/SKILL.md": skill("name: demo\ndescription: Does x. Use when x.", "\nSee `references/big.md`.\n"),
    "demo/references/big.md": "# big\n\n## Index\n\n| § | read when |\n|---|---|\n| 1 | x |\n\n" + "line\n".repeat(50),
  };
  // Act
  const out = runLint(files);
  // Assert
  assert.ok(!codes(out.warnings).includes("W3"), JSON.stringify(out.warnings));
});

// ------------------------------------------------------------ contract: exit & CLI

test("exit code: warnings only → 0, errors → 1", () => {
  // Arrange
  const warnOnly = { "demo/SKILL.md": skill("name: demo\ndescription: Helps with PDFs.") };
  const withError = { "demo/SKILL.md": "# broken\n" };
  // Act
  const a = runLint(warnOnly);
  const b = runLint(withError);
  // Assert
  assert.equal(a.status, 0);
  assert.equal(b.status, 1);
});

test("CLI: non-existent root is an error, not a silent pass", () => {
  // Arrange
  const missing = join(tmpdir(), "skill-lint-does-not-exist-" + Date.now());
  // Act
  const r = spawnSync(process.execPath, [LINT, missing, "--json"], { encoding: "utf8" });
  // Assert
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.ok(codes(out.errors).includes("E0"), r.stdout);
});

test("CLI: JSON output always has errors[] and warnings[]", () => {
  // Arrange
  const files = { "demo/SKILL.md": skill("name: demo\ndescription: Does x. Use when x.") };
  // Act
  const out = runLint(files);
  // Assert
  assert.ok(Array.isArray(out.errors));
  assert.ok(Array.isArray(out.warnings));
});
