import type { WebhookHttpMethod } from "../schemas/webhook.js";

export {
  WEBHOOK_HTTP_METHODS,
  type RegisterWebhookBody,
  type WebhookHttpMethod,
} from "../schemas/webhook.js";

export interface WebhookRecord {
  id: number;
  url: string;
  methods: WebhookHttpMethod[];
}
