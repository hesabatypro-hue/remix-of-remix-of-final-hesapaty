import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
      // Scope: the logic layer under test (webhooks, retries, core helpers).
      include: [
        "supabase/functions/_shared/**/*.ts",
        "src/lib/**/*.ts",
      ],
      exclude: ["src/lib/mcp/**"],
      thresholds: { lines: 50, functions: 50, statements: 50, branches: 50 },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
