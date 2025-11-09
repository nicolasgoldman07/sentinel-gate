import { Policy, DecisionRequest, DecisionResponse } from "../types/policy.js";
import { get } from "lodash-es";
import { logger } from "../utils/logger.js";
import { loadPolicies } from "./policyStore.js";

function resolvePath(path: string, ctx: any): any {
    if (!path.startsWith("${")) return path;
    const clean = path.slice(2, -1);
    return get(ctx, clean);
}

function evaluateCondition(cond: any, ctx: any): boolean {
    if (cond.eq) {
        const [a, b] = cond.eq.map((v: string) => resolvePath(v, ctx));
        return a === b;
    }
    if (cond.ne) {
        const [a, b] = cond.ne.map((v: string) => resolvePath(v, ctx));
        return a !== b;
    }
    if (cond.includes) {
        const [arr, val] = cond.includes.map((v: string) => resolvePath(v, ctx));
        return Array.isArray(arr) ? arr.includes(val) : false;
    }
    if (cond.in) {
        const [val, arr] = cond.in.map((v: string) => resolvePath(v, ctx));
        return Array.isArray(arr) ? arr.includes(val) : false;
    }
    return false;
}

export async function evaluatePolicies(req: DecisionRequest): Promise<DecisionResponse> {
    const policies: Policy[] = await loadPolicies();
    const ctx = req;
    const timestamp = new Date().toISOString();

    for (const policy of policies) {
        const matchAction =
            policy.actions.includes("*") || policy.actions.includes(req.action);
        if (!matchAction) continue;

        if (policy.rbac?.anyRole) {
            const hasRole = policy.rbac.anyRole.some((r) =>
                req.subject.roles.includes(r)
            );
            if (!hasRole) continue;
        }

        if (policy.abac?.all) {
            const allMatch = policy.abac.all.every((c) => evaluateCondition(c, ctx));
            if (!allMatch) continue;
        }
        if (policy.abac?.any) {
            const anyMatch = policy.abac.any.some((c) => evaluateCondition(c, ctx));
            if (!anyMatch) continue;
        }

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

        return {
            allow: true,
            reason: `Matched ${policy.description}`,
            matchedPolicyId: policy.id,
        };
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
