import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../utils/logger.ts";
import { Policy } from "../types/policy.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../data/policies.json");

export async function loadPolicies(): Promise<Policy[]> {
    try {
        const data = await fs.readFile(DATA_PATH, "utf-8");
        const json = JSON.parse(data);
        logger.info({ event: "policy.load", count: json.length, path: DATA_PATH });
        return json;
    } catch (err) {
        logger.error({ event: "policy.load.error", err });
        return [];
    }
}

export async function savePolicies(policies: Policy[]): Promise<void> {
    try {
        await fs.writeFile(DATA_PATH, JSON.stringify(policies, null, 2), "utf-8");
        logger.info({
            event: "policy.save",
            count: policies.length,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        logger.error({ event: "policy.save.error", err });
    }
}
