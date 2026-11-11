// Lo que espera a una persona (auditoría de preproducción, M-02; OA10 y OA11):
// las aprobaciones pendientes y las conversaciones que lleva el equipo, con el
// enlace a donde se resuelven. Lógica pura; las cuentas salen de
// needs-you-data.ts, leídas con la sesión de la persona (RLS).

import { inboxHref } from "./inbox";
import { withScope } from "./scope";

export interface NeedsYouCounts {
  /** Aprobaciones pendientes y sin caducar. */
  approvals: number;
  /** Conversaciones que lleva una persona (las tomó alguien o el agente las pasó). */
  humanConversations: number;
}

export type NeedsYouKey = keyof NeedsYouCounts;

export interface NeedsYouItem {
  key: NeedsYouKey;
  count: number;
  href: string;
}

/** Las entradas de «Pendiente para ti» que tienen algo, con el alcance elegido en el enlace. */
export function needsYouItems(counts: NeedsYouCounts, scope: string | null): NeedsYouItem[] {
  const items: NeedsYouItem[] = [
    { key: "approvals", count: counts.approvals, href: withScope("/app/approvals", scope) },
    {
      key: "humanConversations",
      count: counts.humanConversations,
      href: inboxHref({ filter: "human", search: "", scope }),
    },
  ];
  return items.filter((item) => item.count > 0);
}
