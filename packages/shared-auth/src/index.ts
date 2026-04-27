export type AuthContext = {
  userId: string;
  tenantId: string;
  roles: string[];
};

export function getDefaultAuthContext(): AuthContext {
  return {
    userId: "local-user",
    tenantId: "local-tenant",
    roles: ["platform_admin"]
  };
}

