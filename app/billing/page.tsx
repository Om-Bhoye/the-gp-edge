import { redirect } from "next/navigation";

/**
 * /billing is served under /dashboard/pricing.
 * This redirect ensures any existing links continue to work without 404.
 */
export default function BillingRedirect() {
  redirect("/dashboard/pricing");
}

