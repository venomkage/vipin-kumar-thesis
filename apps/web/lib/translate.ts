// apps/web/app/lib/translate.ts
// JSON-based LibreTranslate client + simple health check

type TranslateResponse = {
  translatedText?: string;
};

function getBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_LIBRETRANSLATE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_LIBRETRANSLATE_URL is missing");
  return base.replace(/\/$/, "");
}

/**
 * Health check: tries to fetch /languages (commonly available in LibreTranslate).
 * Returns true if reachable and returns an array.
 */
export async function checkTranslateService(): Promise<boolean> {
  try {
    const base = getBaseUrl();
    const res = await fetch(`${base}/languages`, { method: "GET" });
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data);
  } catch {
    return false;
  }
}

export async function translateText(
  text: string,
  target: "en" | "de",
  source: string = "auto"
): Promise<string> {
  const base = getBaseUrl();
  const url = `${base}/translate`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source,
      target,
      format: "text",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`translate failed: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as TranslateResponse;

  if (typeof data.translatedText !== "string") {
    throw new Error("translate failed: invalid response");
  }

  return data.translatedText;
}
