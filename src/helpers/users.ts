import { query } from "../lib/db.js";
import { CreateUserBody, UpdateUserBody, UserRecord } from "../types/user.js";
import { BadRequestError, NotFoundError } from "../utils/error.js";

export async function listUsers(): Promise<UserRecord[]> {
  const result = await query<UserRecord>(
    `
      SELECT id, name, phone_number
      FROM users
      ORDER BY id ASC
    `,
  );

  return result.rows;
}

export async function getUserById(id: number): Promise<UserRecord> {
  const result = await query<UserRecord>(
    `
      SELECT id, name, phone_number
      FROM users
      WHERE id = $1
    `,
    [id],
  );

  if (!result.rows[0]) {
    throw new NotFoundError(`User with id ${id} was not found.`);
  }

  return result.rows[0];
}

export async function createUser(user: CreateUserBody): Promise<UserRecord> {
  const result = await query<UserRecord>(
    `
      INSERT INTO users (name, phone_number)
      VALUES ($1, $2)
      RETURNING id, name, phone_number
    `,
    [user.name, user.phone_number],
  );

  if (!result.rows[0]) {
    throw new BadRequestError("Failed to create user.");
  }

  return result.rows[0];
}

export async function updateUser(
  id: number,
  user: UpdateUserBody,
): Promise<UserRecord> {
  const result = await query<UserRecord>(
    `
      UPDATE users
      SET name = $2, phone_number = $3
      WHERE id = $1
      RETURNING id, name, phone_number
    `,
    [id, user.name, user.phone_number],
  );

  if (!result.rows[0]) {
    throw new NotFoundError(`User with id ${id} was not found.`);
  }

  return result.rows[0];
}

export async function deleteUser(id: number): Promise<UserRecord> {
  const result = await query<UserRecord>(
    `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, name, phone_number
    `,
    [id],
  );

  if (!result.rows[0]) {
    throw new NotFoundError(`User with id ${id} was not found.`);
  }

  return result.rows[0];
}
