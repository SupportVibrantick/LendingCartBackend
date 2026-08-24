import type { Socket } from "socket.io";

import { healthRoutes } from "./health";
import { adminRoutes } from "./broker_admin/broker";
import { notificationRoutes } from "./broker_admin/notifications";


export function registerSocketRoutes(socket: Socket) {
    healthRoutes(socket);
    adminRoutes(socket);
    notificationRoutes(socket);
}