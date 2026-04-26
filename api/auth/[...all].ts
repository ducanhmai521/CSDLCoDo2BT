const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL;

export default async function handler(req: any, res: any) {
  if (!CONVEX_SITE_URL) {
    res.status(500).json({ error: "CONVEX_SITE_URL is not configured" });
    return;
  }

  const url = new URL(req.url!, CONVEX_SITE_URL);

  const response = await fetch(url.toString(), {
    method: req.method,
    headers: req.headers as HeadersInit,
    body:
      req.method !== "GET" && req.method !== "HEAD"
        ? JSON.stringify(req.body)
        : undefined,
  });

  res.status(response.status);
  response.headers.forEach((value: string, key: string) =>
    res.setHeader(key, value)
  );
  const body = await response.text();
  res.send(body);
}
