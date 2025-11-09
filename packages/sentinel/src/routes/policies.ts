import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { loadPolicies, savePolicies } from "../services/policyStore.js";
import { Policy } from "../types/policy.js";
import { verifyTokenMiddleware } from "../middleware/verifyToken.js";

export async function policyRoutes(app: FastifyInstance): Promise<void> {
    // List all
    app.get("/policies", { preHandler: verifyTokenMiddleware }, async (_, reply) => {
        const policies = await loadPolicies();
        reply.send(policies);
    });

    // Get one
    app.get<{ Params: { id: string } }>(
        "/policies/:id",
        { preHandler: verifyTokenMiddleware },
        async (req, reply) => {
            const policies = await loadPolicies();
            const policy = policies.find((p) => p.id === req.params.id);
            if (!policy) return reply.status(404).send({ error: "Policy not found" });
            reply.send(policy);
        }
    );

    // Create
    app.post<{ Body: Policy }>(
        "/policies",
        { preHandler: verifyTokenMiddleware },
        async (req, reply) => {
            const policies = await loadPolicies();
            if (policies.some((p) => p.id === req.body.id)) {
                return reply.status(400).send({ error: "Policy already exists" });
            }
            policies.push(req.body);
            await savePolicies(policies);
            reply.status(201).send(req.body);
        }
    );

    // Update
    app.put<{ Params: { id: string }; Body: Policy }>(
        "/policies/:id",
        { preHandler: verifyTokenMiddleware },
        async (req, reply) => {
            const policies = await loadPolicies();
            const index = policies.findIndex((p) => p.id === req.params.id);
            if (index === -1) return reply.status(404).send({ error: "Policy not found" });
            policies[index] = req.body;
            await savePolicies(policies);
            reply.send(req.body);
        }
    );

    // Delete
    app.delete<{ Params: { id: string } }>(
        "/policies/:id",
        { preHandler: verifyTokenMiddleware },
        async (req, reply) => {
            let policies = await loadPolicies();
            const before = policies.length;
            policies = policies.filter((p) => p.id !== req.params.id);
            if (policies.length === before) {
                return reply.status(404).send({ error: "Policy not found" });
            }
            await savePolicies(policies);
            reply.status(204).send();
        }
    );
}
