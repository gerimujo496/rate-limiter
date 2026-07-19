import { z } from "zod";

export const webhookHttpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

export const WEBHOOK_HTTP_METHODS = webhookHttpMethodSchema.options;

export const registerWebhookBodySchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "url is required")
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
  methods: z
    .array(webhookHttpMethodSchema, {
      error: "methods must be an array of HTTP methods",
    })
    .min(1, "methods must be a non-empty array")
    .transform((methods) => [...new Set(methods)]),
});

export type WebhookHttpMethod = z.infer<typeof webhookHttpMethodSchema>;
export type RegisterWebhookBody = z.infer<typeof registerWebhookBodySchema>;
