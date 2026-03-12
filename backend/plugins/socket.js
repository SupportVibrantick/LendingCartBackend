const { Server } = require("socket.io");

async function socketPlugin(fastify) {

  const io = new Server(fastify.server, {
    cors: {
      origin: "*"
    }
  });

  fastify.decorate("io", io);

  io.on("connection", (socket) => {

    console.log("Socket connected:", socket.id);

    socket.on("joinBrokerRoom", (brokerOrgId) => {
      socket.join(`broker_${brokerOrgId}`);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

  });

}

module.exports = socketPlugin;