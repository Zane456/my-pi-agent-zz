/**
 * /account — menu front end for pi-multi-account.
 * Bare /multi-account dumps the full status; this opens pick-lists and runs the matching subcommand.
 * Destructive subcommands (remove, clear, reset) are left out on purpose.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SWITCH = "switch";
const ADD = "add";

const MENU: [label: string, subcommand: string][] = [
	["自动换到一个现在能用的账号", "best"],
	["选择要切换的账号…", SWITCH],
	["换到下一个账号", "next"],
	["查看当前账号的额度", "limits"],
	["查看所有账号", "accounts"],
	["给当前账号选模型", "pick"],
	["添加账号…", ADD],
	["完整状态", "status"],
];

const FAMILIES: [label: string, family: string][] = [
	["Claude（Anthropic 订阅）", "anthropic"],
	["ChatGPT（Codex 订阅）", "codex"],
	["Kimi（Kimi For Coding）", "kimi"],
	["Cursor", "cursor"],
	["Qwen", "qwen"],
	["Ollama", "ollama"],
];

const ACCOUNT_LABELS: [prefix: string, name: string][] = [
	["anthropic", "Claude"],
	["openai-codex", "ChatGPT Codex"],
	["openai", "ChatGPT"],
	["kimi", "Kimi"],
	["cursor", "Cursor"],
	["zai", "GLM"],
	["xai", "Grok"],
	["qwen", "Qwen"],
	["ollama", "Ollama"],
];

function accountLabel(id: string): string {
	const name = ACCOUNT_LABELS.find(([prefix]) => id === prefix || id.startsWith(`${prefix}-`))?.[1];
	return name ? `${name}（${id}）` : id;
}

/** Logged-in account ids (auth.json keys) minus excluded providers. Reads names only. */
function loggedInAccounts(): string[] {
	const dir = join(homedir(), ".pi/agent");
	try {
		const ids = Object.keys(JSON.parse(readFileSync(join(dir, "auth.json"), "utf8")));
		let excluded: string[] = [];
		try {
			excluded = JSON.parse(readFileSync(join(dir, "provider-failover.json"), "utf8")).excludedProviders ?? [];
		} catch {}
		return ids.filter((id) => !excluded.includes(id));
	} catch {
		return [];
	}
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("account", {
		description: "切换账号 / 看额度（multi-account 菜单）",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			const run = (subcommand: string) =>
				pi.sendUserMessage(`/multi-account ${subcommand}`, {
					expandPromptTemplates: true,
					...(ctx.isIdle() ? {} : { deliverAs: "followUp" as const }),
				});

			const picked = await ctx.ui.select("账号", MENU.map(([label]) => label));
			const subcommand = MENU.find(([label]) => label === picked)?.[1];
			if (!subcommand) return;

			if (subcommand === SWITCH) {
				const ids = loggedInAccounts();
				if (ids.length === 0) return ctx.ui.notify("没有读到已登录的账号，用 /login 登录", "warning");
				const labels = ids.map(accountLabel);
				const target = await ctx.ui.select("切换到", labels);
				const id = ids[labels.indexOf(target ?? "")];
				if (id) run(`switch ${id}`);
				return;
			}

			if (subcommand === ADD) {
				const target = await ctx.ui.select("添加哪家的账号", FAMILIES.map(([label]) => label));
				const family = FAMILIES.find(([label]) => label === target)?.[1];
				if (family) run(`add ${family}`);
				return;
			}

			run(subcommand);
		},
	});
}
