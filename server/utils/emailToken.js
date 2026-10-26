
import { randomBytes, createHash } from "node:crypto";

export const generateEmailVerificationToken = () => {
  const token = randomBytes(32).toString("hex");

  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  return { token, tokenHash, expiresAt };
};

export const hashEmailVerificationToken = (token) => {
  return createHash("sha256").update(token).digest("hex");
};
