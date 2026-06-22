import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const validUrl = new URL(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 sec timeout

    const response = await fetch(validUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; 0g-nexus/1.0; +http://0g-nexus.com)",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();

    // Helper function to extract meta tag content
    const getMetaTag = (html: string, property: string) => {
      const regex = new RegExp(`<meta[^>]*?(?:property|name)=["']${property}["'][^>]*?content=["']([^"']*)["'][^>]*?>`, 'i');
      const match = html.match(regex);
      if (match) return match[1];

      const regexFallback = new RegExp(`<meta[^>]*?content=["']([^"']*)["'][^>]*?(?:property|name)=["']${property}["'][^>]*?>`, 'i');
      const matchFallback = html.match(regexFallback);
      return matchFallback ? matchFallback[1] : null;
    };

    const getTitleTag = (html: string) => {
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return match ? match[1] : null;
    };

    const title = getMetaTag(html, "og:title") || getTitleTag(html) || validUrl.hostname;
    const description = getMetaTag(html, "og:description") || getMetaTag(html, "description") || "";
    let image = getMetaTag(html, "og:image") || getMetaTag(html, "twitter:image") || "";

    if (image && !image.startsWith("http")) {
      image = new URL(image, validUrl.origin).toString();
    }

    return NextResponse.json({
      title: title?.trim(),
      description: description?.trim(),
      image: image?.trim() || null,
      url: validUrl.toString(),
      hostname: validUrl.hostname
    });
  } catch (error: any) {
    console.error("Error fetching preview for URL:", url, error);
    return NextResponse.json(
      { error: "Failed to fetch preview", details: error.message },
      { status: 500 }
    );
  }
}
