> **DRAFT — pending review by a lawyer; do not publish.** (BORRADOR — pendiente de revisión por un abogado; no publicar.)
> Prepared on 2026-11-12 by session V13 · Legal. English version of `04-contrato-encargo-tratamiento.es.md`; the Spanish version prevails. Not legal advice. Template Moodly (processor) signs with each customer (controller), covering GDPR Art. 28(3).

# Data Processing Agreement (DPA)

**Between** [CUSTOMER LEGAL NAME], tax ID [ ], address [ ] ("Customer", controller) **and** [RAZÓN SOCIAL], tax ID [NIF], registered office at [DOMICILIO SOCIAL] ("Moodly", processor).

This DPA forms part of Moodly's Terms of Service or Enterprise order ("Main Agreement") and governs Moodly's processing of personal data on the Customer's behalf under Article 28 of Regulation (EU) 2016/679 (GDPR) and Article 33 of Spanish Organic Law 3/2018 (LOPDGDD).

## 1. Subject matter, nature and purpose

Moodly processes the personal data described in **Annex I** solely to provide the AI agent platform under the Main Agreement: serving the Customer's end clients over the channels it enables, managing its calendar, using its knowledge, executing the actions it configures and approves in its connected tools, and support. **Duration:** the Main Agreement's term plus the return and deletion period in clause 12.

## 2. Instructions

2.1. Moodly processes data only on the Customer's documented instructions: this DPA, the Main Agreement and the Customer's configuration of the platform (active agents, knowledge, channels, integrations, autonomy levels, approvals and retention). Other instructions must be in writing and compatible with the service; extra work may be charged.
2.2. Moodly will immediately inform the Customer if, in its opinion, an instruction infringes the GDPR or other law, and may suspend it meanwhile.
2.3. If EU or Member State law requires other processing, Moodly will inform the Customer first unless that law prohibits it.

## 3. Customer's obligations

The Customer warrants a legal basis for the processing and for engaging Moodly; informs its end clients (including that they talk to an AI system and that data may be processed outside the EEA — Moodly provides a transparency note template); will not upload special categories of data except as strictly necessary and lawful, never health data beyond what is agreed; and is responsible for assessing whether a DPIA is required.

## 4. Confidentiality

Persons authorised to process the data are bound by confidentiality and access it only as needed to provide the service or support. Moodly staff access to a customer's data is time-limited, MFA-protected and logged.

## 5. Security

Moodly implements the measures in **Annex II** (GDPR Art. 32) and may update them without lowering the level of protection.

## 6. Subprocessors

6.1. The Customer gives general authorisation for the subprocessors in **Annex III**.
6.2. Moodly will give at least **[30] days'** notice of new or replacement subprocessors, by email and at [SUBPROCESSOR LIST URL]. The Customer may object on reasonable data protection grounds within that period; if unresolved, it may terminate the affected service without penalty and with a refund of unused prepaid amounts [proposal].
6.3. Moodly imposes equivalent data protection obligations on each subprocessor by contract and remains liable to the Customer for them (GDPR Art. 28(4)).

## 7. Data subject rights

Moodly assists with appropriate technical and organisational measures: per-contact export, rectification and deletion tools [in development] and, where insufficient, direct support. Requests received by Moodly are forwarded to the Customer within [5] business days without answering on its behalf unless instructed.

## 8. Assistance

Moodly assists with GDPR Articles 32 to 36 (security, breach notification, DPIAs — including Moodly's product-level DPIA — and prior consultation), taking into account the nature of processing and information available.

## 9. Personal data breaches

Moodly will notify the Customer of a personal data breach **without undue delay and in any event within [48] hours of becoming aware**, with the Art. 33(3) information then available, completed in phases [proposal; the Customer has 72 hours to notify the authority]. Moodly will not notify authorities or data subjects on the Customer's behalf unless asked in writing.

## 10. International transfers

10.1. Data is stored in the European Economic Area (Annex III).
10.2. **AI model processing outside the EEA.** For the agents to work, conversation content and data needed for each response are sent to AI model providers that **may process them outside the EEA, in particular in the United States.** The Customer authorises this. Each transfer relies on the EU-US Data Privacy Framework (Implementing Decision (EU) 2023/1795) where the recipient is certified, or on the standard contractual clauses of Implementing Decision (EU) 2021/914 (Module 3, processor to processor, in Moodly's contracts with its subprocessors) [verify module per provider], with supplementary measures as identified in Moodly's transfer impact assessment.
10.3. Moodly does not commit to EU-only inference.

## 11. Audits

11.1. Moodly makes available the information needed to demonstrate compliance: this DPA and annexes, the subprocessor list, the product DPIA, a security summary and, when available, third-party audit reports or certifications. **Moodly currently holds no certifications (ISO 27001 or SOC 2).**
11.2. If insufficient, the Customer may audit on [30] days' notice, at most once a year except after a breach or a regulator's request, during business hours, without access to other customers' data, directly or through a bound auditor, at its own cost unless a material breach by Moodly is found [proposal].

## 12. Return and deletion

On termination, the Customer may export its data for [30] days. Moodly then deletes the personal data, and backups are overwritten in their normal rotation ([period; confirm with Supabase plan]), except where law requires retention, in which case data is kept blocked. Moodly will certify deletion on request.

## 13. Liability

Governed by the Main Agreement [and its cap / a separate data protection cap of [AMOUNT]: OPEN], without prejudice to GDPR Art. 82.

## 14. Law and jurisdiction

Spanish law; courts as in the Main Agreement. On data protection matters this DPA prevails.

---

## Annex I — Description of processing

| | |
|---|---|
| **Data subjects** | The Customer's end clients and its team members as they appear in operations. |
| **Data categories** | Identification and contact (name, phone, email, messaging channel identifiers); conversation content (text and, with voice, audio and transcripts); appointments; summaries and derived memories (preferences); Customer knowledge documents containing personal data; data returned by connected tools for each action. |
| **Special categories** | Not intended. If volunteered by an end client (e.g. health), processed incidentally and minimally under clause 3. |
| **Operations** | Collection via channels, recording, storage, retrieval, indexing (embeddings), sending to AI models to generate responses and action decisions, summarising, memory extraction, disclosure to the team, actions in connected tools, deletion. |
| **Frequency** | Continuous while the service is active. |
| **Retention** | As configured by the Customer; default [12 months after the last message: proposal]. |

## Annex II — Technical and organisational measures

In place on 2026-11-12: (1) per-customer isolation with row-level security on every table and automated tests that fail if a policy is missing; the agent worker only accesses an organisation's data by naming it explicitly, moving to an organisation-bound database role [in progress]; (2) MFA to administer an organisation; revocable sessions; roles per organisation and location; time-limited, MFA-protected, logged staff access; (3) TLS in transit; providers' encryption at rest; per-organisation keys [in progress; KMS in `eu-central-1`]; (4) append-only audit log; (5) policy engine before any externally visible action, autonomy ceilings, human approval for financial and destructive actions, end-client messages and tool results treated as untrusted data, recipients and tenant set by the system, never by the model, security evals at a 100% threshold; (6) dependency audits and secret scanning on every change, a merge guard against weakening tests, CI-only deployments [human review of sensitive changes reactivated before the first real data]; (7) logs without passwords or tokens, email and IP pseudonymised; errors to Sentry (EU) without user data; (8) provider backups [Pro plan with a tested restore: condition before first real data].

**Not yet in place** (must not be promised): automated retention and purging; per-contact export and deletion; masking personal data before the model; external penetration test; ISO 27001 and SOC 2.

## Annex III — Subprocessors

See `05-registro-subencargados.md`, section 3 ("Lista para clientes"): Supabase Pte. Ltd (database, EU); Vercel Inc. (web app and AI Gateway); Railway Corporation (agent processing, EU region); AI model providers [per current configuration] (**may process outside the EEA**); Plus Five Five, Inc. / Resend (email; metadata in the US); Functional Software, Inc. / Sentry (error monitoring, EU events); WhatsApp Ireland Limited (if the Customer enables WhatsApp).
