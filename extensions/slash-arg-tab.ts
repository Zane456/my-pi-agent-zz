/**
 * Slash-command argument hints.
 * 1. Tab shows argument completions (Pi's built-in provider skips them on Tab and lists files instead).
 * 2. Adds completions for extension commands that ship none (choice lists below).
 */

import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Choice = [value: string, description: string];

// A trailing space in a value means the choice takes a further argument.
const CHOICES: Record<string, Choice[]> = {
	effort: [
		["off", "关闭，消息不再自动走并行工作流"],
		["high", "实质性消息自动走并行工作流（较彻底）"],
		["ultra", "实质性消息自动走并行工作流（最彻底）"],
	],
	ultracode: [["off", "关闭 ultracode 模式"]],
	workflows: [
		["run ", "对一个任务启动工作流"],
		["status ", "查看某次运行，完成后打印结果"],
		["stop ", "停止某次运行"],
		["pause ", "暂停某次运行"],
		["resume ", "继续某次运行"],
		["rm ", "删除某次运行记录"],
		["save ", "把最近的脚本存成可复用命令"],
	],
	"workflows-trigger": [
		["status", "查看关键词触发状态"],
		["on", "开启关键词自动触发"],
		["off", "关闭关键词自动触发"],
		["set ", "换一个触发词"],
		["reset", "恢复默认触发词 workflow"],
	],
	"workflows-progress": [
		["compact", "进度面板精简显示"],
		["detailed", "进度面板详细显示"],
		["status", "查看当前设置"],
		["max ", "详细模式下每阶段最多显示几个子代理"],
	],
	curator: [
		["on", "开启搜索结果整理"],
		["off", "关闭搜索结果整理"],
		["none", "只返回原始结果"],
		["summary-review", "整理并让你审阅"],
		["auto-summary", "自动整理摘要"],
	],
	"subagents-watchdog": [
		["status", "查看看门狗状态"],
		["on", "开启子代理看门狗"],
		["off", "关闭子代理看门狗"],
		["check", "立即检查一次"],
		["recommend-model", "推荐看门狗用的模型"],
	],
};

function promptWorkflowChoices(): Choice[] {
	const dirs = [
		join(homedir(), ".pi/agent/npm/node_modules/pi-subagents/prompts"),
		join(homedir(), ".pi/agent/prompts"),
	];
	const names = new Set<string>();
	for (const dir of dirs) {
		if (!existsSync(dir)) continue;
		for (const file of readdirSync(dir)) if (file.endsWith(".md")) names.add(file.slice(0, -3));
	}
	return [["list", "列出全部模板"], ...[...names].map((name): Choice => [`${name} `, "用子代理跑这个模板"])];
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		const choices: Record<string, Choice[]> = { ...CHOICES, "prompt-workflow": promptWorkflowChoices() };
		ctx.ui.addAutocompleteProvider((current) => ({
			async getSuggestions(lines, cursorLine, cursorCol, options) {
				const before = (lines[cursorLine] ?? "").slice(0, cursorCol).trimStart();
				const match = before.match(/^\/(\S+) (\S*)$/);
				const list = match && choices[match[1]];
				if (list) {
					const items = list
						.filter(([value]) => value.startsWith(match[2]))
						.map(([value, description]) => ({ value, label: value.trim(), description }));
					if (items.length > 0) return { items, prefix: match[2] };
				}
				if (options.force && before.startsWith("/") && before.includes(" ")) {
					const args = await current.getSuggestions(lines, cursorLine, cursorCol, { ...options, force: false });
					if (args) return args;
				}
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			},
			applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
				return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
			},
			shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
				return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
			},
		}));
	});
}
