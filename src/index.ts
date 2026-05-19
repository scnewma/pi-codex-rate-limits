import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

const API_BASE = "https://chatgpt.com/backend-api";
const USAGE_URL = `${API_BASE}/wham/usage`;
const PROVIDER = "openai-codex";

interface UsageWindow {
  used_percent: number;
  limit_window_seconds: number;
  reset_after_seconds: number;
  reset_at: number;
}

interface UsageResponse {
  plan_type: string;
  rate_limit: {
    allowed: boolean;
    limit_reached: boolean;
    primary_window: UsageWindow;
    secondary_window?: UsageWindow | null;
  } | null;
  credits?: { has_credits: boolean; unlimited?: boolean; balance?: number } | null;
}

function formatTimeRemaining(secs: number): string {
  const now = Date.now();
  const diff = secs * 1000 - now;
  const d = new Date(secs * 1000);
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });

  if (diff <= 0) return "now";
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h (${date} ${t})`;
  }
  if (hours > 0) return `${hours}h ${mins}m (${t})`;
  return `${mins}m (${t})`;
}

function windowLabel(secs: number): string {
  if (secs >= 604800) return "Weekly";
  const hours = secs / 3600;
  if (hours === 5) return "5h";
  if (hours >= 24) return `${Math.floor(hours / 24)}d`;
  return `${hours}h`;
}

function bar(percent: number, width = 16): string {
  const filled = Math.round((percent / 100) * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

export default function(pi: ExtensionAPI) {
  pi.registerCommand("codex-rate-limits", {
    description: "Show OpenAI Codex rate limit usage and reset times",
    handler: async (_args: string[], ctx: ExtensionCommandContext) => {
      const token = await ctx.modelRegistry.authStorage.getApiKey(PROVIDER);
      if (!token) {
        ctx.ui.notify("No Codex login found. Use an OpenAI Codex (oauth) provider.", "warning");
        return;
      }

      let resp: Response;
      try {
        resp = await fetch(USAGE_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        ctx.ui.notify(`Usage API network error: ${err instanceof Error ? err.message : String(err)}`, "error");
        return;
      }

      if (!resp.ok) {
        const body = await resp.text().catch(() => "<failed to read response body>");
        ctx.ui.notify(`Usage API error: ${resp.status}: ${body}`, "error");
        return;
      }

      let data: UsageResponse;
      try {
        data = (await resp.json()) as UsageResponse;
      } catch (err) {
        ctx.ui.notify(`Usage API returned invalid JSON: ${err instanceof Error ? err.message : String(err)}`, "error");
        return;
      }

      if (!data?.rate_limit) {
        ctx.ui.notify("No usage limit data", "warning");
        return;
      }

      const p = data.rate_limit.primary_window;
      const s = data.rate_limit.secondary_window;
      const LABEL_W = 12;

      // Build structured rows: [label, barAndPct, reset?]
      const rows: string[][] = [];
      const addWindow = (w: UsageWindow) => {
        const pct = (100 - w.used_percent).toFixed(0);
        rows.push([
          windowLabel(w.limit_window_seconds).padStart(LABEL_W),
          `${bar(w.used_percent)} ${pct}% left`,
        ]);
        rows.push([
          "".padEnd(LABEL_W),
          `resets ${formatTimeRemaining(w.reset_at)}`,
        ]);
      };

      if (p) addWindow(p);
      if (p && s) rows.push(["", ""]); // gap
      if (s) addWindow(s);

      if (data.credits?.balance && data.credits.balance > 0) {
        rows.push(["Credits", `\u2500 ${data.credits.balance}`]);
      }

      // Flatten to content lines and measure
      const content: string[] = [
        ` Codex Rate Limits \u00b7 ${data.plan_type} `,
        ...rows.map(([a, b]) => ` ${a} ${b} `),
      ];

      const w = Math.max(...content.map((l) => l.length));
      const sep = "\u2500".repeat(w);
      const lines: string[] = [
        `\u250c${sep}\u2510`,
        ...content.map((l) => `\u2502${l.padEnd(w)}\u2502`),
        `\u2514${sep}\u2518`,
      ];

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
