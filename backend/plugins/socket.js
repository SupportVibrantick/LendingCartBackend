const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const chatSocket = require("../sockets/chat.socket");
const { normalizeAuthUser } = require("../services/messagingAccess");

const jwtSecret = process.env.JWT_SECRET || "SecretKey";

async function socketPlugin(fastify) {
  const io = new Server(fastify.server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  fastify.decorate("io", io);

  console.log("✅ Socket.IO server initialized");

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

      if (!token) {
        console.log("❌ Socket Unauthorized: No token");
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, jwtSecret);
      socket.user = normalizeAuthUser(decoded);

      if (!socket.user?.id && !socket.user?.clientId && !socket.user?.email) {
        console.log("❌ Socket Unauthorized: Invalid token payload");
        return next(new Error("Unauthorized"));
      }

      next();
    } catch (err) {
      console.log("❌ Socket Unauthorized:", err.message);
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 [CONNECTED] Socket ID: ${socket.id}`);
    console.log("👤 SOCKET CONNECTED USER:", socket.user);

    socket.on("joinBrokerRoom", (brokerOrgId) => {
      const room = `broker_${brokerOrgId}`;
      socket.join(room);
      console.log(`📡 [BROKER ROOM JOIN] Socket ${socket.id} → ${room}`);
    });

    socket.on("joinLenderRoom", (lenderOrgId) => {
      const room = `lender_${lenderOrgId}`;
      socket.join(room);
      console.log(`📡 [LENDER ROOM JOIN] Socket ${socket.id} → ${room}`);
    });

    socket.on("joinPlatformRoom", (platformOrgId) => {
      const room = `platform_${platformOrgId}`;
      socket.join(room);
      console.log(`📡 [PLATFORM ROOM JOIN] Socket ${socket.id} → ${room}`);
    });

    socket.on("joinClientRoom", (clientId) => {
      const room = `client_${clientId}`;
      socket.join(room);
      console.log(`📡 [CLIENT ROOM JOIN] Socket ${socket.id} → ${room}`);
    });

    if (socket.user?.clientId) {
      const room = `client_${socket.user.clientId}`;
      socket.join(room);
      console.log(`📡 [CLIENT AUTO-JOIN] Socket ${socket.id} → ${room}`);
    }

    chatSocket(socket, io, fastify.prisma);

    socket.on("disconnect", (reason) => {
      console.log(`❌ [DISCONNECTED] Socket ${socket.id} | Reason: ${reason}`);
    });
  });
}

module.exports = socketPlugin;
