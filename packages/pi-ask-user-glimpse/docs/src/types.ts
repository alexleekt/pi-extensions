/**
 * Type definitions for the docs shared utilities
 */

export interface Issue {
  title: string;
  details: string[];
  severity: string | null;
  status: string | null;
  file: string | null;
}

export interface ContextTerm {
  term: string;
  definition: string;
}

export interface ParsedContext {
  [category: string]: ContextTerm[];
}

export interface ParsedRoadmap {
  [section: string]: Issue[];
}

export type ThemeMode = 'light' | 'dark';

export interface ThemeController {
  toggle: () => void;
  isDark: () => boolean;
}
