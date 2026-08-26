import { defineConfig } from "astro/config";
import { env } from "bun";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  build: { format: "directory" },
  output: "static",
  site: env.PUBLIC_BLOG_SITE ?? "http://localhost:4321",
  vite: { plugins: [tailwindcss()] },
});
