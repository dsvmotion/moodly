// Las skills de la plataforma que la app sabe nombrar (approvalsPage.skills).
// Una skill que no esté aquí se muestra por su clave.
export const KNOWN_SKILLS = [
  "reply",
  "find_slots",
  "list_my_appointments",
  "book_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "appointment_reminder",
  "join_waitlist",
  "waitlist_offer",
  "search_knowledge",
] as const;
export type KnownSkill = (typeof KNOWN_SKILLS)[number];
export const isKnownSkill = (key: string): key is KnownSkill => (KNOWN_SKILLS as readonly string[]).includes(key);
