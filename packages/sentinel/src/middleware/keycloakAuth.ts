import { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { keycloakConfig } from "../config/keycloak.js";
import { logger } from "../utils/logger.js";

const client = jwksClient({
    jwksUri: `${keycloakConfig.serverUrl}/realms/${keycloakConfig.realm}/protocol/openid-connect/certs`,
    cache: true,
    cacheMaxAge: 86400000, // 24 hours
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
    client.getSigningKey(header.kid, (err: Error | null, key: jwksClient.SigningKey | undefined) => {
        if (err) {
            callback(err);
            return;
        }
        const signingKey = key?.getPublicKey();
        callback(null, signingKey);
    });
}

export interface KeycloakUser {
    sub: string;
    email?: string;
    preferred_username?: string;
    realm_access?: {
        roles: string[];
    };
    [key: string]: any;
}

export async function keycloakAuthMiddleware(
    req: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        reply.status(401).send({ error: "Missing or invalid token" });
        return;
    }

    const token = authHeader.split(" ")[1];

    return new Promise<void>((resolve, reject) => {
        jwt.verify(
            token,
            getKey,
            {
                issuer: `${keycloakConfig.serverUrl}/realms/${keycloakConfig.realm}`,
                algorithms: ["RS256"],
            },
            (err, decoded) => {
                if (err) {
                    logger.warn({ event: "auth.token.invalid", error: err.message });
                    reply.status(401).send({ error: "Invalid or expired token" });
                    reject(err);
                    return;
                }

                const user = decoded as KeycloakUser;
                (req as any).user = {
                    email: user.email,
                    username: user.preferred_username,
                    roles: user.realm_access?.roles || [],
                    ...user,
                };

                resolve();
            }
        );
    });
}
