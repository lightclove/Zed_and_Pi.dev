/**
 * Live DeepSeek account balance in the footer.
 *
 * Fetches the real remaining balance from DeepSeek's balance API and shows it
 * under the built-in footer, updating live as the session spends money:
 *
 *   deepseek $46.44 left · this session -$0.149
 *
 * The balance is fetched once on session start (and on demand via /balance).
 * Between fetches the line subtracts this session's spend (tracked by Pi in
 * real time), so the number stays accurate as long as you don't spend from
 * other apps at the same time. Run /balance to re-sync with the account.
 *
 * The old context-window line is gone: `5.0%/1.0M (auto)` in the footer is
 * working memory, not money, and it never runs out.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const PROVIDER = "deepseek";
const BALANCE_URL = "https://api.deepseek.com/user/balance";
const STATUS_KEY = "deepseek-balance";

interface BalanceState {
  /** Account balance at the moment of the last successful fetch. */
  balance: number;
  currency: string;
  /** Session spend at the moment of the fetch, so resumed sessions are not double-counted. */
  costAtFetch: number;
}

let state: BalanceState | null = null;
let lastError: string | null = null;

/** Total spend for the current session, mirroring the footer's cost math. */
function sessionCost(ctx: ExtensionContext): number {
  let cost = 0;
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "usage") {
      cost += entry.usage.cost?.total ?? 0;
    } else if (entry.type === "message" && entry.message.role === "assistant") {
      cost += entry.message.usage?.cost?.total ?? 0;
    } else if (entry.type === "message" && entry.message.role === "toolResult" && entry.message.usage) {
      cost += entry.message.usage.cost?.total ?? 0;
    } else if ((entry.type === "branch_summary" || entry.type === "compaction") && entry.usage) {
      cost += entry.usage.cost?.total ?? 0;
    }
  }
  return cost;
}

async function fetchBalance(ctx: ExtensionContext): Promise<{ balance: number; currency: string }> {
  const key = await ctx.modelRegistry.getApiKeyForProvider(PROVIDER);
  if (!key) throw new Error("no DeepSeek API key (auth.json / DEEPSEEK_API_KEY)");

  const res = await fetch(BALANCE_URL, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = (await res.json()) as {
    is_available?: boolean;
    balance_infos?: Array<{ currency?: string; total_balance?: string }>;
  };
  const info = json.balance_infos?.[0];
  if (!info) throw new Error("unexpected balance response");
  const balance = Number(info.total_balance);
  if (!Number.isFinite(balance)) throw new Error("unreadable balance value");

  return { balance, currency: info.currency ?? "USD" };
}

function render(ctx: ExtensionContext): string {
  if (state) {
    const spentSinceFetch = Math.max(0, sessionCost(ctx) - state.costAtFetch);
    const left = Math.max(0, state.balance - spentSinceFetch);
    const spent = sessionCost(ctx);
    return spent > 0
      ? `deepseek $${left.toFixed(2)} left · this session -$${spent.toFixed(3)}`
      : `deepseek $${left.toFixed(2)} left`;
  }
  return lastError ? `deepseek balance: ${lastError}` : "deepseek balance: fetching…";
}

async function refresh(ctx: ExtensionContext): Promise<void> {
  try {
    const { balance, currency } = await fetchBalance(ctx);
    state = { balance, currency, costAtFetch: sessionCost(ctx) };
    lastError = null;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
  }
  ctx.ui.setStatus(STATUS_KEY, render(ctx));
}

export default function (pi: ExtensionAPI) {
  // Fetch once per session, then keep the number live from Pi's real-time spend.
  pi.on("session_start", (_event, ctx) => void refresh(ctx));
  pi.on("message_end", (_event, ctx) => ctx.ui.setStatus(STATUS_KEY, render(ctx)));
  pi.on("session_compact", (_event, ctx) => ctx.ui.setStatus(STATUS_KEY, render(ctx)));
  pi.on("session_compact_failed", (_event, ctx) => ctx.ui.setStatus(STATUS_KEY, render(ctx)));
  pi.on("session_shutdown", (_event, ctx) => ctx.ui.setStatus(STATUS_KEY, undefined));

  pi.registerCommand("balance", {
    description: "Re-fetch the real DeepSeek account balance",
    handler: async (_args, ctx) => {
      await refresh(ctx);
      ctx.ui.notify(render(ctx), "info");
    },
  });
}
