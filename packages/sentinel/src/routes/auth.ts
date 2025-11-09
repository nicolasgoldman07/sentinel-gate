import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { signToken } from "../utils/jwt.js";
import { verifyTokenMiddleware } from "../middleware/verifyToken.js";

interface LoginBody { username: string; password: string; }

export async function authRoutes(app: FastifyInstance): Promise<void> {
    app.post(
        "/auth/login",
        async (req: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
            const { username, password } = req.body;

            if (!username || !password) {
                reply.status(400).send({ error: "Missing credentials" });
                return;
            }

            const payload = {
                sub: username,
                role: username === "admin" ? "admin" : "user",
            };

            const token = signToken(payload);
            reply.send({ token });
        }
    );

    app.get(
        "/auth/verify",
        { preHandler: verifyTokenMiddleware },
        async (req: FastifyRequest, reply: FastifyReply) => {
            reply.send({ valid: true, user: (req as any).user });
        }
    );
}
