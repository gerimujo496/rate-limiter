import { z } from "zod";

export const createUrlBodySchema = z.object({
  long_url: z
    .string()
    .trim()
    .min(1, "long_url is required")
    .refine(
      (value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "must be a valid http or https URL" },
    )
    .transform((value) => new URL(value).toString()),
});

export const shortUrlParamSchema = z.object({
  shortUrl: z.string().trim().min(1, "short_url is required"),
});

export type CreateUrlBody = z.infer<typeof createUrlBodySchema>;
