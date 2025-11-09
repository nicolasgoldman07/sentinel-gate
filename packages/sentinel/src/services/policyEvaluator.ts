import jsonLogic from "json-logic-js";
import { getAllPolicies } from "./policyService.ts";
import { DecisionRequest, DecisionResponse } from "../types/policy.ts";
import { logger } from "../utils/logger.ts";

jsonLogic.add_operation("in", (val: any, arr: any[]) => Array.isArray(arr) && arr.includes(val));
jsonLogic.add_operation("includes", (arr: any[], val: any) => Array.isArray(arr) && arr.includes(val));

export async function evaluatePolicies(req: DecisionRequest): Promise<DecisionResponse> {
    const policies = await getAllPolicies();
    const ctx = req;
    const timestamp = new Date().toISOString();

    logger.info({ event: "debug.policies", count: policies.length, actions: policies.map(p => p.actions) });

    for (const policy of policies) {
        const matchAction = policy.actions.includes("*") || policy.actions.includes(req.action);
        if (!matchAction) continue;

        if (policy.rbac?.anyRole) {
            const hasRole = policy.rbac.anyRole.some((r) => req.subject.roles.includes(r));
            if (!hasRole) continue;
        }

        if (policy.abac && !jsonLogic.apply(policy.abac, ctx)) continue;

        logger.info({
            event: "authorization.decision",
            timestamp,
            user: req.subject.sub,
            action: req.action,
            resourceType: req.resource.type,
            allow: true,
            policyId: policy.id,
            reason: policy.description,
        });

        return { allow: true, reason: `Matched ${policy.description}`, matchedPolicyId: policy.id };
    }

    logger.warn({
        event: "authorization.decision",
        timestamp,
        user: req.subject.sub,
        action: req.action,
        resourceType: req.resource.type,
        allow: false,
        reason: "No matching policy",
    });

    return { allow: false, reason: "No matching policy" };
}
