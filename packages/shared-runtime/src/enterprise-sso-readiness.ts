import { store } from "@apex/shared-state";
import {
  createEntityId,
  nowIso,
  SSOProviderBoundarySchema,
  OrgTenantSchema,
  ClaimsToPolicyMappingSchema,
  type SSOProviderBoundary,
  type OrgTenant,
  type ClaimsToPolicyMapping,
  type SSOProviderKind
} from "@apex/shared-types";
import { recordAudit } from "./core.js";

export function registerSSOProviderBoundary(input: {
  provider_kind: SSOProviderKind;
  display_name: string;
  issuer_url?: string;
  client_id?: string;
  scopes?: string[];
  claims_mapping?: Record<string, string>;
  active?: boolean;
}): SSOProviderBoundary {
  const provider = SSOProviderBoundarySchema.parse({
    provider_id: createEntityId("sso"),
    provider_kind: input.provider_kind,
    display_name: input.display_name,
    issuer_url: input.issuer_url,
    client_id: input.client_id,
    scopes: input.scopes ?? [],
    claims_mapping: input.claims_mapping ?? {},
    active: input.active ?? false,
    created_at: nowIso()
  });

  store.ssoProviderBoundaries.set(provider.provider_id, provider);

  recordAudit("enterprise_readiness.sso_provider_registered", {
    provider_id: provider.provider_id,
    provider_kind: input.provider_kind,
    display_name: input.display_name,
    active: provider.active
  });

  return provider;
}

export function listSSOProviders(filter?: { active_only?: boolean }): SSOProviderBoundary[] {
  let providers = [...store.ssoProviderBoundaries.values()];
  if (filter?.active_only) providers = providers.filter(p => p.active);
  return providers.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function createOrgTenant(input: {
  org_name: string;
  tier?: OrgTenant["tier"];
  sso_provider_id?: string;
  role_definitions?: Array<{ role_name: string; permissions: string[] }>;
}): OrgTenant {
  const tenant = OrgTenantSchema.parse({
    tenant_id: createEntityId("org"),
    org_name: input.org_name,
    tier: input.tier ?? "personal",
    sso_provider_id: input.sso_provider_id,
    fleet_policy_id: undefined,
    role_definitions: input.role_definitions ?? [
      { role_name: "admin", permissions: ["all"] },
      { role_name: "operator", permissions: ["task:create", "task:read", "task:execute", "policy:read"] },
      { role_name: "viewer", permissions: ["task:read", "policy:read"] }
    ],
    created_at: nowIso()
  });

  store.orgTenants.set(tenant.tenant_id, tenant);

  recordAudit("enterprise_readiness.org_tenant_created", {
    tenant_id: tenant.tenant_id,
    org_name: input.org_name,
    tier: tenant.tier,
    role_count: tenant.role_definitions.length
  });

  return tenant;
}

export function getOrgTenant(tenantId: string): OrgTenant | undefined {
  return store.orgTenants.get(tenantId);
}

export function listOrgTenants(): OrgTenant[] {
  return [...store.orgTenants.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function createClaimsToPolicyMapping(input: {
  provider_id: string;
  claim_path: string;
  policy_field: string;
  transform?: ClaimsToPolicyMapping["transform"];
  transform_config?: Record<string, unknown>;
}): ClaimsToPolicyMapping {
  const mapping = ClaimsToPolicyMappingSchema.parse({
    mapping_id: createEntityId("cpmap"),
    provider_id: input.provider_id,
    claim_path: input.claim_path,
    policy_field: input.policy_field,
    transform: input.transform ?? "direct",
    transform_config: input.transform_config ?? {},
    created_at: nowIso()
  });

  store.claimsToPolicyMappings.set(mapping.mapping_id, mapping);

  recordAudit("enterprise_readiness.claims_mapping_created", {
    mapping_id: mapping.mapping_id,
    provider_id: input.provider_id,
    claim_path: input.claim_path,
    policy_field: input.policy_field
  });

  return mapping;
}

export function resolveClaimsToPolicy(claims: Record<string, unknown>, providerId: string): Record<string, unknown> {
  const mappings = [...store.claimsToPolicyMappings.values()]
    .filter(m => m.provider_id === providerId);

  const policy: Record<string, unknown> = {};

  for (const mapping of mappings) {
    const claimValue = getNestedValue(claims, mapping.claim_path);
    if (claimValue === undefined) continue;

    switch (mapping.transform) {
      case "direct": {
        policy[mapping.policy_field] = claimValue;
        break;
      }
      case "prefix": {
        policy[mapping.policy_field] = `sso_${claimValue}`;
        break;
      }
      case "regex_extract": {
        const pattern = (mapping.transform_config.pattern as string) ?? "(.*)";
        const match = String(claimValue).match(new RegExp(pattern));
        if (match) policy[mapping.policy_field] = match[1] ?? match[0];
        break;
      }
      case "lookup": {
        const lookupTable = (mapping.transform_config.lookup as Record<string, unknown>) ?? {};
        policy[mapping.policy_field] = lookupTable[String(claimValue)] ?? claimValue;
        break;
      }
    }
  }

  return policy;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function getEnterpriseReadinessDiagnostics(): {
  sso_providers_registered: number;
  sso_providers_active: number;
  org_tenants_created: number;
  claims_mappings_count: number;
  fleet_policy_configured: boolean;
  readiness_level: "not_prepared" | "contracts_only" | "boundary_prepared" | "ready_for_sso_integration";
  blocking_items: string[];
  supported_providers: SSOProviderKind[];
} {
  const providers = [...store.ssoProviderBoundaries.values()];
  const tenants = [...store.orgTenants.values()];
  const mappings = [...store.claimsToPolicyMappings.values()];

  const blockingItems: string[] = [];
  let readinessLevel: "not_prepared" | "contracts_only" | "boundary_prepared" | "ready_for_sso_integration" = "not_prepared";

  if (providers.length === 0) {
    blockingItems.push("No SSO providers registered");
  } else if (!providers.some(p => p.active)) {
    readinessLevel = "contracts_only";
    blockingItems.push("No active SSO providers - all are boundary registrations");
  } else if (tenants.length === 0) {
    readinessLevel = "boundary_prepared";
    blockingItems.push("No org tenants created");
  } else {
    readinessLevel = "ready_for_sso_integration";
  }

  return {
    sso_providers_registered: providers.length,
    sso_providers_active: providers.filter(p => p.active).length,
    org_tenants_created: tenants.length,
    claims_mappings_count: mappings.length,
    fleet_policy_configured: tenants.some(t => !!t.fleet_policy_id),
    readiness_level: readinessLevel,
    blocking_items: blockingItems,
    supported_providers: ["none", "okta", "azure_ad", "clerk", "custom_oidc", "custom_saml"]
  };
}

export function initializeDefaultSSOProviderBoundaries(): SSOProviderBoundary[] {
  const providers: SSOProviderBoundary[] = [];

  const defaults: Array<{
    provider_kind: SSOProviderKind;
    display_name: string;
    claims_mapping: Record<string, string>;
  }> = [
    {
      provider_kind: "okta",
      display_name: "Okta SSO",
      claims_mapping: {
        "sub": "user_id",
        "email": "user_email",
        "groups": "user_roles",
        "org": "tenant_id"
      }
    },
    {
      provider_kind: "azure_ad",
      display_name: "Azure Active Directory",
      claims_mapping: {
        "oid": "user_id",
        "preferred_username": "user_email",
        "roles": "user_roles",
        "tid": "tenant_id"
      }
    },
    {
      provider_kind: "clerk",
      display_name: "Clerk Authentication",
      claims_mapping: {
        "sub": "user_id",
        "email": "user_email",
        "org_id": "tenant_id",
        "org_role": "user_roles"
      }
    }
  ];

  for (const def of defaults) {
    const existing = [...store.ssoProviderBoundaries.values()]
      .find(p => p.provider_kind === def.provider_kind);
    if (!existing) {
      const provider = registerSSOProviderBoundary({
        provider_kind: def.provider_kind,
        display_name: def.display_name,
        claims_mapping: def.claims_mapping
      });
      providers.push(provider);

      for (const [claimPath, policyField] of Object.entries(def.claims_mapping)) {
        createClaimsToPolicyMapping({
          provider_id: provider.provider_id,
          claim_path: claimPath,
          policy_field: policyField
        });
      }
    }
  }

  return providers;
}

export function getSSOIntegrationRunbook(providerKind: SSOProviderKind): {
  provider_kind: string;
  required_env_vars: string[];
  required_endpoints: string[];
  setup_steps: string[];
  verification_steps: string[];
} {
  const runbooks: Record<string, {
    required_env_vars: string[];
    required_endpoints: string[];
    setup_steps: string[];
    verification_steps: string[];
  }> = {
    okta: {
      required_env_vars: ["APEX_SSO_OKTA_ISSUER", "APEX_SSO_OKTA_CLIENT_ID", "APEX_SSO_OKTA_CLIENT_SECRET"],
      required_endpoints: ["/api/auth/okta/callback", "/api/auth/okta/login"],
      setup_steps: [
        "1. Create Okta application",
        "2. Configure redirect URIs",
        "3. Set environment variables",
        "4. Register claims mapping",
        "5. Test authentication flow"
      ],
      verification_steps: [
        "Verify issuer URL is reachable",
        "Verify client ID is valid",
        "Verify callback URL is registered",
        "Verify claims mapping produces expected policy fields"
      ]
    },
    azure_ad: {
      required_env_vars: ["APEX_SSO_AZURE_TENANT_ID", "APEX_SSO_AZURE_CLIENT_ID", "APEX_SSO_AZURE_CLIENT_SECRET"],
      required_endpoints: ["/api/auth/azure/callback", "/api/auth/azure/login"],
      setup_steps: [
        "1. Register Azure AD application",
        "2. Configure redirect URIs",
        "3. Set environment variables",
        "4. Register claims mapping",
        "5. Test authentication flow"
      ],
      verification_steps: [
        "Verify Azure AD tenant is reachable",
        "Verify client ID is valid",
        "Verify callback URL is registered",
        "Verify claims mapping produces expected policy fields"
      ]
    },
    clerk: {
      required_env_vars: ["APEX_SSO_CLERK_PUBLISHABLE_KEY", "APEX_SSO_CLERK_SECRET_KEY"],
      required_endpoints: ["/api/auth/clerk/webhook"],
      setup_steps: [
        "1. Create Clerk application",
        "2. Configure allowed origins",
        "3. Set environment variables",
        "4. Register claims mapping",
        "5. Test authentication flow"
      ],
      verification_steps: [
        "Verify Clerk publishable key is valid",
        "Verify webhook endpoint is registered",
        "Verify claims mapping produces expected policy fields"
      ]
    }
  };

  const runbook = runbooks[providerKind] ?? {
    required_env_vars: [`APEX_SSO_${providerKind.toUpperCase()}_ISSUER`],
    required_endpoints: ["/api/auth/callback"],
    setup_steps: ["1. Configure SSO provider", "2. Set environment variables", "3. Test authentication"],
    verification_steps: ["Verify provider is reachable", "Verify claims mapping"]
  };

  return {
    provider_kind: providerKind,
    ...runbook
  };
}
