// Las skills de código de la plataforma (MANUAL §5.5): cada una con su
// definición (defineSkill), sus tests y un proveedor falso. La primera
// familia, Recepción (paso 4c).
export { FIND_SLOTS_SKILL_KEY, ReceptionScopeError, createReceptionSkills } from "./reception/skills.js";
export type { ReceptionCatalog, ReceptionSkills } from "./reception/skills.js";
export { MAX_REPLY_LENGTH, ReplyTargetError, createReplySkill } from "./conversation/reply.js";
export type { ConversationSender, ReplySkill } from "./conversation/reply.js";
export { createFakeConversationSender } from "./conversation/fake.js";
export type { FakeConversationSender, SentMessage } from "./conversation/fake.js";
