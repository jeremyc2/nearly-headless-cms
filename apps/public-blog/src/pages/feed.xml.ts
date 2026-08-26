import type { APIRoute } from "astro";
import { DateTime } from "effect";
import { publicExport } from "../data/public-export.ts";
import rss from "@astrojs/rss";

const GET: APIRoute = (context) => {
  if (context.site === undefined) {
    throw new Error("The Public Blog RSS route requires a configured site address");
  }
  return rss({
    description: "Field notes for durable ideas",
    items: publicExport.posts.map((post) => ({
      description: post.excerpt,
      link: `/posts/${post.slug}/`,
      pubDate: DateTime.toDate(DateTime.makeUnsafe(post.publishedAt)),
      title: post.title,
    })),
    site: context.site,
    title: "The Lantern",
  });
};

export { GET };
