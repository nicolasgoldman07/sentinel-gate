import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { DecisionRequest } from "../types/policy.js";
import { evaluatePolicies } from "../services/policyEvaluator.js";
import { verifyTokenMiddleware } from "../middleware/verifyToken.js";

export async function decisionRoutes(app: FastifyInstance): Promise<void> {
    app.post<{ Body: DecisionRequest }>(
        "/decision",
        { preHandler: verifyTokenMiddleware },
        async (req: FastifyRequest<{ Body: DecisionRequest }>, reply: FastifyReply) => {
            const decision = await evaluatePolicies(req.body);
            return reply.send(decision);
        }
    );
}
