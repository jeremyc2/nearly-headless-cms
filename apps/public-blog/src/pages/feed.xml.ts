import rss from "@astrojs/rss";
import { publicExport } from "../data/public-export.ts";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  return rss({
    description: "Field notes for durable ideas",
    items: publicExport.posts.map((post) => ({
      description: post.excerpt,
      link: `/posts/${post.slug}/`,
      pubDate: new Date(post.publishedAt),
      title: post.title,
    })),
    site: context.site!,
    title: "The Lantern",
  });
}
