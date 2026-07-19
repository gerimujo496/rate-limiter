import { Router } from "express";
import { Route } from "../conf/routes.js";
import { createUrlBodySchema, shortUrlParamSchema } from "../schemas/url.js";
import { errorHandler } from "../utils/error.js";
import { parseSchema } from "../utils/validation.js";
import {
  returnLongUrl,
  returnShortUrl,
} from "../services/url-shortener.service.js";

export function createUrlsRouter() {
  const router = Router();

  router.get(`${Route.ShortUrl}/:shortUrl`, async (request, response) => {
    try {
      const { shortUrl } = parseSchema(shortUrlParamSchema, request.params);
      const longUrl = await returnLongUrl(shortUrl);
      response.redirect(308, longUrl);
    } catch (error) {
      const { status, message } = errorHandler(error);
      response.status(status).json({ error: message });
    }
  });

  router.post(Route.Urls, async (request, response) => {
    try {
      const { long_url: longUrl } = parseSchema(
        createUrlBodySchema,
        request.body,
      );
      const shortUrl = await returnShortUrl(longUrl);

      response.status(201).json({ shortUrl });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      ) {
        response.status(409).json({ error: "short_url already exists." });
        return;
      }

      const { status, message } = errorHandler(error);
      response.status(status).json({ error: message });
    }
  });

  return router;
}
