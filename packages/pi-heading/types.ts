// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

export type WidgetMode = "goal" | "working" | "achievement" | "idle";

export interface HeadingExposure {
    topic: string;
    goal: string;
    achievement?: string;
    mode: WidgetMode;
}

export interface State {
    topic: string;
    goal: string;
    achievement?: string;
}
