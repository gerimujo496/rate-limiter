import { Router } from "express";
import { Route } from "../conf/routes.js";
import { createUrl,  getAllUrls, getNextUrlId, getUrlByShortUrl, parseLongUrl } from "../helpers/urls.js";
import {
  BadRequestError,
  errorHandler,
 
} from "../utils/error.js";
import { returnLongUrl, returnShortUrl } from "../services/url-shortener.service.js";



export function createUrlsRouter() {
  const router = Router();



  router.get(`${Route.ShortUrl}/:shortUrl`, async (request, response) => {
    try {
      const shortUrl = request.params.shortUrl;

      if (!shortUrl) {
        throw new BadRequestError("short_url is required.");
      }

      const longUrl = await returnLongUrl(shortUrl);
      response.redirect(308, longUrl);
    } catch (error) {
      const { status, message } = errorHandler(error);
      response.status(status).json({ error: message });
    }
  });

  router.post(Route.Urls, async (request, response) => {
    try {
      const longUrl = parseLongUrl(request.body);
     
      const shortUrl = await returnShortUrl(longUrl);
      


      response.status(201).json({shortUrl});
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

