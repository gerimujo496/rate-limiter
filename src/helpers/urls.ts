import { query } from "../lib/db.js";
import { UrlRecord } from "../types/url.js";
import { BadRequestError } from "../utils/error.js";

export async function getNextUrlId(): Promise<number> {
  const result = await query<{ next_id: string }>(
    `
      SELECT CASE
        WHEN is_called THEN last_value + 1
        ELSE last_value
      END::bigint AS next_id
      FROM urls_id_seq
    `,
  );

  return Number(result.rows[0].next_id);
}

export const getUrlByLongUrl = async(longUrl: string): Promise<UrlRecord | null> => {
  const result = await query<UrlRecord>(
    `
      SELECT id, long_url, short_url, created_at
      FROM urls
      WHERE long_url = $1
    `,
    [longUrl],
  );

  return result.rows[0] ?? null;
};

export async function createUrl(
  longUrl: string,
  shortUrl: string,
): Promise<UrlRecord> {
  const result = await query<UrlRecord>(
    `
      INSERT INTO urls (long_url, short_url)
      VALUES ($1, $2)
      RETURNING id, long_url, short_url, created_at
    `,
    [longUrl, shortUrl],
  );

  return result.rows[0];
}
export async function getUrlByShortUrl(
  shortUrl: string,
): Promise<UrlRecord | null> {
  const result = await query<UrlRecord>(
    `
      SELECT id, long_url, short_url, created_at
      FROM urls
      WHERE short_url = $1
    `,
    [shortUrl],
  );

  return result.rows[0] ?? null;
}

export async function getAllUrls(): Promise<UrlRecord[]> {
  const result = await query<UrlRecord>(
    `
      SELECT id, long_url, short_url, created_at
      FROM urls
      ORDER BY id ASC
    `,
  );

  return result.rows;
}



export function parseLongUrl(body: unknown): string {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a JSON object.");
  }

  const { long_url: longUrl } = body as {
    long_url?: unknown;
  };

  if (typeof longUrl !== "string" || longUrl.trim() === "") {
    throw new BadRequestError("long_url is required.");
  }

  let parsedLongUrl: URL;

  try {
    parsedLongUrl = new URL(longUrl.trim());
  } catch {
    throw new BadRequestError("long_url must be a valid URL.");
  }

  if (!["http:", "https:"].includes(parsedLongUrl.protocol)) {
    throw new BadRequestError("long_url must use http or https.");
  }

  return parsedLongUrl.toString();
}

