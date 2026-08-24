import jwt from "jsonwebtoken";
import type { ExtendedError, Socket } from "socket.io";

/**
 * Auth payload shape, kept loose — different portals (broker / lender /
 * loan-officer / client) encode different fields. We only assert the bits we
 * actually need; everything else stays accessible via `socket.data.user`.
 */
export interface AuthUser {
    id?: string;
    userId?: string;
    organizationId?: string;
    orgId?: string;
    orgType?: string;
    userType?: string;
    clientId?: string;
    roles?: string[] | string;
    email?: string;
    [key: string]: unknown;
}

declare module "socket.io" {
    interface SocketData {
        user?: AuthUser;
        authToken?: string;
    }
}

/**
 * Extract a bearer token from the Socket.IO handshake.
 * Priority: auth.token (preferred) > Authorization header > query.token.
 */

function extractToken(socket: Socket): string | null {
    const fromAuth = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof fromAuth === "string" && fromAuth.length > 0) return fromAuth;

    const authHeader = socket.handshake.headers["authorization"];
    if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
        return authHeader.slice(7).trim();
    }

    const fromQuery = socket.handshake.query?.token;
    if (typeof fromQuery === "string" && fromQuery.length > 0) return fromQuery;

    return null;
}

/**
 * Socket.IO middleware: runs BEFORE the `connection` event.
 * - Missing token  → refuse with code NO_TOKEN
 * - Invalid/expired → refuse with code INVALID_TOKEN
 * - Valid          → attach user payload to socket.data and proceed
 *
 * On the client side, the broker-dashboard's `appSocket.ts` should send
 * `auth: { token }` on connect.
 */
export function socketAuthMiddleware(
    socket: Socket,
    next: (err?: ExtendedError) => void,
) {
    const token = extractToken(socket);

    if (!token) {
        const err = new Error("Authentication token is required") as ExtendedError;
        err.data = { code: "NO_TOKEN" };
        next(err);
        return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        const err = new Error("Server JWT_SECRET is not configured") as ExtendedError;
        err.data = { code: "SERVER_MISCONFIG" };
        next(err);
        return;
    }

    try {
        const decoded = jwt.verify(token, secret) as AuthUser;
        socket.data.user = decoded;
        socket.data.authToken = token;
        next();
    } catch (err) {
        const reason =
            err instanceof jwt.TokenExpiredError
                ? "Token expired"
                : err instanceof jwt.JsonWebTokenError
                    ? "Invalid token"
                    : "Authentication failed";
        const wrapped = new Error(reason) as ExtendedError;
        wrapped.data = {
            code: err instanceof jwt.TokenExpiredError ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
        };
        next(wrapped);
    }
}

/**
 * Read the authenticated user from a socket inside an event handler.
 * Returns undefined if the socket wasn't authenticated (shouldn't happen
 * after the middleware runs).
 */
export function getUser(socket: Socket): AuthUser | undefined {
    return socket.data.user;
}

/**
 * Convenience guard: returns true when the user's role set contains `role`.
 */
export function hasRole(socket: Socket, role: string): boolean {
    const roles = socket.data.user?.roles;
    if (Array.isArray(roles)) return roles.includes(role);
    if (typeof roles === "string") return roles === role;
    return false;
}
