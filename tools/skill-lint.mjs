#!/usr/bin/env node
/**
 * skill-lint — structure gate for progressive disclosure in .pi/skills.
 *
 * Usage:
 *   node tools/skill-lint.mjs                 # lint .pi/skills of this repo
 *   node tools/skill-lint.mjs <dir>...        # lint given skill roots
 *   node tools/skill-lint.mjs --json
 *
 * Checks (errors fail the run, warnings only report):
 *   E1 SKILL.md frontmatter has `name` and `description`
 *   E2 every file under references/ scripts/ assets/ is mentioned in its SKILL.md
 *   E3 every `references/...` path mentioned in SKILL.md exists (H2: no silent broken link)
 *   W1 `description` has a routing trigger ("Use when" / "when the task")
 *   W2 SKILL.md longer than MAX_SKILL_LINES (detail belongs in a reference)
 *   W3 reference longer than MAX_PLAIN_REF_LINES without a "## Index" (level-3 standard)
 *
 * Exit code 1 on any error, 0 otherwise. Numbers, not opinions: it prints counts.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_SKILL_LINES = 100;
const MAX_PLAIN_REF_LINES = 40;
const TRIGGERS = [/\buse when\b/i, /\bwhen the task\b/i, /\buse it when\b/i];

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const roots = args.filter((a) => !a.startsWith("--"));
if (roots.length === 0) roots.push(join(here, "..", ".pi", "skills"));

const errors = [];
const warnings = [];
const err = (code, msg) => errors.push({ code, msg });
const warn = (code, msg) => warnings.push({ code, msg });

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const body = text.slice(3, end);
  const fm = {};
  for (const line of body.split("\n")) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (m) fm[m[1]] = m[2].trim();
  }
  return fm;
}

function lintSkill(skillDir) {
  const skillMd = join(skillDir, "SKILL.md");
  const label = relative(process.cwd(), skillMd) || skillMd;
  if (!existsSync(skillMd)) {
    err("E1", `${label}: no SKILL.md`);
    return;
  }
  const text = readFileSync(skillMd, "utf8");
  const lines = text.split("\n").length;
  const fm = parseFrontmatter(text);
  if (!fm) {
    err("E1", `${label}: missing frontmatter`);
    return;
  }
  for (const key of ["name", "description"]) {
    if (!fm[key]) err("E1", `${label}: frontmatter has no \`${key}\``);
  }
  if (fm.name && fm.name !== basename(skillDir)) {
    warn("W1", `${label}: name \`${fm.name}\` != directory \`${basename(skillDir)}\``);
  }
  if (fm.description && !TRIGGERS.some((re) => re.test(fm.description))) {
    warn("W1", `${label}: description has no routing trigger ("Use when ...")`);
  }
  if (lines > MAX_SKILL_LINES) {
    warn("W2", `${label}: ${lines} lines > ${MAX_SKILL_LINES} — move detail to references/`);
  }

  // E3: every referenced path exists (relative to the skill dir)
  const refRe = /`((?:references|scripts|assets)\/[^`\s]+)`/g;
  for (const m of text.matchAll(refRe)) {
    const p = join(skillDir, m[1]);
    if (!existsSync(p)) err("E3", `${label}: broken link \`${m[1]}\``);
  }

  // E2: no orphan support files
  for (const dirName of ["references", "scripts", "assets"]) {
    const dir = join(skillDir, dirName);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    for (const f of walk(dir)) {
      const rel = relative(skillDir, f).replace(/\\/g, "/");
      if (!text.includes(rel) && !text.includes(basename(f))) {
        err("E2", `${label}: ${rel} is not mentioned in SKILL.md (orphan)`);
      }
    }
  }

  // W3: level-3 standard — long reference needs an index
  const refDir = join(skillDir, "references");
  if (existsSync(refDir)) {
    for (const f of walk(refDir)) {
      const body = readFileSync(f, "utf8");
      const n = body.split("\n").length;
      if (n > MAX_PLAIN_REF_LINES && !/^## Index/m.test(body)) {
        warn("W3", `${relative(process.cwd(), f)}: ${n} lines, no "## Index" — add §N → when to read`);
      }
    }
  }
}

for (const root of roots) {
  if (!existsSync(root)) {
    err("E0", `${root}: no such directory`);
    continue;
  }
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(root, e.name));
  for (const d of dirs) lintSkill(d);
  if (dirs.length === 0) warn("E0", `${root}: no skill directories found`);
}

if (asJson) {
  console.log(JSON.stringify({ errors, warnings }, null, 2));
} else {
  for (const e of errors) console.log(`ERROR ${e.code}  ${e.msg}`);
  for (const w of warnings) console.log(`warn  ${w.code}  ${w.msg}`);
  console.log(`\nskill-lint: ${errors.length} errors, ${warnings.length} warnings`);
}
process.exit(errors.length > 0 ? 1 : 0);
