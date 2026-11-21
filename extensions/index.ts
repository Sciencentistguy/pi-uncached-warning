import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const WIDGET_KEY = "uncached-warning";
const DEFAULT_TTL_SECONDS = 300;
const MIN_TOKENS = 10_000;

function formatTokens(tokens: number): string {
	return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : String(tokens);
}

function cacheTtlMs(ctx: ExtensionContext): number {
	const tier = process.env.PI_CACHE_RETENTION === "long" ? "long" : "short";
	return (ctx.model?.promptCache?.[tier] ?? DEFAULT_TTL_SECONDS) * 1000;
}

function lastCacheTouch(ctx: ExtensionContext): number | undefined {
	for (const entry of [...ctx.sessionManager.getBranch()].reverse()) {
		const isAssistant = entry.type === "message" && entry.message.role === "assistant";
		const isWarm = entry.type === "usage" && (entry as { kind?: string }).kind === "cache_warm";
		if (isAssistant || isWarm) return Date.parse(entry.timestamp);
	}
	return undefined;
}

export default function (pi: ExtensionAPI) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let running = false;

	const clear = (ctx: ExtensionContext) => {
		if (timer) clearTimeout(timer);
		timer = undefined;
		if (ctx.hasUI) ctx.ui.setWidget(WIDGET_KEY, undefined);
	};

	const schedule = (ctx: ExtensionContext) => {
		clear(ctx);
		if (!ctx.hasUI || running) return;
		const touched = lastCacheTouch(ctx);
		if (touched === undefined) return;

		const remaining = touched + cacheTtlMs(ctx) - Date.now();
		if (remaining > 0) {
			timer = setTimeout(() => schedule(ctx), remaining + 250);
			return;
		}

		const tokens = ctx.getContextUsage()?.tokens;
		if (tokens == null || tokens < MIN_TOKENS) return;
		ctx.ui.setWidget(WIDGET_KEY, (_tui, theme) => ({
			render: () => [theme.fg("warning", `new task? /new to save ${formatTokens(tokens)} tokens (prompt cache expired)`)],
			invalidate() {},
		}));
	};

	pi.on("session_start", (_e, ctx) => {
		running = false;
		schedule(ctx);
	});
	pi.on("agent_start", (_e, ctx) => {
		running = true;
		clear(ctx);
	});
	pi.on("agent_settled", (_e, ctx) => {
		running = false;
		schedule(ctx);
	});
	pi.on("model_select", (_e, ctx) => {
		if (!running) schedule(ctx);
	});
	pi.on("session_shutdown", (_e, ctx) => clear(ctx));
}
