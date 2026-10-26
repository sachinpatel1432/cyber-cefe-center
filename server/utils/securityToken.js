
import { randomBytes, createHash } from "node:crypto";

export const generateSecurityToken = () =>
  randomBytes(32).toString("hex");

export const hashSecurityToken = (token) =>
  createHash("sha256").update(token).digest("hex");
