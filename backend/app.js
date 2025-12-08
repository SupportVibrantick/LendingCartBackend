require("dotenv").config();
const path = require("path");
const Fastify = require("fastify");
const cors = require("@fastify/cors");
const cookieParser = require("@fastify/cookie");
const fastifyStatic = require("@fastify/static");
const fastifyFormbody = require("@fastify/formbody");
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
const swagger = require("@fastify/swagger");
const swaggerUi = require("@fastify/swagger-ui");
const indexRoutes = require("./routes/index");
const verifySuperAdmin = require("./plugins/verifySuperAdmin");

// Configure Fastify with built-in logger
const app = Fastify({
  logger: {
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



app.register(cors, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
});


// Swagger Setup
app.register(swagger, {
  mode: "dynamic",
  openapi: {
    openapi: "3.0.0",
    info: {
      title: "Lendingcart Documentation",
      version: "1.0.0",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
});


app.register(swaggerUi, {
  routePrefix: "/api",
  uiConfig: {
    docExpansion: "none",
    deepLinking: true,
    persistAuthorization: true,
  },
});

app.register(cookieParser);

app.register(fastifyFormbody);


const authMiddleware = require("./middleware/authMiddleware");
const fgaMiddleware = require("./middleware/fgaMiddleware");
const Mail = require("nodemailer/lib/mailer");

app.register(authMiddleware);
app.register(fgaMiddleware);
app.register(verifySuperAdmin);  


app.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/public/", // optional: default '/'
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


app.ready(() => {
  console.log("\nRegistered Routes:");
  console.log(app.printRoutes());
});


module.exports = app;
