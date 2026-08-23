import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  build: { format: "directory" },
  output: "static",
  site: process.env.PUBLIC_BLOG_SITE ?? "http://localhost:4321",
  vite: { plugins: [tailwindcss()] },
});
