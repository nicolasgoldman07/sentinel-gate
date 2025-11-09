import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { DecisionRequest } from "../types/policy.js";
import { evaluatePolicies } from "../services/policyEvaluator.js";
import { keycloakAuthMiddleware } from "../middleware/keycloakAuth.js";

export async function decisionRoutes(app: FastifyInstance): Promise<void> {
    app.post<{ Body: DecisionRequest }>(
        "/decision",
        { preHandler: keycloakAuthMiddleware },
        async (req: FastifyRequest<{ Body: DecisionRequest }>, reply: FastifyReply) => {
            const decision = await evaluatePolicies(req.body);
            return reply.send(decision);
        }
    );
}
