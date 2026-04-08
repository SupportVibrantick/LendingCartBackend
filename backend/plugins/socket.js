const { Server } = require("socket.io");
const jwt = require("jsonwebtoken"); //  added
const chatSocket = require("../sockets/chat.socket");

async function socketPlugin(fastify) {
  const io = new Server(fastify.server, {
    cors: {
      origin: "*",
    },
  });

  fastify.decorate("io", io);

  console.log("✅ Socket.IO server initialized");

  /* ===============================
     🔐 SOCKET AUTH MIDDLEWARE (ADDED)
  =============================== */
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        console.log("❌ Socket Unauthorized: No token");
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      socket.user = decoded; //  attach user safely

      next();
    } catch (err) {
      console.log("❌ Socket Unauthorized: Invalid token");
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 [CONNECTED] Socket ID: ${socket.id}`);

    /* ===============================
       EXISTING (DO NOT TOUCH)
    =============================== */
    socket.on("joinBrokerRoom", (brokerOrgId) => {
      const room = `broker_${brokerOrgId}`;
      socket.join(room);

      console.log(`📡 [BROKER ROOM JOIN] Socket ${socket.id} → ${room}`);
    });

    /* ===============================
       CHAT SOCKET (UNCHANGED)
    =============================== */
    chatSocket(socket, io, fastify.prisma);

    /* ===============================
       DISCONNECT
    =============================== */
    socket.on("disconnect", (reason) => {
      console.log(
        `❌ [DISCONNECTED] Socket ${socket.id} | Reason: ${reason}`
      );
    });
  });
}

module.exports = socketPlugin;