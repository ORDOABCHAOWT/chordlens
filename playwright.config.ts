import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:1420",
    viewport: { width: 1448, height: 1086 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: "./node_modules/.bin/vite",
    url: "http://127.0.0.1:1420/",
    reuseExistingServer: true,
  },
});
