require("dotenv").config();
const path = require("path");
const Fastify = require("fastify");
const cors = require("@fastify/cors");
const helmet = require("@fastify/helmet");
const cookieParser = require("@fastify/cookie");
const fastifyStatic = require("@fastify/static");
const fastifyFormbody = require("@fastify/formbody");
const rateLimit = require("@fastify/rate-limit");
const { getClientIp } = require("./utils/security/rateLimit");
const { getSharedRedisClient } = require("./config/redis");
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
const { getUploadMaxBytes } = require("./config/env");
// Configure Fastify with built-in logger
const app = Fastify({
  // Trust X-Forwarded-* headers so request.ip reflects the real client IP
  // behind reverse proxies / load balancers (otherwise rate limiting keys
  // every request to the proxy's IP and is effectively disabled).
  trustProxy: true,
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

app.register(helmet);

// app.register(async (instance) => {
//   const redisClient = await getSharedRedisClient();
//   instance.register(rateLimit, {
    // Don't auto-limit every route — only routes that set config.rateLimit
    // global: false,
    // redis: redisClient,
    // Use the same IP extraction as the custom checkRateLimit helper so
    // proxy headers (x-forwarded-for, x-real-ip, cf-connecting-ip) are
    // honored even when trustProxy behavior differs from request.ip.
//     keyGenerator: (request) => getClientIp(request),
//   });
// }, { name: 'rate-limit-plugin' });

// app.register(cors, {
//   origin: (origin, cb) => {
//     const allowedOrigins = process.env.CORS_ORIGINS
//       ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
//       : [];

//     if (!origin || allowedOrigins.includes(origin)) {
//       cb(null, true);
//     } else {
//       cb(new Error(`The CORS origin ${origin} is not allowed`), false);
//     }
//   },
//   methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//   credentials: true,
// });

app.register(cors, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
});

app.addHook("onRequest", async (request) => {
  console.log("DEBUG request.ip:", request.ip);
  console.log("DEBUG x-forwarded-for:", request.headers["x-forwarded-for"]);
  console.log("DEBUG x-real-ip:", request.headers["x-real-ip"]);
  console.log("DEBUG cf-connecting-ip:", request.headers["cf-connecting-ip"]);
});

app.register(multipart, {
  limits: {
    fileSize: getUploadMaxBytes(),
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

    // Determine if we should return JSON or HTML
    const isApiRequest =
      request.url.startsWith("/api") ||
      request.headers["accept"]?.includes("application/json") ||
      request.url.includes("/auth") ||
      request.url.includes("/login");

    if (isApiRequest) {
      const statusCode = error.statusCode || error.status || 500;
      const isProduction = process.env.NODE_ENV === "production";

      const response = {
        success: false,
        message:
          statusCode === 500 && isProduction
            ? "An internal server error occurred"
            : error.message || "Internal Server Error",
      };

      if (!isProduction && error.stack) {
        response.stack = error.stack;
      }

      return reply.status(statusCode).send(response);
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
    message: error.statusCode === 500 && process.env.NODE_ENV === "production"
      ? "An internal server error occurred"
      : error.message || "Internal Server Error",
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
