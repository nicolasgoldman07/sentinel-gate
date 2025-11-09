import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from "fastify";
import { SentinelClient } from "../client.js";
import type { DecisionRequest } from "../types.js";

export interface SentinelFastifyOptions {
    sentinelUrl?: string;
    /**
     * Function to extract the token from the request.
     * Default: extracts from Authorization header (Bearer token)
     */
    getToken?: (req: FastifyRequest) => string | undefined;
    /**
     * Function to build the subject from the request.
     * This should extract user info from req.user or decoded token.
     */
    getSubject?: (req: FastifyRequest) => Record<string, any>;
    /**
     * What to do when authorization fails.
     * 'block' (default): returns 403 Forbidden
     * 'continue': continues to next handler (useful for optional auth)
     */
    onUnauthorized?: "block" | "continue";
}

/**
 * Extends Fastify Request with Sentinel authorization helper
 */
export interface SentinelFastifyRequest extends FastifyRequest {
    sentinel: {
        authorize: (
            action: string,
            resource: Record<string, any>,
            context?: Record<string, any>
        ) => Promise<{ allow: boolean; reason: string; matchedPolicyId?: string }>;
    };
}

/**
 * Fastify plugin that adds Sentinel authorization capabilities to requests.
 * 
 * Usage:
 * ```typescript
 * import { sentinelPlugin } from '@sentinel/sdk/middleware/fastify';
 * 
 * await fastify.register(sentinelPlugin, {
 *   sentinelUrl: 'http://localhost:3000'
 * });
 * 
 * fastify.put('/padron/:id', async (request: SentinelFastifyRequest, reply) => {
 *   const decision = await request.sentinel.authorize('padron:edit', {
 *     type: 'padron',
 *     id: request.params.id
 *   }, { app: 'unlp' });
 *   
 *   if (!decision.allow) {
 *     return reply.code(403).send({ error: decision.reason });
 *   }
 *   // ... continue with route logic
 * });
 * ```
 */
export async function sentinelPlugin(
    fastify: any,
    options: SentinelFastifyOptions = {}
) {
    const client = new SentinelClient({ baseUrl: options.sentinelUrl });

    const getToken =
        options.getToken ||
        ((req: FastifyRequest) => {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith("Bearer ")) {
                return authHeader.substring(7);
            }
            return undefined;
        });

    const getSubject =
        options.getSubject ||
        ((req: FastifyRequest) => {
            // Assuming req.user is populated by a previous auth plugin
            return (req as any).user || {};
        });

    const onUnauthorized = options.onUnauthorized || "block";

    // Decorate request with sentinel helper
    fastify.decorateRequest("sentinel", null);

    fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
        const token = getToken(request);

        (request as SentinelFastifyRequest).sentinel = {
            authorize: async (
                action: string,
                resource: Record<string, any>,
                context?: Record<string, any>
            ) => {
                const subject = getSubject(request);

                const decisionRequest: DecisionRequest = {
                    subject,
                    action,
                    resource,
                    context,
                };

                try {
                    const clientWithToken = new SentinelClient({
                        baseUrl: options.sentinelUrl,
                        token,
                    });
                    return await clientWithToken.authorize(decisionRequest);
                } catch (error) {
                    fastify.log.error("Sentinel authorization error:", error);

                    if (onUnauthorized === "block") {
                        throw error;
                    }

                    return {
                        allow: false,
                        reason: "Authorization service unavailable",
                    };
                }
            },
        };
    });
}

/**
 * Helper preHandler to protect Fastify routes with a simple allow/deny check.
 * 
 * Usage:
 * ```typescript
 * import { protectRoute } from '@sentinel/sdk/middleware/fastify';
 * 
 * fastify.put('/padron/:id', {
 *   preHandler: protectRoute('padron:edit', (req) => ({
 *     type: 'padron',
 *     id: req.params.id
 *   }), { app: 'unlp' })
 * }, async (request, reply) => {
 *   // This only runs if authorization passes
 * });
 * ```
 */
export function protectRoute(
    action: string,
    getResource: (req: FastifyRequest) => Record<string, any>,
    context?: Record<string, any> | ((req: FastifyRequest) => Record<string, any>)
): preHandlerHookHandler {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const sentinelReq = request as SentinelFastifyRequest;

            if (!sentinelReq.sentinel) {
                return reply.code(500).send({
                    error: "Sentinel plugin not registered. Register sentinelPlugin first.",
                });
            }

            const resource = getResource(request);
            const ctx = typeof context === "function" ? context(request) : context;

            const decision = await sentinelReq.sentinel.authorize(action, resource, ctx);

            if (!decision.allow) {
                return reply.code(403).send({
                    error: "Forbidden",
                    reason: decision.reason,
                });
            }
        } catch (error) {
            request.log.error({ error }, "Authorization check failed");
            return reply.code(500).send({
                error: "Authorization check failed",
            });
        }
    };
}
