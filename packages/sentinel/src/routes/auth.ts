import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { keycloakAuthMiddleware } from "../middleware/keycloakAuth.js";
import { keycloakConfig } from "../config/keycloak.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
    // Health check for Keycloak integration
    app.get("/auth/info", async (_, reply: FastifyReply) => {
        reply.send({
            keycloakUrl: keycloakConfig.serverUrl,
            realm: keycloakConfig.realm,
            tokenEndpoint: `${keycloakConfig.serverUrl}/realms/${keycloakConfig.realm}/protocol/openid-connect/token`,
            authEndpoint: `${keycloakConfig.serverUrl}/realms/${keycloakConfig.realm}/protocol/openid-connect/auth`,
        });
    });

    // Verify token endpoint (protected by Keycloak middleware)
    app.get(
        "/auth/verify",
        { preHandler: keycloakAuthMiddleware },
        async (req: FastifyRequest, reply: FastifyReply) => {
            reply.send({ valid: true, user: (req as any).user });
        }
    );
}
