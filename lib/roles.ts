// Mirrors the role rules in supabase/profiles.sql — keep both in sync.
export type Role = "member" | "admin_coffee" | "admin_store" | "admin" | "owner";

export const ROLE_LABEL: Record<Role, string> = {
  member: "Member",
  admin_coffee: "Admin Coffee",
  admin_store: "Admin Store",
  admin: "Admin Umum",
  owner: "Owner",
};

const asRole = (role: string | null | undefined): Role => (role && role in ROLE_LABEL ? (role as Role) : "member");

export const roleLabel = (role: string | null | undefined) => ROLE_LABEL[asRole(role)];
export const isStaff = (role: string | null | undefined) => asRole(role) !== "member";
export const canManageCoffee = (role: string | null | undefined) => ["admin_coffee", "admin", "owner"].includes(asRole(role));
export const canManageStore = (role: string | null | undefined) => ["admin_store", "admin", "owner"].includes(asRole(role));
export const canManageRoles = (role: string | null | undefined) => ["admin", "owner"].includes(asRole(role));

/** Roles the current staff member may hand out (owner: all, Admin Umum: no admin/owner). */
export function assignableRoles(actor: string | null | undefined): Role[] {
  if (asRole(actor) === "owner") return ["member", "admin_coffee", "admin_store", "admin", "owner"];
  if (asRole(actor) === "admin") return ["member", "admin_coffee", "admin_store"];
  return [];
}

/** Whether the actor may change this target's role at all. */
export function canEditRoleOf(actor: string | null | undefined, target: string | null | undefined, isSelf: boolean) {
  if (isSelf || !canManageRoles(actor)) return false;
  if (asRole(actor) === "admin") return !["admin", "owner"].includes(asRole(target));
  return true;
}
