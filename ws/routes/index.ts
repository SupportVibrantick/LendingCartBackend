import type { Socket } from "socket.io";
import { hasRole } from "../middleware/ auth";

export function adminRoutes(socket: Socket) {
    socket.on("admin:ping", (_payload, ack) => {
        if (!hasRole(socket, "BROKER_ADMIN")) {
            return ack({
                success: false,
                error: {
                    code: "FORBIDDEN",
                    message: "Admin role required",
                },
            });
        }

        ack({
            success: true,
            data: {
                admin: true,
            },
        });
    });
}