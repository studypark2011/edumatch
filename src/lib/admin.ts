import "server-only";
import { createHash } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminPassword, ADMIN_COOKIE } from "@/lib/env";

/** パスワードからセッショントークンを導出（cookie に平文を置かない） */
export function adminToken(): string {
  return createHash("sha256")
    .update("mingaku::" + getAdminPassword())
    .digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return token === adminToken();
}

/** 管理ページ用ガード。未認証なら /admin/login へ。 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
