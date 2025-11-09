export * from "./types.js";
export * from "./client.js";

// Export middleware
export * from "./middleware/express.js";
export * from "./middleware/fastify.js";

import { SentinelClient } from "./client.js";
import type { DecisionRequest, DecisionResponse } from "./types.js";

export async function authorize(
    request: DecisionRequest,
    options?: { baseUrl?: string; token?: string }
): Promise<DecisionResponse> {
    const client = new SentinelClient(options);
    return client.authorize(request);
}
