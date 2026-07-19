import { z } from "zod";

export const createUserBodySchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  phone_number: z.string().trim().min(1, "phone_number is required"),
});

export const updateUserBodySchema = createUserBodySchema;

export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive("id must be a positive integer"),
});

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
