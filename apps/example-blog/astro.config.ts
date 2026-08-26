import { defineConfig } from "astro/config";
import { env } from "bun";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  build: { format: "directory" },
  output: "static",
  server: { port: Number(env.EXAMPLE_BLOG_PORT ?? "4322") },
  site: env.EXAMPLE_BLOG_SITE ?? "http://localhost:4322",
  srcDir: "./src/presentation",
  vite: { plugins: [tailwindcss()] },
});
