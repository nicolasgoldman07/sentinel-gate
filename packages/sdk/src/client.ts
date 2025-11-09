import type { DecisionRequest, DecisionResponse } from "./types.js";

export interface SentinelClientOptions { baseUrl?: string; token?: string; }

export class SentinelClient {
    private baseUrl: string;
    private token?: string;

    constructor(options?: SentinelClientOptions) {
        this.baseUrl = options?.baseUrl || process.env.SENTINEL_URL || "http://localhost:3000";
        this.token = options?.token || process.env.SENTINEL_TOKEN;
    }

    async authorize(req: DecisionRequest): Promise<DecisionResponse> {
        const res = await fetch(`${this.baseUrl}/decision`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify(req),
        });
        if (!res.ok) throw new Error(`Authorization request failed: ${res.status}`);
        return (await res.json()) as DecisionResponse;
    }

    async health(): Promise<boolean> {
        const res = await fetch(`${this.baseUrl}/health`);
        return res.ok;
    }
}
