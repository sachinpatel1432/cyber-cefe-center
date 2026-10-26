
import "dotenv/config";
import { verifyEmailTransport } from "./services/emailService.js";

try {
  await verifyEmailTransport();
  console.log("Email service is ready.");
} catch {
  console.error(
    "Email service is not ready. Check the SMTP configuration."
  );
  process.exitCode = 1;
}
