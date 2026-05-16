import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { AskUserPayload, Question } from "../shared/ask-user.js";

export async function terminalPrompt(
	payload: AskUserPayload,
	ui: ExtensionUIContext | undefined,
): Promise<Record<string, unknown> | null> {
	if (!ui) {
		return null;
	}

	// Questionnaire mode: structured questions with per-question options
	if (payload.questions && payload.questions.length > 0) {
		return questionnaireFallback(payload.questions, payload.allowComment, ui);
	}

	// Legacy flat options mode
	return flatOptionsFallback(payload, ui);
}

async function questionnaireFallback(
	questions: Question[],
	allowComment: boolean,
	ui: ExtensionUIContext,
): Promise<Record<string, unknown> | null> {
	const answers: { question: string; answer: string; kind: "selection" | "freeform"; comment?: string }[] = [];

	for (const q of questions) {
		let answer: string | undefined;

		if (q.options && q.options.length > 0) {
			const labels = q.options.map((opt, i) => `${i + 1}. ${opt.title}`);

			if (q.allowMultiple) {
				// Multi-select via repeated single selects
				const selections: string[] = [];
				while (true) {
					const remaining = labels.filter((_, i) => !selections.includes(q.options![i].title));
					if (remaining.length === 0) break;

					const choice = await ui.select(
						`${q.title}\nSelected: ${selections.join(", ") || "none"}\nChoose one (or cancel to finish)`,
						remaining,
					);
					if (choice === undefined) break;

					const idx = labels.indexOf(choice);
					const title = q.options[idx]?.title;
					if (title && !selections.includes(title)) {
						selections.push(title);
					}
				}
				answer = selections.join(", ");
			} else {
				// Single select
				const choice = await ui.select(q.title, labels);
				if (choice === undefined) return null;
				const idx = labels.indexOf(choice);
				answer = q.options[idx]?.title;
			}
		} else {
			// Freeform text input
			answer = await ui.input(q.title + (q.description ? `\n${q.description}` : ""));
		}

		if (answer === undefined) return null;

		let comment: string | undefined;
		if (allowComment) {
			comment = (await ui.input(`Comment for "${q.title}" (press Enter to skip):`)) ?? undefined;
		}

		answers.push({
			question: q.title,
			answer,
			kind: (q.options && q.options.length > 0 ? "selection" : "freeform"),
			comment,
		});
	}

	return {
		kind: "questionnaire",
		selections: answers.map((a) => `${a.question}: ${a.answer}`),
		questionnaireDetails: answers,
	};
}

async function flatOptionsFallback(
	payload: AskUserPayload,
	ui: ExtensionUIContext,
): Promise<Record<string, unknown> | null> {
	const { question, options, allowMultiple, allowFreeform, allowComment } = payload;

	if (options.length === 0 || (!allowMultiple && !allowFreeform)) {
		// Single text input
		const text = await ui.input(question);
		if (text === undefined) return null;
		return { kind: "freeform", text };
	}

	// Build option labels for select dialog
	const optionLabels = options.map((opt: { title: string }, i: number) => `${i + 1}. ${opt.title}`);
	if (allowFreeform) {
		optionLabels.push("Other (freeform)");
	}

	if (allowMultiple) {
		// Multi-select via repeated single selects until user cancels or chooses done
		const selections: string[] = [];
		while (true) {
			const remaining = optionLabels.filter(
				(_: string, i: number) => !selections.includes(options[i]?.title ?? ""),
			);
			if (remaining.length === 0) break;

			const choice = await ui.select(
				`${question}\nSelected: ${selections.join(", ") || "none"}\nChoose one (or cancel to finish)`,
				remaining,
			);
			if (choice === undefined) break;

			const idx = optionLabels.indexOf(choice);
			if (idx >= options.length) {
				// Freeform option selected
				const text = await ui.input("Enter your answer:");
				if (text !== undefined) {
					return { kind: "freeform", text };
				}
				break;
			}
			const title = options[idx]?.title;
			if (title && !selections.includes(title)) {
				selections.push(title);
			}
		}

		let comment: string | undefined;
		if (allowComment && selections.length > 0) {
			comment = (await ui.input("Optional comment (press Enter to skip):")) ?? undefined;
		}

		return { kind: "selection", selections, comment };
	} else {
		// Single select
		const choice = await ui.select(question, optionLabels);
		if (choice === undefined) return null;

		const idx = optionLabels.indexOf(choice);
		if (idx >= options.length) {
			// Freeform
			const text = await ui.input("Enter your answer:");
			if (text === undefined) return null;
			return { kind: "freeform", text };
		}

		const title = options[idx]?.title;
		if (!title) return null;

		let comment: string | undefined;
		if (allowComment) {
			comment = (await ui.input("Optional comment (press Enter to skip):")) ?? undefined;
		}

		return { kind: "selection", selections: [title], comment };
	}
}
