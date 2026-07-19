export interface UserRecord {
  id: number;
  name: string;
  phone_number: string;
}

export type { CreateUserBody, UpdateUserBody } from "../schemas/user.js";
