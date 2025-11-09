import type { Request, Response, NextFunction } from "express";
import { SentinelClient } from "../client.js";
import type { DecisionRequest } from "../types.js";

export interface SentinelMiddlewareOptions {
    sentinelUrl?: string;
    /**
     * Function to extract the token from the request.
     * Default: extracts from Authorization header (Bearer token)
     */
    getToken?: (req: Request) => string | undefined;
    /**
     * Function to build the subject from the request.
     * This should extract user info from req.user or decoded token.
     */
    getSubject?: (req: Request) => Record<string, any>;
    /**
     * What to do when authorization fails.
     * 'block' (default): returns 403 Forbidden
     * 'continue': continues to next middleware (useful for optional auth)
     */
    onUnauthorized?: "block" | "continue";
}

/**
 * Extends Express Request with Sentinel authorization helper
 */
export interface SentinelRequest extends Request {
    sentinel: {
        authorize: (
            action: string,
            resource: Record<string, any>,
            context?: Record<string, any>
        ) => Promise<{ allow: boolean; reason: string; matchedPolicyId?: string }>;
    };
}

/**
 * Express middleware that adds Sentinel authorization capabilities to requests.
 * 
 * Usage:
 * ```typescript
 * import { sentinelMiddleware } from '@sentinel/sdk/middleware/express';
 * 
 * app.use(sentinelMiddleware({
 *   sentinelUrl: 'http://localhost:3000'
 * }));
 * 
 * app.put('/padron/:id', async (req: SentinelRequest, res) => {
 *   const decision = await req.sentinel.authorize('padron:edit', {
 *     type: 'padron',
 *     id: req.params.id
 *   }, { app: 'unlp' });
 *   
 *   if (!decision.allow) {
 *     return res.status(403).json({ error: decision.reason });
 *   }
 *   // ... continue with route logic
 * });
 * ```
 */
export function sentinelMiddleware(options: SentinelMiddlewareOptions = {}) {
    const client = new SentinelClient({ baseUrl: options.sentinelUrl });

    const getToken =
        options.getToken ||
        ((req: Request) => {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith("Bearer ")) {
                return authHeader.substring(7);
            }
            return undefined;
        });

    const getSubject =
        options.getSubject ||
        ((req: Request) => {
            // Assuming req.user is populated by a previous auth middleware (e.g., passport, keycloak)
            return (req as any).user || {};
        });

    const onUnauthorized = options.onUnauthorized || "block";

    return async (req: Request, res: Response, next: NextFunction) => {
        const token = getToken(req);

        // Attach sentinel helper to request
        (req as SentinelRequest).sentinel = {
            authorize: async (
                action: string,
                resource: Record<string, any>,
                context?: Record<string, any>
            ) => {
                const subject = getSubject(req);

                const decisionRequest: DecisionRequest = {
                    subject,
                    action,
                    resource,
                    context,
                };

                try {
                    // Set token for this specific call
                    const clientWithToken = new SentinelClient({
                        baseUrl: options.sentinelUrl,
                        token,
                    });
                    return await clientWithToken.authorize(decisionRequest);
                } catch (error) {
                    console.error("Sentinel authorization error:", error);

                    if (onUnauthorized === "block") {
                        throw error;
                    }

                    // If continue, return deny by default
                    return {
                        allow: false,
                        reason: "Authorization service unavailable",
                    };
                }
            },
        };

        next();
    };
}

/**
 * Helper middleware to protect routes with a simple allow/deny check.
 * 
 * Usage:
 * ```typescript
 * import { protect } from '@sentinel/sdk/middleware/express';
 * 
 * app.put('/padron/:id', 
 *   protect('padron:edit', (req) => ({
 *     type: 'padron',
 *     id: req.params.id
 *   }), { app: 'unlp' }),
 *   async (req, res) => {
 *     // This only runs if authorization passes
 *   }
 * );
 * ```
 */
export function protect(
    action: string,
    getResource: (req: Request) => Record<string, any>,
    context?: Record<string, any> | ((req: Request) => Record<string, any>)
) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const sentinelReq = req as SentinelRequest;

            if (!sentinelReq.sentinel) {
                return res.status(500).json({
                    error: "Sentinel middleware not initialized. Add sentinelMiddleware() before protect()."
                });
            }

            const resource = getResource(req);
            const ctx = typeof context === "function" ? context(req) : context;

            const decision = await sentinelReq.sentinel.authorize(action, resource, ctx);

            if (!decision.allow) {
                return res.status(403).json({
                    error: "Forbidden",
                    reason: decision.reason,
                });
            }

            next();
        } catch (error) {
            console.error("Authorization check failed:", error);
            return res.status(500).json({
                error: "Authorization check failed",
            });
        }
    };
}
