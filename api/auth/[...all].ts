const convexUrl = process.env.VITE_CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL || (convexUrl ? convexUrl.replace(".cloud", ".site") : undefined);

export default async function handler(req: any, res: any) {
  if (!CONVEX_SITE_URL) {
    res.status(500).json({ error: "CONVEX_SITE_URL or VITE_CONVEX_URL is not configured" });
    return;
  }

  const url = new URL(req.url!, CONVEX_SITE_URL);

  const newHeaders = { ...req.headers };
  delete newHeaders.host; // Let fetch set the correct host header
  delete newHeaders.connection;

  const response = await fetch(url.toString(), {
    method: req.method,
    headers: newHeaders as HeadersInit,
    body:
      req.method !== "GET" && req.method !== "HEAD"
        ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
        : undefined,
  });

  res.status(response.status);
  response.headers.forEach((value: string, key: string) => {
    // Avoid sending transfer-encoding or content-encoding as the serverless wrapper handles it
    if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'content-encoding') {
      res.setHeader(key, value);
    }
  });
  const body = await response.text();
  res.send(body);
}
