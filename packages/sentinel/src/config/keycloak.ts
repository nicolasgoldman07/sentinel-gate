import dotenv from "dotenv";
dotenv.config();

export const keycloakConfig = {
    serverUrl: process.env.KEYCLOAK_SERVER_URL || "http://localhost:8080",
    realm: process.env.KEYCLOAK_REALM || "sentinel",
    clientId: process.env.KEYCLOAK_CLIENT_ID || "sentinel-api",
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || "",
};
