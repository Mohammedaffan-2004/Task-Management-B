require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const morgan = require("morgan");
const http = require("http");

const connectDB = require("./config/db");
const setupSocket = require("./socket");
const errorHandler = require("./middleware/errorMiddleware");

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const activityRoutes = require("./routes/activityRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();
const server = http.createServer(app);

// ✨ REQUIRED for secure cookies on Render (behind proxy)
app.set("trust proxy", 1);

// DB connection
connectDB();

// Socket
let io;
try {
  io = setupSocket(server);
  app.set("io", io);
  console.log("⚡ Socket.io initialized successfully");
} catch (err) {
  console.error("⚠️ Socket.io initialization failed:", err.message);
}

// Allowed origins (from env or fallback)
const allowedOrigins = (process.env.CORS_ORIGIN ||
  "http://localhost:5173,https://task-management-a-five.vercel.app"
)
  .split(",")
  .map(origin => origin.trim());

// CORS FIX (cross-site cookies)
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow server-to-server
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS blocked: " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

// Body, cookies, security
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: "Too many requests, please try again later.",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts, please try again after 15 minutes.",
  skipSuccessfulRequests: true,
});

app.use(generalLimiter);

// Health & base
app.get("/", (req, res) => {
  res.json({ message: "🚀 TaskFlow Backend API is running!" });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
  });
});

// Routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/analytics", analyticsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

// Error middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`\n=====================================`);
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  console.log(`📡 Allowed CORS Origins: ${allowedOrigins.join(", ")}`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  console.log(`=====================================\n`);
});

// Graceful shutdown
process.on("unhandledRejection", (err) => {
  console.error(`💥 Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

process.on("SIGTERM", () => {
  console.log("🧹 SIGTERM received. Closing server gracefully...");
  server.close(() => {
    console.log("✅ Server closed. Bye!");
  });
});
