import { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "../utils/jwt.js";

export async function verifyTokenMiddleware(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        reply.status(401).send({ error: "Missing or invalid token" });
        return;
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded) {
        reply.status(401).send({ error: "Invalid or expired token" });
        return;
    }

    (req as any).user = decoded;
}
