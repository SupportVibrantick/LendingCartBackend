import { Server } from "socket.io";
import { createServer } from "node:http";
import { socketAuthMiddleware, getUser, hasRole } from "./middleware/ auth.js";
import { registerSocketRoutes } from "./routes/index.js";
import { prisma } from "./lib/prisma.js";


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
  // console.log(`connected ${JSON.stringify(user)}`);
  registerSocketRoutes(socket);

  socket.on("disconnect", (reason) => {
    console.log(`disconnected: ${socket.id} (${reason})`);
  });
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`received ${signal}, shutting down...`);
  io.close(async () => {
    await prisma.$disconnect();
    httpServer.close(() => process.exit(0));
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

httpServer.listen(PORT, () => {
  console.log(`Socket server listening on port ${PORT}`);
});

export { io, httpServer };