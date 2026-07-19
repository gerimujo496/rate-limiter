import { query } from "../lib/db.js";
import { UrlRecord } from "../types/url.js";
import { BadRequestError } from "../utils/error.js";

export const getUrlByLongUrl = async (
  longUrl: string,
): Promise<UrlRecord | null> => {
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

export async function insertLongUrl(longUrl: string): Promise<UrlRecord | null> {
  const result = await query<UrlRecord>(
    `
      INSERT INTO urls (long_url)
      VALUES ($1)
      ON CONFLICT (long_url) DO NOTHING
      RETURNING id, long_url, short_url, created_at
    `,
    [longUrl],
  );

  return result.rows[0] ?? null;
}

export async function updateShortUrl(
  id: number,
  shortUrl: string,
): Promise<UrlRecord> {
  const result = await query<UrlRecord>(
    `
      UPDATE urls
      SET short_url = $2
      WHERE id = $1
      RETURNING id, long_url, short_url, created_at
    `,
    [id, shortUrl],
  );

  if (!result.rows[0]) {
    throw new BadRequestError("Failed to update short URL.");
  }

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

