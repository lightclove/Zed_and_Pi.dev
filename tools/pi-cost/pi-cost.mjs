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
  const opts = { paths: [], json: false, today: false, last: 0, top: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--today") opts.today = true;
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
