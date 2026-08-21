import { Server } from "socket.io";
import { createServer } from "node:http";
import { socketAuthMiddleware, getUser, hasRole } from "./middleware/ auth.js";


const PORT = Number(process.env.WS_PORT ?? 3001);
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") ?? "*",
    credentials: true,
  },
});
io.use(socketAuthMiddleware);

// JWT auth — runs before every connection is accepted.
// Rejects missing/invalid tokens; attaches `socket.data.user` on success.

io.on("connection", (socket) => {
  const user = getUser(socket);
  console.log(`connected ${JSON.stringify(user)}`);

  socket.on("ping", (cb) => {
    if (typeof cb === "function") {
      cb({ pong: true, ts: Date.now(), userId: user?.userId ?? user?.id ?? null });
    }
  });

  socket.on("health:check", async (_payload, ack) => {
    try {
      const orgCount = await prisma.organization.count();
      if (typeof ack === "function") {
        ack({
          success: true,
          data: {
            status: "ok",
            orgCount,
            user: { id: user?.userId ?? user?.id ?? null, orgType: user?.orgType ?? null },
          },
        });
      }
    } catch (err) {
      console.error("[ws] health:check failed", err);
      if (typeof ack === "function") {
        ack({ success: false, error: { message: (err as Error).message, code: "DB_ERROR" } });
      }
    }
  });

  // Example protected event — only BROKER_ADMIN users may invoke.
  socket.on("admin:ping", (cb) => {
    if (!hasRole(socket, "BROKER_ADMIN")) {
      if (typeof cb === "function") {
        cb({ success: false, error: { message: "Forbidden", code: "FORBIDDEN" } });
      }
      return;
    }
    if (typeof cb === "function") {
      cb({ success: true, data: { admin: true, userId: user?.userId ?? user?.id } });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[ws] disconnected: ${socket.id} (${reason})`);
  });
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`[ws] received ${signal}, shutting down...`);
  io.close(async () => {
    await prisma.$disconnect();
    httpServer.close(() => process.exit(0));
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

httpServer.listen(PORT, () => {
  console.log(`[ws] Socket.IO server listening on port ${PORT}`);
});

export { io, httpServer };
