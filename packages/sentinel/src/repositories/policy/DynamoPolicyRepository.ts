import {
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    DeleteItemCommand,
    ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { PolicyRepository } from "./PolicyRepository.js";
import { Policy } from "../../types/policy.ts";
import { logger } from "../../utils/logger.ts";

export class DynamoPolicyRepository implements PolicyRepository {
    private client: DynamoDBClient;
    private tableName: string;

    constructor(tableName: string) {
        this.tableName = tableName;
        this.client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
    }

    async getAll(): Promise<Policy[]> {
        const cmd = new ScanCommand({ TableName: this.tableName });
        const res = await this.client.send(cmd);
        return (res.Items || []).map((item) => unmarshall(item) as Policy);
    }

    async getById(id: string): Promise<Policy | null> {
        const cmd = new GetItemCommand({
            TableName: this.tableName,
            Key: marshall({ pk: `POLICY#${id}` }),
        });
        const res = await this.client.send(cmd);
        if (!res.Item) return null;
        return unmarshall(res.Item) as Policy;
    }

    async create(policy: Policy): Promise<void> {
        const existing = await this.getById(policy.id);
        if (existing) throw new Error(`Policy '${policy.id}' already exists`);
        const item = {
            pk: `POLICY#${policy.id}`,
            ...policy,
            updatedAt: new Date().toISOString(),
        };
        await this.client.send(
            new PutItemCommand({ TableName: this.tableName, Item: marshall(item) })
        );
        logger.info({ event: "policy.dynamo.create", id: policy.id });
    }

    async update(policy: Policy): Promise<void> {
        const item = {
            pk: `POLICY#${policy.id}`,
            ...policy,
            updatedAt: new Date().toISOString(),
        };
        await this.client.send(
            new PutItemCommand({ TableName: this.tableName, Item: marshall(item) })
        );
        logger.info({ event: "policy.dynamo.update", id: policy.id });
    }

    async delete(id: string): Promise<void> {
        await this.client.send(
            new DeleteItemCommand({
                TableName: this.tableName,
                Key: marshall({ pk: `POLICY#${id}` }),
            })
        );
        logger.info({ event: "policy.dynamo.delete", id });
    }
}
