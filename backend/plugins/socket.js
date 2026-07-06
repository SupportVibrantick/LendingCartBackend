const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const registerChatGateway = require("../sockets/chat.gateway");
const { normalizeAuthUser } = require("../services/messagingAccess");
const { getJwtSecret, getSocketCorsOrigins } = require("../config/env");
const { attachRedisAdapter } = require("../config/redis");
const { commonLogs } = require("../services/logger/contextLogger");

const jwtSecret = getJwtSecret();

function ackSuccess(ack, data) {
  if (typeof ack === "function") {
    ack({ success: true, data });
  }
}

function denyRoomJoin(socket, message, ack) {
  socket.emit("socketError", { message });
  if (typeof ack === "function") {
    ack({ success: false, error: { message, code: "FORBIDDEN" } });
  }
}

function joinAuthorizedRooms(socket) {
  const user = socket.user;
  const orgId = user.organizationId || user.orgId;

  if (user.clientId) {
    socket.join(`client_${user.clientId}`);
    commonLogs.info("Socket auto-joined client room", {
      socketId: socket.id,
      clientId: user.clientId,
    });
  }

  if (!orgId) {
    return;
  }

  if (user.orgType === "BROKER") {
    socket.join(`broker_${orgId}`);
    commonLogs.info("Socket auto-joined broker room", {
      socketId: socket.id,
      brokerOrgId: orgId,
    });
  }

  if (user.orgType === "LENDER") {
    socket.join(`lender_${orgId}`);
    commonLogs.info("Socket auto-joined lender room", {
      socketId: socket.id,
      lenderOrgId: orgId,
    });
  }

  if (user.orgType === "PLATFORM") {
    socket.join(`platform_${orgId}`);
    commonLogs.info("Socket auto-joined platform room", {
      socketId: socket.id,
      platformOrgId: orgId,
    });
  }
}

async function socketPlugin(fastify) {
  const io = new Server(fastify.server, {
    cors: {
      origin: getSocketCorsOrigins(),
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  await attachRedisAdapter(io);

  fastify.decorate("io", io);

  fastify.addHook("onClose", async () => {
    const { shutdownRedisAdapter } = require("../config/redis");
    io.close();
    await shutdownRedisAdapter();
  });

  commonLogs.info("Socket.IO server initialized");

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, jwtSecret);
      socket.user = normalizeAuthUser(decoded);

      if (!socket.user?.id && !socket.user?.clientId && !socket.user?.email) {
        return next(new Error("Unauthorized"));
      }

      next();
    } catch (err) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    commonLogs.info("Socket connected", {
      socketId: socket.id,
      userId: socket.user?.id || socket.user?.clientId,
      orgType: socket.user?.orgType,
    });

    joinAuthorizedRooms(socket);

    socket.on("joinBrokerRoom", (_payload, ack) => {
      if (socket.user.orgType !== "BROKER") {
        return denyRoomJoin(socket, "Forbidden broker room join", ack);
      }

      const orgId = socket.user.organizationId || socket.user.orgId;
      if (!orgId) {
        return denyRoomJoin(socket, "Missing broker organization", ack);
      }

      socket.join(`broker_${orgId}`);
      ackSuccess(ack, { room: `broker_${orgId}` });
    });

    socket.on("joinLenderRoom", (_payload, ack) => {
      if (socket.user.orgType !== "LENDER") {
        return denyRoomJoin(socket, "Forbidden lender room join", ack);
      }

      const orgId = socket.user.organizationId || socket.user.orgId;
      if (!orgId) {
        return denyRoomJoin(socket, "Missing lender organization", ack);
      }

      socket.join(`lender_${orgId}`);
      ackSuccess(ack, { room: `lender_${orgId}` });
    });

    socket.on("joinPlatformRoom", (_payload, ack) => {
      if (socket.user.orgType !== "PLATFORM") {
        return denyRoomJoin(socket, "Forbidden platform room join", ack);
      }

      const orgId = socket.user.organizationId || socket.user.orgId;
      if (!orgId) {
        return denyRoomJoin(socket, "Missing platform organization", ack);
      }

      socket.join(`platform_${orgId}`);
      ackSuccess(ack, { room: `platform_${orgId}` });
    });

    socket.on("joinClientRoom", (_payload, ack) => {
      if (!socket.user.clientId) {
        return denyRoomJoin(socket, "Forbidden client room join", ack);
      }

      socket.join(`client_${socket.user.clientId}`);
      ackSuccess(ack, { room: `client_${socket.user.clientId}` });
    });

    registerChatGateway(socket, io, fastify.prisma);

    socket.on("disconnect", (reason) => {
      commonLogs.info("Socket disconnected", {
        socketId: socket.id,
        reason,
      });
    });
  });
}

module.exports = socketPlugin;
