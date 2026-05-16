import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [react(), viteSingleFile()],
	root: __dirname,
	build: {
		outDir: resolve(__dirname, "../dist"),
		emptyOutDir: true,
	},
});
