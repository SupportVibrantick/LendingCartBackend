import type { Socket } from "socket.io";
import { prisma } from "../lib/prisma";

export function healthRoutes(socket: Socket) {
    socket.on("health:check", async (_payload, ack) => {
        try {
            const orgCount = await prisma.organization.count();

            ack({
                success: true,
                data: {
                    status: "ok",
                    orgCount,
                    user: {
                        id:
                            socket.data.user?.userId ??
                            socket.data.user?.id ??
                            null,
                        orgType: socket.data.user?.orgType ?? null,
                    },
                },
            });
        } catch (err) {
            console.error("health:check failed", err);

            ack({
                success: false,
                error: {
                    message: (err as Error).message,
                    code: "DB_ERROR",
                },
            });
        }
    });
}