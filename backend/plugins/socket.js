const { Server } = require("socket.io");
const chatSocket = require("../sockets/chat.socket");

async function socketPlugin(fastify) {

  const io = new Server(fastify.server, {
    cors: {
      origin: "*"
    }
  });

  fastify.decorate("io", io);

  console.log("✅ Socket.IO server initialized");

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
       CHAT SOCKET (ADDED SAFELY)
    =============================== */
    chatSocket(socket, io, fastify.prisma);

    /* ===============================
       DISCONNECT
    =============================== */
    socket.on("disconnect", (reason) => {
      console.log(`❌ [DISCONNECTED] Socket ${socket.id} | Reason: ${reason}`);
    });

  });

}

module.exports = socketPlugin;