require("dotenv").config();
const path = require("path");
const Fastify = require("fastify");
const cors = require("@fastify/cors");
const cookieParser = require("@fastify/cookie");
const fastifyStatic = require("@fastify/static");
const fastifyFormbody = require("@fastify/formbody");
const rateLimit = require("@fastify/rate-limit");
const pointOfView = require("@fastify/view");
const pug = require("pug");
const {
  adminLogs,
  userLogs,
  commonLogs,
  kafkaLogs,
} = require("./services/logger/contextLogger");
const createError = require("http-errors");
var { runEmailConsumerKafka } = require("./services/kafka/email/consumer");
const indexRoutes = require("./routes/index");
const verifySuperAdmin = require("./plugins/verifySuperAdmin");
const dbPlugin = require("./plugins/dbPlugin");
const multipart = require("@fastify/multipart");
// Configure Fastify with built-in logger
const app = Fastify({
  logger:
    process.env.NODE_ENV === "production"
      ? { level: "info" }
      : {
          level: "info",
          transport: {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          },
        },
});

// Start the Kafka consumer for sending emails
runEmailConsumerKafka().catch((error) => {
  console.error("Error starting the email consumer:", error);
});

app.register(rateLimit, {
  // Use client IP (honoring X-Forwarded-For) as the rate-limit key so the
  // limit is applied per real client, not per socket / per proxy.

  // keyGenerator: (request) => request.ip,

  keyGenerator: (request) => {
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || "unknown";
  },
});

app.register(cors, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
});

app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

app.register(cookieParser);

app.register(fastifyFormbody);

const authMiddleware = require("./middleware/authMiddleware");
app.register(dbPlugin);

const ghlService = require("./modules/ghl/ghl.service");

//  REGISTER GHL SERVICE
app.decorate("ghlService", ghlService);

app.register(authMiddleware);
app.register(verifySuperAdmin);

// Serve uploads (profile images)
app.register(fastifyStatic, {
  root: path.join(__dirname, "uploads"),
  prefix: "/uploads/",
  decorateReply: false,
});

// Serve public assets
app.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/public/",
  decorateReply: false,
});

// LOI PDFs are stored under public/broker and public/lender but referenced as /broker/... and /lender/...
app.register(fastifyStatic, {
  root: path.join(__dirname, "public", "broker"),
  prefix: "/broker/",
  decorateReply: false,
});

app.register(fastifyStatic, {
  root: path.join(__dirname, "public", "lender"),
  prefix: "/lender/",
  decorateReply: false,
});

// View engine setup (Pug)
app.register(pointOfView, {
  engine: {
    pug: pug,
  },
  templates: path.join(__dirname, "views"),
  options: {
    basedir: path.join(__dirname, "views"),
  },
});

app.setNotFoundHandler((request, reply) => {
  const err = createError(404, `Cannot ${request.method} ${request.url}`);

  commonLogs.warn("404 Not Found", {
    url: request.raw.url,
    method: request.raw.method,
    ip: request.ip,
  });

  return reply.status(404).view("error.pug", {
    message: err.message,
    error: {
      status: 404,
      stack:
        process.env.NODE_ENV === "development" ? err.stack : "Page not found",
    },
    title: "404 - Not Found",
  });
});

// Global error handler
app.setErrorHandler((error, request, reply) => {
  // Rate limit errors
  if (error.statusCode === 429 || error.status === 429) {
    commonLogs.warn("Rate limit exceeded", {
      status: 429,
      message: error.message,
      url: request.raw.url,
      method: request.raw.method,
      ip: request.ip,
    });

    return reply.code(429).send({
      success: false,
      message: error.message || "Too many requests. Please try again later.",
    });
  }

  // Handle http-errors (from createError)
  if (error.status) {
    commonLogs.warn("Client error", {
      status: error.status,
      message: error.message,
      url: request.raw.url,
      method: request.raw.method,
    });

    return reply.status(error.status).view("error.pug", {
      message: error.message || "Error",
      error: {
        status: error.status,
        stack:
          process.env.NODE_ENV === "development"
            ? error.stack
            : "An error occurred",
      },
      title: `${error.status} - Error`,
    });
  }

  // Handle Fastify validation errors
  if (error.validation) {
    commonLogs.warn("Validation error", {
      validation: error.validation,
      url: request.raw.url,
      method: request.raw.method,
    });

    return reply.status(400).view("error.pug", {
      message: "Validation Error",
      error: {
        status: 400,
        stack: JSON.stringify(error.validation, null, 2),
      },
      title: "400 - Validation Error",
    });
  }

  // Handle server errors
  commonLogs.error("Server error", {
    error: error.message,
    stack: error.stack,
    url: request.raw.url,
    method: request.raw.method,
  });

  return reply.status(error.statusCode || 500).view("error.pug", {
    message: error.message || "Internal Server Error",
    error: {
      status: error.statusCode || 500,
      stack:
        process.env.NODE_ENV === "development"
          ? error.stack
          : "An internal server error occurred",
    },
    title: `${error.statusCode || 500} - Error`,
  });
});

// Register main route files only
app.register(indexRoutes, { prefix: "/" });

module.exports = app;
