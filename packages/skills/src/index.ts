// Las skills de código de la plataforma (MANUAL §5.5): cada una con su
// definición (defineSkill), sus tests y un proveedor falso. La primera
// familia, Recepción (paso 4c).
export { FIND_SLOTS_SKILL_KEY, ReceptionScopeError, createReceptionSkills } from "./reception/skills.js";
export type { ReceptionCatalog, ReceptionSkills } from "./reception/skills.js";
export {
  APPOINTMENT_REMINDER_SKILL_KEY,
  REMINDER_KINDS,
  ReminderNotApplicableError,
  createAppointmentReminderSkill,
  reminderText,
  stillApplies,
} from "./reception/reminder.js";
export type { AppointmentReminderSkill, ReminderAppointment, ReminderKind, ReminderSource } from "./reception/reminder.js";
export { JOIN_WAITLIST_SKILL_KEY, MAX_WAITLIST_WINDOW_MS, WaitlistScopeError, createJoinWaitlistSkill } from "./reception/waitlist.js";
export type { JoinWaitlistRequest, JoinWaitlistSkill, WaitlistEntry, WaitlistStore } from "./reception/waitlist.js";
export {
  WAITLIST_OFFER_SKILL_KEY,
  WaitlistOfferNotApplicableError,
  createWaitlistOfferSkill,
  offerText,
  stillOffered,
} from "./reception/waitlist-offer.js";
export type { OfferedEntry, WaitlistOfferSkill, WaitlistOfferSource } from "./reception/waitlist-offer.js";
export { KNOWLEDGE_RESULTS, SEARCH_KNOWLEDGE_SKILL_KEY, createSearchKnowledgeSkill } from "./knowledge/search.js";
export type { SearchKnowledgeSkill } from "./knowledge/search.js";
export { MAX_REPLY_LENGTH, ReplyTargetError, createReplySkill } from "./conversation/reply.js";
export type { ConversationSender, ReplySkill } from "./conversation/reply.js";
export { createFakeConversationSender } from "./conversation/fake.js";
export type { FakeConversationSender, SentMessage } from "./conversation/fake.js";
