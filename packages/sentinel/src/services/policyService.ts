
import { FilePolicyRepository } from "../repositories/policy/FilePolicyRepository.js";
import { PolicyRepository } from "../repositories/policy/PolicyRepository.js";
import { Policy } from "../types/policy.js";

let repository: PolicyRepository = new FilePolicyRepository();

export function setPolicyRepository(repo: PolicyRepository) {
    repository = repo;
}

export async function getAllPolicies(): Promise<Policy[]> {
    return repository.getAll();
}

export async function getPolicyById(id: string): Promise<Policy | null> {
    return repository.getById(id);
}

export async function createPolicy(policy: Policy): Promise<void> {
    return repository.create(policy);
}

export async function updatePolicy(policy: Policy): Promise<void> {
    return repository.update(policy);
}

export async function deletePolicy(id: string): Promise<void> {
    return repository.delete(id);
}
