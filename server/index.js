import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import MongoStore from "connect-mongo";
import multer from "multer";

import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import serviceRequestRoutes from "./routes/serviceRequestRoutes.js";
import staffRequestRoutes from "./routes/staffRequestRoutes.js";
import requestConversationRoutes from "./routes/requestConversationRoutes.js";
import pushNotificationRoutes from "./routes/pushNotificationRoutes.js";

const app = express();

const PORT = Number(process.env.PORT) || 5001;
const isProduction = process.env.NODE_ENV === "production";

const mongoUri = isProduction
  ? process.env.MONGO_URI
  : process.env.MONGO_URI_LOCAL;

if (!mongoUri || !process.env.SESSION_SECRET) {
  throw new Error(
    "Database URI and SESSION_SECRET must be configured."
  );
}

if (!process.env.CLIENT_URL) {
  throw new Error("CLIENT_URL must be configured.");
}

if (isProduction) {
  app.set("trust proxy", 1);
}

/**
 * Security and request middleware
 */
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "20kb" }));

app.use(
  express.urlencoded({
    extended: false,
    limit: "20kb",
  })
);

/**
 * Session configuration
 */
app.use(
  session({
    name: "cybercafe.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,

    store: MongoStore.create({
      mongoUrl: mongoUri,
      collectionName: "sessions",
      ttl: 14 * 24 * 60 * 60,
    }),

    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

/**
 * API health check
 * GET /api/health
 */
app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Cyber Cafe Center API is running.",
  });
});

/**
 * Application routes
 */
app.use("/api/auth", authRoutes);

app.use("/api/profile", profileRoutes);

app.use("/api/admin", adminRoutes);

app.use("/api/services", serviceRoutes);

// Customer booking, history, cancellation,
// customer document upload and deliverable download.
app.use("/api/service-requests", serviceRequestRoutes);

// Staff queue, request claim, review and deliverable upload.
app.use("/api/staff/requests", staffRequestRoutes);


// Request conversation endpoints for customers, staff and admins.
app.use("/api/requests", requestConversationRoutes);

// Push notification subscription endpoints for customers and staff.
app.use("/api/notifications", pushNotificationRoutes);

/**
 * JSON 404 handler
 *
 * Reached when no registered route matches the request.
 */
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    code: "ROUTE_NOT_FOUND",
    message: `No route found for ${req.method} ${req.originalUrl}.`,
  });
});

/**
 * Central error handler
 *
 * Must remain after all routes and the 404 handler.
 */
app.use((err, req, res, next) => {
  console.error("\n========== REQUEST ERROR ==========");
  console.error("Path:", req.method, req.originalUrl);
  console.error("Name:", err.name);
  console.error("Message:", err.message);
  console.error("===================================\n");

  if (res.headersSent) {
    return next(err);
  }

  // Multer upload validation errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const isDocumentUpload =
        req.originalUrl.includes("/api/service-requests/") ||
        req.originalUrl.includes("/api/staff/requests/");

      return res.status(413).json({
        success: false,
        code: "FILE_SIZE_LIMIT_EXCEEDED",
        message: isDocumentUpload
          ? "File size cannot exceed 10 MB."
          : "Uploaded file exceeds the allowed size limit.",
      });
    }

    return res.status(400).json({
      success: false,
      code: err.code || "INVALID_UPLOAD",
      message: "Invalid file upload.",
    });
  }

  // Custom errors raised by multer file filters or controllers.
  if (
    err.code === "INVALID_FILE_TYPE" ||
    err.message ===
      "Only JPG, PNG and WebP images are allowed."
  ) {
    return res.status(400).json({
      success: false,
      code: "INVALID_FILE_TYPE",
      message: err.message,
    });
  }

  const status =
    Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode <= 599
      ? err.statusCode
      : Number.isInteger(err.status) &&
          err.status >= 400 &&
          err.status <= 599
        ? err.status
        : 500;

  if (status !== 500) {
    return res.status(status).json({
      success: false,
      code: err.code || "REQUEST_ERROR",
      message: err.message || "Request could not be completed.",
    });
  }

  return res.status(500).json({
    success: false,
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected server error occurred.",
  });
});

/**
 * Start server after the database connection succeeds.
 */
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();