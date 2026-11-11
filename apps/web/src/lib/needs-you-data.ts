import "server-only";
import { createClient } from "@/lib/supabase/server";
import { modesFor, TEST_CHANNEL } from "./inbox";
import type { NeedsYouCounts } from "./needs-you";
import type { LocationFilter } from "./scope";

// Las cuentas de lo que espera a una persona (M-02), con su sesión: RLS solo
// cuenta lo que ve. Dos consultas que solo cuentan (`head`), sin traer filas.

export async function loadNeedsYouCounts(organizationId: string | null, locations: LocationFilter): Promise<NeedsYouCounts> {
  if (!organizationId || (locations.kind === "only" && locations.locationIds.length === 0)) {
    return { approvals: 0, humanConversations: 0 };
  }
  const supabase = await createClient();
  let approvals = supabase
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());
  let conversations = supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .neq("channel", TEST_CHANNEL)
    .in("mode", modesFor("human"));
  if (locations.kind === "only") {
    approvals = approvals.in("location_id", locations.locationIds);
    conversations = conversations.in("location_id", locations.locationIds);
  }
  const [approvalsResult, conversationsResult] = await Promise.all([approvals, conversations]);
  const error = approvalsResult.error ?? conversationsResult.error;
  if (error) throw new Error("No se pudo contar lo pendiente", { cause: error });
  return { approvals: approvalsResult.count ?? 0, humanConversations: conversationsResult.count ?? 0 };
}
