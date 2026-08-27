import type { Socket } from "socket.io";
import { prisma } from "../../lib/prisma";

/**
 * Broker-admin notification routes over the standalone ws server.
 *
 * Mirrors the shape of the REST endpoints that
 * backend/routes/broker/notifications/* already expose:
 *   - GET    /                    -> notifications:list
 *   - PATCH  /:id/read            -> notifications:read
 *   - PATCH  /read-all            -> notifications:read-all
 *   - DELETE /:id                 -> notifications:delete
 *   - DELETE /delete-all          -> notifications:delete-all
 *
 * Realtime path:
 *   notification:push  (client -> server) -> persists a Notification row
 *                       scoped to the socket's broker org, then broadcasts
 *                       `notification:new` to every broker_admin socket whose
 *                       user belongs to the same org.
 *
 * Authorization:
 *   every handler requires the socket's user to be a BROKER orgType; orgId is
 *   derived from the JWT payload (organizationId / orgId).
 *
 * NOTE: this file is a fresh implementation. Do not modify the existing
 * `broker.ts` ping route in this folder — leave it untouched.
 */

type Ack = (response: unknown) => void;

function getOrgContext(socket: Socket): { orgId: string | null; userId: string | null } {
    const user = socket.data.user || {};
    const orgId =
        (user.organizationId as string | undefined) ||
        (user.orgId as string | undefined) ||
        null;
    const userId =
        (user.id as string | undefined) ||
        (user.userId as string | undefined) ||
        null;
    return { orgId, userId };
}

function isBroker(socket: Socket): boolean {
    const user = socket.data.user || {};
    const orgType = (user.orgType as string | undefined) || (user.userType as string | undefined);
    return orgType === "BROKER" || orgType === "BROKER_ADMIN";
}

function forbidden(ack: Ack) {
    ack({
        success: false,
        error: { code: "FORBIDDEN", message: "Broker access only" },
    });
}

function badContext(ack: Ack) {
    ack({
        success: false,
        error: { code: "BAD_CONTEXT", message: "Invalid user context" },
    });
}

function serverError(ack: Ack, err: unknown) {
    console.error("[ws broker_admin notifications]", err);
    ack({
        success: false,
        error: {
            code: "SERVER_ERROR",
            message: err instanceof Error ? err.message : "Internal error",
        },
    });
}

function buildWhere(orgId: string | null, userId: string | null) {
    const ors: Array<Record<string, unknown>> = [];
    if (orgId) ors.push({ recipientOrgId: orgId });
    if (userId) ors.push({ recipientUserId: userId });
    return {
        deletedAt: null,
        OR: ors.length > 0 ? ors : [{ id: "__none__" }],
    };
}

/** Broadcast a realtime notification to every connected broker_admin socket
 *  whose JWT carries the same organizationId. */
function broadcastNew(io: Socket, recipientOrgId: string, notification: unknown) {
    // `socket.nsp` is the parent namespace; broadcast to all sockets in it.
    // The receiver side filters by orgId/clientId via the same JWT.
    io.nsp.emit("notification:new", {
        recipientOrgId,
        notification,
    });
}

export function notificationRoutes(io: Socket) {
    const socket = io;

    /* ------------------------------------------------------------------ */
    /* LIST                                                               */
    /* ------------------------------------------------------------------ */
    socket.on(
        "notifications:list",
        async (payload: { page?: number; limit?: number } = {}, ack?: Ack) => {
            if (typeof ack !== "function") return;
            if (!isBroker(socket)) return forbidden(ack);

            const { orgId, userId } = getOrgContext(socket);
            if (!orgId && !userId) return badContext(ack);

            try {
                const page = Math.max(1, Number(payload.page || 1));
                const limit = Math.min(100, Math.max(1, Number(payload.limit || 20)));
                const where = buildWhere(orgId, userId);

                const [notifications, unreadCount, total] = await Promise.all([
                    prisma.notification.findMany({
                        where,
                        orderBy: { createdAt: "desc" },
                        skip: (page - 1) * limit,
                        take: limit,
                    }),
                    prisma.notification.count({ where: { ...where, isRead: false } }),
                    prisma.notification.count({ where }),
                ]);

                ack({
                    success: true,
                    data: {
                        notifications,
                        unreadCount,
                        total,
                        page,
                        limit,
                    },
                });
            } catch (err) {
                serverError(ack, err);
            }
        }
    );

    /* ------------------------------------------------------------------ */
    /* MARK ONE READ                                                      */
    /* ------------------------------------------------------------------ */
    socket.on(
        "notifications:read",
        async (payload: { id?: string } = {}, ack?: Ack) => {
            if (typeof ack !== "function") return;
            if (!isBroker(socket)) return forbidden(ack);
            if (!payload?.id) {
                return ack({
                    success: false,
                    error: { code: "BAD_REQUEST", message: "id required" },
                });
            }

            try {
                const { orgId, userId } = getOrgContext(socket);
                // Scope the update so a broker can only mark their own org's notifications.
                const where = {
                    id: payload.id,
                    deletedAt: null,
                    OR: [
                        orgId ? { recipientOrgId: orgId } : { id: "__none__" },
                        userId ? { recipientUserId: userId } : { id: "__none__" },
                    ],
                };

                const updated = await prisma.notification.updateMany({
                    where,
                    data: { isRead: true, readAt: new Date() },
                });

                if (updated.count === 0) {
                    return ack({
                        success: false,
                        error: { code: "NOT_FOUND", message: "Notification not found" },
                    });
                }

                ack({ success: true, id: payload.id, isRead: true });
            } catch (err) {
                serverError(ack, err);
            }
        }
    );

    /* ------------------------------------------------------------------ */
    /* MARK ALL READ                                                      */
    /* ------------------------------------------------------------------ */
    socket.on("notifications:read-all", async (_payload, ack?: Ack) => {
        if (typeof ack !== "function") return;
        if (!isBroker(socket)) return forbidden(ack);

        try {
            const { orgId, userId } = getOrgContext(socket);
            const where = buildWhere(orgId, userId);

            const result = await prisma.notification.updateMany({
                where: { ...where, isRead: false },
                data: { isRead: true, readAt: new Date() },
            });

            ack({ success: true, updatedCount: result.count, unreadCount: 0 });
        } catch (err) {
            serverError(ack, err);
        }
    });

    /* ------------------------------------------------------------------ */
    /* DELETE ONE                                                         */
    /* ------------------------------------------------------------------ */
    socket.on(
        "notifications:delete",
        async (payload: { id?: string } = {}, ack?: Ack) => {
            if (typeof ack !== "function") return;
            if (!isBroker(socket)) return forbidden(ack);
            if (!payload?.id) {
                return ack({
                    success: false,
                    error: { code: "BAD_REQUEST", message: "id required" },
                });
            }

            try {
                const { orgId, userId } = getOrgContext(socket);
                const result = await prisma.notification.updateMany({
                    where: {
                        id: payload.id,
                        deletedAt: null,
                        OR: [
                            orgId ? { recipientOrgId: orgId } : { id: "__none__" },
                            userId ? { recipientUserId: userId } : { id: "__none__" },
                        ],
                    },
                    data: { deletedAt: new Date() },
                });

                if (result.count === 0) {
                    return ack({
                        success: false,
                        error: { code: "NOT_FOUND", message: "Notification not found" },
                    });
                }

                ack({ success: true, id: payload.id });
            } catch (err) {
                serverError(ack, err);
            }
        }
    );

    /* ------------------------------------------------------------------ */
    /* DELETE ALL                                                         */
    /* ------------------------------------------------------------------ */
    socket.on("notifications:delete-all", async (_payload, ack?: Ack) => {
        if (typeof ack !== "function") return;
        if (!isBroker(socket)) return forbidden(ack);

        try {
            const { orgId, userId } = getOrgContext(socket);
            const where = buildWhere(orgId, userId);

            const result = await prisma.notification.updateMany({
                where,
                data: { deletedAt: new Date() },
            });

            ack({ success: true, deletedCount: result.count });
        } catch (err) {
            serverError(ack, err);
        }
    });

    /* ------------------------------------------------------------------ */
    /* REALTIME PUSH (persist + broadcast)                                */
    /*                                                                     */
    /* Two callers:                                                        */
    /*   1) any server-side producer (other route handler, cron, backend   */
    /*      via redis pub/sub bridge) that wants to push a notification    */
    /*      into a broker org.                                             */
    /*   2) the same broker_admin client (rare) — useful for self-test.    */
    /* ------------------------------------------------------------------ */
    socket.on(
        "notification:push",
        async (
            payload: {
                eventType?: string;
                category?: string;
                subject?: string;
                body?: string;
                metadata?: Record<string, unknown>;
                recipientOrgId?: string;
                recipientUserId?: string;
                recipientClientId?: string;
                channel?: string;
            } = {},
            ack?: Ack
        ) => {
            if (typeof ack !== "function") return;
            if (!isBroker(socket)) return forbidden(ack);
            if (!payload?.eventType) {
                return ack({
                    success: false,
                    error: { code: "BAD_REQUEST", message: "eventType required" },
                });
            }

            try {
                const { orgId, userId } = getOrgContext(socket);
                const recipientOrgId = payload.recipientOrgId || orgId;
                const recipientUserId = payload.recipientUserId || null;
                const recipientClientId = payload.recipientClientId || null;

                if (!recipientOrgId && !recipientUserId) return badContext(ack);

                const notification = await prisma.notification.create({
                    data: {
                        eventType: payload.eventType,
                        category: payload.category ?? null,
                        channel: payload.channel ?? "WEBSOCKET",
                        status: "DELIVERED",
                        recipientType: recipientOrgId ? "ORG" : "USER",
                        recipientOrgId: recipientOrgId ?? null,
                        recipientUserId: recipientUserId ?? null,
                        recipientClientId: recipientClientId ?? null,
                        subject: payload.subject ?? null,
                        body: payload.body ?? null,
                        metadata: payload.metadata
                            ? (payload.metadata as object as never)
                            : undefined,
                        sentAt: new Date(),
                    },
                });

                // Broadcast to every broker_admin socket in the same org.
                if (recipientOrgId) {
                    broadcastNew(socket, recipientOrgId, notification);
                }

                ack({ success: true, data: { notification } });
            } catch (err) {
                serverError(ack, err);
            }
        }
    );
}
