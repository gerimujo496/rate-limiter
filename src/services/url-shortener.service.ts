import {
  getUrlByLongUrl,
  getUrlByShortUrl,
  insertLongUrl,
  updateShortUrl,
} from "../helpers/urls.js";
import {
  getRedisValue,
  releaseLock,
  setRedisValue,
  tryAcquireLock,
} from "../lib/redis.js";
import { UrlShortener } from "../types/url-shortener.js";
import { UrlRecord } from "../types/url.js";
import { BadRequestError, NotFoundError } from "../utils/error.js";

const LONG_URL_KEY_PREFIX = "long-url:";
const SHORT_URL_KEY_PREFIX = "short-url:";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
const LOCK_TTL_SECONDS = 5;
const STAMPEDE_WAIT_ATTEMPTS = 10;
const STAMPEDE_WAIT_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const returnShortUrl = async (longUrl: string): Promise<string> => {
  const existingUrl = await returnPreviousGeneratedShortUrl(longUrl);
  if (existingUrl) {
    return existingUrl;
  }

  const saved = await saveGeneratedShortUrl(longUrl);
  return `${process.env.BASE_URL}/shorturl/${saved.short_url}`;
};

const returnPreviousGeneratedShortUrl = async (
  longUrl: string,
): Promise<string | null> => {
  const key = `${LONG_URL_KEY_PREFIX}${longUrl}`;
  const value = await getRedisValue<UrlShortener>(key);
  if (value?.shortUrl) {
    return value.shortUrl;
  }

  const existingUrl = await getUrlByLongUrl(longUrl);
  if (existingUrl?.short_url) {
    await setRedisValue<UrlShortener>(
      key,
      {
        longUrl,
        shortUrl: existingUrl.short_url,
        createdAt: existingUrl.created_at,
      },
      CACHE_TTL_SECONDS,
    );
    return existingUrl.short_url;
  }
  return null;
};

export const generateShortUrl = (id: number): string => {
  return Buffer.from(id.toString(), "utf-8").toString("base64");
};

const saveGeneratedShortUrl = async (longUrl: string): Promise<UrlRecord> => {
  const inserted = await insertLongUrl(longUrl);
  const record = inserted ?? (await getUrlByLongUrl(longUrl));

  if (!record) {
    throw new BadRequestError("Failed to create or find URL record.");
  }

  const url =
    record.short_url != null
      ? record
      : await updateShortUrl(record.id, generateShortUrl(record.id));

  if (!url.short_url) {
    throw new BadRequestError("Failed to assign short URL.");
  }

  const key = `${LONG_URL_KEY_PREFIX}${longUrl}`;
  await setRedisValue<UrlShortener>(
    key,
    {
      longUrl,
      shortUrl: url.short_url,
      createdAt: url.created_at,
    },
    CACHE_TTL_SECONDS,
  );

  return url;
};

async function loadLongUrlFromDbAndCache(
  shortUrl: string,
  cacheKey: string,
): Promise<string> {
  const url = await getUrlByShortUrl(shortUrl);
  if (!url) {
    throw new NotFoundError(`Short URL "${shortUrl}" was not found.`);
  }

  await setRedisValue<UrlShortener>(
    cacheKey,
    {
      longUrl: url.long_url,
      shortUrl,
      createdAt: url.created_at,
    },
    CACHE_TTL_SECONDS,
  );

  return url.long_url;
}

/**
 * Cache-aside redirect lookup with stampede protection.
 * On a miss, only one caller (across instances) holds a Redis lock to hit
 * Postgres; others wait briefly and re-read the cache.
 */
export const returnLongUrl = async (shortUrl: string): Promise<string> => {
  const cacheKey = `${SHORT_URL_KEY_PREFIX}${shortUrl}`;
  const cached = await getRedisValue<UrlShortener>(cacheKey);
  if (cached?.longUrl) {
    return cached.longUrl;
  }

  const lockKey = `lock:${cacheKey}`;
  let lockToken: string | null = null;

  try {
    lockToken = await tryAcquireLock(lockKey, LOCK_TTL_SECONDS);
  } catch (error) {
    console.error(
      `Failed to acquire cache lock for "${cacheKey}", loading from DB:`,
      error,
    );
    return loadLongUrlFromDbAndCache(shortUrl, cacheKey);
  }

  if (lockToken) {
    try {
      const warmed = await getRedisValue<UrlShortener>(cacheKey);
      if (warmed?.longUrl) {
        return warmed.longUrl;
      }

      return await loadLongUrlFromDbAndCache(shortUrl, cacheKey);
    } finally {
      await releaseLock(lockKey, lockToken);
    }
  }

  for (let attempt = 0; attempt < STAMPEDE_WAIT_ATTEMPTS; attempt++) {
    await sleep(STAMPEDE_WAIT_MS);
    const value = await getRedisValue<UrlShortener>(cacheKey);
    if (value?.longUrl) {
      return value.longUrl;
    }
  }

  // Lock holder stalled or Redis lock unavailable — fall back to DB once.
  return loadLongUrlFromDbAndCache(shortUrl, cacheKey);
};
