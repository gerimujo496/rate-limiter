import { Router } from "express";
import { Route } from "../conf/routes.js";
import {
  createUserBodySchema,
  updateUserBodySchema,
  userIdParamSchema,
} from "../schemas/user.js";
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  updateUser,
} from "../helpers/users.js";
import { triggerWebhooks } from "../services/webhook.service.js";
import { errorHandler } from "../utils/error.js";
import { parseSchema } from "../utils/validation.js";

export function createUsersRouter() {
  const router = Router();

  router.get(Route.Users, async (_request, response) => {
    try {
      const users = await listUsers();
      await triggerWebhooks("GET", "user.listed", users);
      response.status(200).json(users);
    } catch (error) {
      const { status, message } = errorHandler(error);
      response.status(status).json({ error: message });
    }
  });

  router.get(`${Route.Users}/:id`, async (request, response) => {
    try {
      const { id } = parseSchema(userIdParamSchema, request.params);
      const user = await getUserById(id);
      await triggerWebhooks("GET", "user.retrieved", user);
      response.status(200).json(user);
    } catch (error) {
      const { status, message } = errorHandler(error);
      response.status(status).json({ error: message });
    }
  });

  router.post(Route.Users, async (request, response) => {
    try {
      const body = parseSchema(createUserBodySchema, request.body);
      const user = await createUser(body);
      await triggerWebhooks("POST", "user.created", user);
      response.status(201).json(user);
    } catch (error) {
      const { status, message } = errorHandler(error);
      response.status(status).json({ error: message });
    }
  });

  router.put(`${Route.Users}/:id`, async (request, response) => {
    try {
      const { id } = parseSchema(userIdParamSchema, request.params);
      const body = parseSchema(updateUserBodySchema, request.body);
      const user = await updateUser(id, body);
      await triggerWebhooks("PUT", "user.updated", user);
      response.status(200).json(user);
    } catch (error) {
      const { status, message } = errorHandler(error);
      response.status(status).json({ error: message });
    }
  });

  router.delete(`${Route.Users}/:id`, async (request, response) => {
    try {
      const { id } = parseSchema(userIdParamSchema, request.params);
      const user = await deleteUser(id);
      await triggerWebhooks("DELETE", "user.deleted", user);
      response.status(200).json(user);
    } catch (error) {
      const { status, message } = errorHandler(error);
      response.status(status).json({ error: message });
    }
  });

  return router;
}
