import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
    getAllPolicies,
    getPolicyById,
    createPolicy,
    updatePolicy,
    deletePolicy,
} from "../services/policyService.js";
import { Policy } from "../types/policy.js";
import { keycloakAuthMiddleware } from "../middleware/keycloakAuth.js";

export async function policyRoutes(app: FastifyInstance): Promise<void> {
    app.get("/policies", { preHandler: keycloakAuthMiddleware }, async (_, reply) => {
        const policies = await getAllPolicies();
        reply.send(policies);
    });

    app.get<{ Params: { id: string } }>(
        "/policies/:id",
        { preHandler: keycloakAuthMiddleware },
        async (req, reply) => {
            const policy = await getPolicyById(req.params.id);
            if (!policy) return reply.status(404).send({ error: "Policy not found" });
            reply.send(policy);
        }
    );

    app.post<{ Body: Policy }>(
        "/policies",
        { preHandler: keycloakAuthMiddleware },
        async (req, reply) => {
            const existingPolicy = await getPolicyById(req.body.id);
            if (existingPolicy) {
                return reply.status(400).send({ error: "Policy already exists" });
            }
            await createPolicy(req.body);
            reply.status(201).send(req.body);
        }
    );

    app.put<{ Params: { id: string }; Body: Policy }>(
        "/policies/:id",
        { preHandler: keycloakAuthMiddleware },
        async (req, reply) => {
            const existingPolicy = await getPolicyById(req.params.id);
            if (!existingPolicy) {
                return reply.status(404).send({ error: "Policy not found" });
            }
            await updatePolicy({ ...req.body, id: req.params.id });
            reply.send(req.body);
        }
    );

    app.delete<{ Params: { id: string } }>(
        "/policies/:id",
        { preHandler: keycloakAuthMiddleware },
        async (req, reply) => {
            const existingPolicy = await getPolicyById(req.params.id);
            if (!existingPolicy) {
                return reply.status(404).send({ error: "Policy not found" });
            }
            await deletePolicy(req.params.id);
            reply.status(204).send();
        }
    );
}
