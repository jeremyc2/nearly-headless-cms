import rss from "@astrojs/rss";
import { publicExport } from "../data/public-export.ts";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  return rss({
    description: "Field notes for durable ideas",
    items: publicExport.posts.map((post) => ({
      title: post.title,
      description: post.excerpt,
      pubDate: new Date(post.publishedAt),
      link: `/posts/${post.slug}/`,
    })),
    site: context.site!,
    title: "The Lantern",
  });
}
