#!/usr/bin/env node
/**
 * pi-cost — token & cost report over pi session files (JSONL).
 *
 * Usage:
 *   node tools/pi-cost/pi-cost.mjs                    # all sessions under ~/.pi/agent/sessions
 *   node tools/pi-cost/pi-cost.mjs session.jsonl      # one file
 *   node tools/pi-cost/pi-cost.mjs dir1 dir2 --json   # dirs, machine-readable output
 *
 * Flags:
 *   --today        only sessions started today (local time)
 *   --last N       only sessions from the last N days
 *   --top N        show only the top N sessions by cost
 *   --json         machine-readable output
 *   --health       token-thrift compliance gate: fails when v4-pro is the
 *                  workhorse instead of flash, or the cache is cold
 *
 * Semantics: every assistant message = one paid API call. All branches count
 * (that is the actual spend). usage.reasoning is a subset of usage.output.
 * Cache-hit rate = cacheRead / (input + cacheRead).
 */

import { createReadStream, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";

const DEFAULT_DIR = join(homedir(), ".pi", "agent", "sessions");
const ZERO = { calls: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0, tokens: 0, cost: 0 };

const fmt = (n) => n.toLocaleString("en-US");
const money = (n) => n.toFixed(4);
const hitRate = (a) => (a.input + a.cacheRead > 0 ? ((a.cacheRead / (a.input + a.cacheRead)) * 100).toFixed(1) : "0.0");

const pad = (n) => String(n).padStart(2, "0");
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fileDate = (file) => {
  const m = basename(file).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};
const shortName = (file) => {
  const dir = file.slice(0, Math.max(file.lastIndexOf("/"), file.lastIndexOf("\\")));
  const stripped = basename(dir).replace(/^--+/, "").replace(/--+$/, "");
  const parts = stripped.split("-").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : basename(dir);
};
const num = (s) => {
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : 0;
};
function parseArgs(argv) {
  const opts = { paths: [], json: false, today: false, last: 0, top: 0, health: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--today") opts.today = true;
    else if (a === "--health") opts.health = true;
    else if (a === "--last") opts.last = num(argv[++i]);
    else if (a === "--top") opts.top = num(argv[++i]);
    else if (!a.startsWith("--")) opts.paths.push(a);
  }
  return opts;
}
function applyDateFilter(files, opts) {
  const now = new Date();
  const today = dateStr(now);
  let threshold = today;
  if (opts.last > 0 && !opts.today) {
    threshold = dateStr(new Date(now.getTime() - (opts.last - 1) * 86400000));
  }
  return files.filter((f) => {
    const d = fileDate(f);
    return d !== null && d >= threshold;
  });
}

async function collectFiles(paths) {
  const out = [];
  for (const p of paths) {
    let st;
    try {
      st = statSync(p);
    } catch {
      console.error(`[skip] not found: ${p}`);
      continue;
    }
    if (st.isFile()) {
      if (p.endsWith(".jsonl")) out.push(p);
    } else if (st.isDirectory()) {
      const items = await readdir(p, { withFileTypes: true, recursive: true });
      for (const de of items) if (de.isFile() && de.name.endsWith(".jsonl")) out.push(join(de.parentPath, de.name));
    }
  }
  return [...new Set(out)].sort();
}

async function* lines(file) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    try {
      yield JSON.parse(t);
    } catch {
      /* skip unparseable lines */
    }
  }
}

function add(target, src) {
  target.calls += src.calls;
  target.input += src.input;
  target.cacheRead += src.cacheRead;
  target.cacheWrite += src.cacheWrite;
  target.output += src.output;
  target.reasoning += src.reasoning;
  target.tokens += src.tokens;
  target.cost += src.cost;
}

function usageEntry(entry) {
  if (entry.type !== "message") return null;
  const m = entry.message;
  if (!m || m.role !== "assistant" || !m.usage) return null;
  const u = m.usage;
  return {
    key: `${m.provider ?? "unknown"}/${m.model ?? "unknown"}`,
    src: {
      calls: 1,
      input: u.input ?? 0,
      cacheRead: u.cacheRead ?? 0,
      cacheWrite: u.cacheWrite ?? 0,
      output: u.output ?? 0,
      reasoning: u.reasoning ?? 0,
      tokens: u.totalTokens ?? 0,
      cost: u.cost?.total ?? 0,
    },
  };
}

function printHealth(models, total) {
  console.log("token-thrift health (rule: flash is the default workhorse, cache stays warm)");
  const rows = Object.entries(models).sort((a, b) => b[1].cost - a[1].cost);
  const totalCost = total.cost || 0;
  let v4Share = 0;
  for (const [name, a] of rows) {
    const share = totalCost > 0 ? (a.cost / totalCost) * 100 : 0;
    console.log(`  ${name.padEnd(28)} ${String(a.calls).padStart(6)} calls   $${money(a.cost)}   ${share.toFixed(1)}% of cost`);
    if (name.includes("v4-pro")) v4Share += share;
  }
  console.log(`  cache hit rate: ${hitRate(total)}%`);
  let verdict = "PASS";
  const notes = [];
  if (v4Share > 80) {
    verdict = "FAIL";
    notes.push(`v4-pro is ${v4Share.toFixed(1)}% of cost — flash should be the default workhorse (AGENTS.md: 'deepseek-flash is the default')`);
  } else if (v4Share > 50) {
    verdict = "WARN";
    notes.push(`v4-pro is ${v4Share.toFixed(1)}% of cost — confirm escalation was justified (hard reasoning/audits only)`);
  }
  if (Number(hitRate(total)) < 90) {
    if (verdict === "PASS") verdict = "WARN";
    notes.push(`cache hit rate ${hitRate(total)}% < 90% — keep the system prompt + tool set stable`);
  }
  console.log(`verdict: ${verdict}${notes.length ? " — " + notes.join("; ") : ""}`);
  return verdict === "FAIL" ? 1 : 0;
}

function printReport(models, perFile, total, top) {
  console.log("model                         calls    input  cacheRead    hit%    output reasoning      tokens        cost");
  const rows = Object.entries(models).sort((a, b) => b[1].cost - a[1].cost);
  for (const [name, a] of rows) {
    console.log(
      name.padEnd(28) +
        String(a.calls).padStart(6) +
        fmt(a.input).padStart(10) +
        fmt(a.cacheRead).padStart(12) +
        hitRate(a).padStart(8) +
        "%" +
        fmt(a.output).padStart(10) +
        fmt(a.reasoning).padStart(10) +
        fmt(a.tokens).padStart(12) +
        ("$" + money(a.cost)).padStart(12),
    );
  }
  const t = total;
  console.log(
    "TOTAL".padEnd(28) +
      String(t.calls).padStart(6) +
      fmt(t.input).padStart(10) +
      fmt(t.cacheRead).padStart(12) +
      hitRate(t).padStart(8) +
      "%" +
      fmt(t.output).padStart(10) +
      fmt(t.reasoning).padStart(10) +
      fmt(t.tokens).padStart(12) +
      ("$" + money(t.cost)).padStart(12),
  );
  if (Object.keys(perFile).length > 1) {
    let rows = Object.entries(perFile).sort((a, b) => b[1].cost - a[1].cost);
    if (top > 0) rows = rows.slice(0, top);
    console.log(`\nper file (by cost${top > 0 ? `, top ${top}` : ""}):`);
    for (const [file, a] of rows) {
      const label = `${shortName(file).padEnd(26)} ${fileDate(file) ?? "?"}`;
      console.log(`  ${label.padEnd(42)} ${String(a.calls).padStart(6)} calls   $${money(a.cost)}`);
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let files = await collectFiles(opts.paths.length ? opts.paths : [DEFAULT_DIR]);
  if (opts.today || opts.last) files = applyDateFilter(files, opts);
  if (!files.length) {
    console.error("no .jsonl files found" + (opts.today || opts.last ? " for the requested date range" : ""));
    process.exit(1);
  }

  const models = {};
  const perFile = {};
  const total = { ...ZERO };
  for (const file of files) {
    perFile[file] = { calls: 0, cost: 0 };
    for await (const entry of lines(file)) {
      const u = usageEntry(entry);
      if (!u) continue;
      models[u.key] ??= { ...ZERO };
      add(models[u.key], u.src);
      add(total, u.src);
      perFile[file].calls += 1;
      perFile[file].cost += u.src.cost;
    }
  }

  let perFileOut = perFile;
  if (opts.top > 0) {
    perFileOut = Object.fromEntries(Object.entries(perFile).sort((a, b) => b[1].cost - a[1].cost).slice(0, opts.top));
  }
  if (opts.health) {
    process.exitCode = printHealth(models, total);
    return;
  }
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          filesScanned: files.length,
          models: Object.fromEntries(Object.entries(models).map(([k, v]) => [k, { ...v, hitRate: Number(hitRate(v)) }])),
          perFile: perFileOut,
          total: { ...total, hitRate: Number(hitRate(total)) },
        },
        null,
        2,
      ),
    );
    return;
  }
  printReport(models, perFile, total, opts.top);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
