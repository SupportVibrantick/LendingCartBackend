const { Server } = require("socket.io");

async function socketPlugin(fastify) {

  const io = new Server(fastify.server, {
    cors: {
      origin: "*"
    }
  });

  fastify.decorate("io", io);

  console.log("✅ Socket.IO server initialized");

  io.on("connection", (socket) => {

    console.log("🔌 Socket connected:", socket.id);

    socket.on("joinBrokerRoom", (brokerOrgId) => {

      const room = `broker_${brokerOrgId}`;

      socket.join(room);

      console.log(`📡 Socket ${socket.id} joined room ${room}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id} | ${reason}`);
    });

  });

}

module.exports = socketPlugin;