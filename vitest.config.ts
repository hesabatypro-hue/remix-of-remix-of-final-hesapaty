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
      // Scope: logic layer (webhooks, retries, helpers) + the covered UI layer.
      include: [
        "supabase/functions/_shared/**/*.ts",
        "src/lib/**/*.ts",
        "src/components/dashboard/StatCard.tsx",
        "src/components/limits/LimitBadge.tsx",
        "src/components/transfers/StatusBadge.tsx",
        "src/components/transfers/InlineMemoEditor.tsx",
        "src/components/print-orders/PrintOrderStatusBadge.tsx",
        "src/components/print-orders/PrintOrdersTable.tsx",
        "src/components/monitoring/CronJobsCard.tsx",
        "src/pages/ProcessingMonitor.tsx",
      ],

      exclude: ["src/lib/mcp/**"],
      thresholds: { lines: 75, functions: 75, statements: 75, branches: 80 },
    },

  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
