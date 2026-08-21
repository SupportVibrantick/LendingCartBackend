import type { Socket } from "socket.io";

import { healthRoutes } from "./health";
import { adminRoutes } from "./broker_admin/broker";


export function registerSocketRoutes(socket: Socket) {
    healthRoutes(socket);
    adminRoutes(socket);
}