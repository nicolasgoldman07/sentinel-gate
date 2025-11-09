import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PolicyRepository } from "./PolicyRepository.js";
import { logger } from "../../utils/logger.ts";
import { Policy } from "../../types/policy.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../data/policies.json");

export class FilePolicyRepository implements PolicyRepository {
    async getAll(): Promise<Policy[]> {
        try {
            const data = await fs.readFile(DATA_PATH, "utf-8");
            return JSON.parse(data) as Policy[];
        } catch (err) {
            logger.error({ event: "policy.file.read.error", err });
            return [];
        }
    }

    async getById(id: string): Promise<Policy | null> {
        const policies = await this.getAll();
        return policies.find((p) => p.id === id) ?? null;
    }

    async create(policy: Policy): Promise<void> {
        const policies = await this.getAll();
        if (policies.some((p) => p.id === policy.id)) {
            throw new Error(`Policy '${policy.id}' already exists`);
        }
        policies.push(policy);
        await this.saveAll(policies);
    }

    async update(policy: Policy): Promise<void> {
        const policies = await this.getAll();
        const idx = policies.findIndex((p) => p.id === policy.id);
        if (idx === -1) throw new Error(`Policy '${policy.id}' not found`);
        policies[idx] = policy;
        await this.saveAll(policies);
    }

    async delete(id: string): Promise<void> {
        const policies = await this.getAll();
        const newList = policies.filter((p) => p.id !== id);
        await this.saveAll(newList);
    }

    private async saveAll(policies: Policy[]): Promise<void> {
        await fs.writeFile(DATA_PATH, JSON.stringify(policies, null, 2), "utf-8");
        logger.info({
            event: "policy.file.save",
            count: policies.length,
            timestamp: new Date().toISOString(),
        });
    }
}
