import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { DecisionRequest } from "../types/policy.js";
import { evaluatePolicies } from "../services/policyEvaluator.js";
import { verifyTokenMiddleware } from "../middleware/verifyToken.js";

export async function decisionRoutes(app: FastifyInstance): Promise<void> {
    app.post<{ Body: DecisionRequest }>(
        "/decision",
        { preHandler: verifyTokenMiddleware },
        async (req, reply) => {
            const decision = evaluatePolicies(req.body);
            reply.status(200).send(decision);
        }
    );
}
