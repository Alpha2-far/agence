import type { LegacyUser } from "@/context/AuthContext";

export type AppRole = LegacyUser["type"];

const roleLevel: Record<AppRole, number> = {
  user: 1,
  Admin: 2,
  SuperAdmin: 3,
};

export function hasMinimumRole(userRole: AppRole, requiredRole: AppRole) {
  return roleLevel[userRole] >= roleLevel[requiredRole];
}
