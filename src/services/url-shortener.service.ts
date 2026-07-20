import { createUrl, getNextUrlId, getUrlByLongUrl, getUrlByShortUrl } from "../helpers/urls.js";
import { getRedisValue, setRedisValue } from "../lib/redis.js";
import { UrlShortener } from "../types/url-shortener.js";
import { UrlRecord } from "../types/url.js";
import { NotFoundError } from "../utils/error.js";

const LONG_URL_KEY_PREFIX = "long-url:"
const SHORT_URL_KEY_PREFIX = "short-url:"

export const returnShortUrl = async(longUrl: string): Promise<string> => {
  
    const existingUrl = await returnPreviousGeneratedShortUrl(longUrl);
  if (existingUrl) {
    return existingUrl;
  }
  const base64Text = await generateShortUrl();

  const based64SavedText = await saveGeneratedShortUrl(longUrl, base64Text);
  const shortUrl = `${process.env.BASE_URL}/shorturl/${based64SavedText.short_url}`;
  return shortUrl;
};

const returnPreviousGeneratedShortUrl = async(longUrl: string): Promise<string|null> => {
  const key = `${LONG_URL_KEY_PREFIX}${longUrl}`;
  const value = await getRedisValue<UrlShortener>(key);
  if (value) {
    return value.shortUrl;
  }
  
  const existingUrl = await getUrlByLongUrl(longUrl);
  if (existingUrl?.short_url) {
    const { short_url, created_at } = existingUrl;
    await setRedisValue<UrlShortener>(
      key,
      { longUrl, shortUrl: short_url, createdAt: created_at },
      60 * 60 * 24 * 30,
    );
    return short_url;
  }
  return null;
};

export const generateShortUrl = async(): Promise<string> => {
    const nextId = await getNextUrlId();
    const buffer = Buffer.from(nextId.toString(), 'utf-8');
  
    const base64Text = buffer.toString('base64');
  
    return base64Text;
  };

  const saveGeneratedShortUrl = async(longUrl: string, shortUrl: string): Promise<UrlRecord> => {
    const key = `${LONG_URL_KEY_PREFIX}${longUrl}`;
    await setRedisValue<UrlShortener>(key, { longUrl, shortUrl, createdAt: new Date() }, 60 * 60 * 24 * 30);
 
   const url = await createUrl(longUrl, shortUrl);
   return url;
};

export const returnLongUrl = async(shortUrl: string): Promise<string> => {
  const key = `${SHORT_URL_KEY_PREFIX}${shortUrl}`;
  const value = await getRedisValue<UrlShortener>(key);
  if (value) {
    return value.longUrl;
  }
  const url = await getUrlByShortUrl(shortUrl);
  if (url) {
    await setRedisValue<UrlShortener>(key, { longUrl: url.long_url, shortUrl, createdAt: url.created_at }, 60 * 60 * 24 * 30);
    return url.long_url;
  }
  throw new NotFoundError(`Short URL "${shortUrl}" was not found.`);
  
};