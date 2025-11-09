import { Policy, DecisionRequest, DecisionResponse } from "../types/policy.js";
import { get } from "lodash-es"; // lightweight alternative (no need for full lodash)

const policies: Policy[] = [
    {
        id: "policy-001",
        description: "UA members can edit padron in OPEN stage",
        actions: ["padron:edit"],
        rbac: { anyRole: ["ua", "operaciones"] },
        abac: {
            all: [
                { eq: ["${resource.status}", "OPEN"] },
                { includes: ["${subject.uaIds}", "${resource.uaId}"] }
            ]
        }
    },
    {
        id: "policy-002",
        description: "Admins can do anything",
        actions: ["*"],
        rbac: { anyRole: ["admin"] }
    }
];

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
        if (Array.isArray(arr)) return arr.includes(val);
        return false;
    }
    if (cond.in) {
        const [val, arr] = cond.in.map((v: string) => resolvePath(v, ctx));
        if (Array.isArray(arr)) return arr.includes(val);
        return false;
    }
    return false;
}

export function evaluatePolicies(req: DecisionRequest): DecisionResponse {
    const ctx = req;

    for (const policy of policies) {
        const matchAction =
            policy.actions.includes("*") || policy.actions.includes(req.action);
        if (!matchAction) continue;

        // RBAC check
        if (policy.rbac?.anyRole) {
            const hasRole = policy.rbac.anyRole.some((r) =>
                req.subject.roles.includes(r)
            );
            if (!hasRole) continue;
        }

        // ABAC check
        if (policy.abac?.all) {
            const allMatch = policy.abac.all.every((c) => evaluateCondition(c, ctx));
            if (!allMatch) continue;
        }
        if (policy.abac?.any) {
            const anyMatch = policy.abac.any.some((c) => evaluateCondition(c, ctx));
            if (!anyMatch) continue;
        }

        return {
            allow: true,
            reason: `Matched ${policy.description}`,
            matchedPolicyId: policy.id
        };
    }

    return { allow: false, reason: "No matching policy" };
}
