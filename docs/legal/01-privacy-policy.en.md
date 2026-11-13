> **DRAFT — pending review by a lawyer; do not publish.** (BORRADOR — pendiente de revisión por un abogado; no publicar.)
> Prepared on 2026-11-12 by session V13 · Legal. English version of `01-politica-privacidad.es.md`; if they differ, the Spanish version prevails. Not legal advice. Bracketed text is missing data or open decisions (see `09-checklist-producto.md`).

# Moodly Privacy Policy

**Last updated:** [PUBLICATION DATE]

This policy explains how Moodly processes the personal data of people who visit our website, write to us, and use the Moodly platform on behalf of a business customer.

## Key points

| | |
|---|---|
| **Controller** | [RAZÓN SOCIAL], tax ID [NIF], registered office at [DOMICILIO SOCIAL] ("Moodly"). |
| **Privacy contact** | [EMAIL DPO/CONTACTO] (meanwhile, contact@moodly.com). Data protection officer: [name or "not appointed"]. |
| **Purposes** | Answering your enquiries and demo requests; creating your account and providing the service if your company is a customer; billing; keeping the platform secure; notifying you about your account. |
| **Legal bases** | Pre-contractual steps and contract; legitimate interests (security, B2B contact); legal obligation (tax); consent where we ask for it (marketing). |
| **Recipients** | Service providers (hosting, email, payments, AI, error monitoring) under data processing agreements. We do not sell data. |
| **Outside the EEA** | Some providers process data outside the European Economic Area, in particular **AI model providers, whose processing is not limited to the EU**, under GDPR safeguards (EU-US Data Privacy Framework or standard contractual clauses). |
| **Your rights** | Access, rectification, erasure, objection, restriction and portability, and the right to complain to the Spanish Data Protection Agency (AEPD). |

## 1. Two roles: controller and processor

- **Moodly as controller:** data of website visitors, people who contact us or request a demo, and platform users (each customer's team: name, email, role, access).
- **Moodly as processor:** when Moodly's AI agents serve a customer's own clients (web chat, WhatsApp and other channels), the customer business is the controller and Moodly processes that data only on its behalf and instructions, under the data processing agreement (DPA) we sign with it. **If you chatted with the assistant of a business that uses Moodly, that business's privacy policy applies to you**, and you should address requests to it; if they reach us, we will forward them.

## 2. What data, why, and on what basis

| Who | Data | Purpose | Legal basis (GDPR Art. 6(1)) | Retention |
|---|---|---|---|---|
| Website visitors | Connection data logged by our hosting providers (IP, browser, requested URL) and the language cookie. No analytics or advertising. | Serve and protect the website. | Legitimate interests (f). | Hosting log retention [confirm Railway's period]. |
| People who write to us | The website forms open your email program with a prefilled message; we receive what you send: name, work email, company, phone, message. | Reply and, on request, prepare a demo or proposal. | Pre-contractual steps (b) and legitimate interests (f) in B2B contact (Art. 19 LOPDGDD). | Up to 12 months after the last contact if you do not become a customer [confirm]. |
| Platform users | Name, email, language, role and locations; credentials (passwords are handled by Supabase Auth; we never see them); second factor (MFA); security logs with email and IP pseudonymised; actions in the platform (audit log); preferences. | Provide access, deliver the service, security and traceability. | Contract with the customer (b) and legitimate interests (f). | Account lifetime plus [X] months; audit logs [X years; on deletion, personal fields are pseudonymised and the event kept]. |
| Customer billing contacts | Name, email, company tax data; card data is handled by Stripe (we never see it in full). | Charge the trial, credits and plans; invoice. | Contract (b) and legal obligation (c). | As required by law [6 years under the Spanish Commercial Code; 4 years under tax law; confirm]. |
| Platform users: notifications | Email and notification content. | Tell you what needs your attention. | Contract (b). | [Email provider's log retention; confirm]. |
| Technical errors | Technical error data, configured to exclude user, IP, cookies, headers and bodies; emails redacted. | Detect and fix bugs. | Legitimate interests (f). | [Sentry retention; confirm]. |
| Marketing | Email. | Product news. | Consent (a), or for existing customers about similar products (Art. 21.2 LSSI-CE). Unsubscribe in every message. | Until you unsubscribe. **We do not send marketing today.** |

We do not make decisions based solely on automated processing that produce legal or similarly significant effects on you (GDPR Art. 22).

## 3. Artificial intelligence

- Moodly uses third-party AI models (through Vercel AI Gateway and the model providers in the subprocessor list) to run the agents and the platform assistant.
- **Where:** model processing is **not limited to the European Union** and may happen in the United States or other countries where those providers operate. Platform data is stored in the EU (section 5). Each transfer is covered by a data processing agreement and a GDPR Chapter V safeguard.
- **Training:** [wording to be verified provider by provider; only state "providers do not use your data to train their models" once each active provider's terms confirm it and counsel approves].
- Agent actions with external effects (sending, booking, charging) go through a policy engine, and sensitive ones require approval by a person.

## 4. Recipients

- **Processors** we need to provide the service: database and application hosting, job execution, email, AI models, connections to the customer's tools, error monitoring and payments. The full, current list with each provider's region and transfer safeguard is at [SUBPROCESSOR LIST URL].
- **Stripe** acts as [independent controller / processor; confirm against Stripe's terms] for payment processing.
- **Authorities**, when required by law.
- **We do not sell** personal data or share it for advertising.

## 5. Where data is and international transfers

- **In the EU:** the platform database (Supabase, Frankfurt, Germany), agent processing (Railway, Amsterdam), the web application (Vercel, functions in Frankfurt) and error events (Sentry, Frankfurt).
- **Outside the EEA:** AI model providers; metadata and logs of the emails we send (Resend stores account data in the US even when sending from Ireland); account data of some US providers (e.g. Sentry, Railway); Vercel's global delivery network; and [the public website, hosted in the US today — see checklist]. We rely on the EU-US Data Privacy Framework adequacy decision (Implementing Decision (EU) 2023/1795) where the provider is certified, or on the Commission's standard contractual clauses (Implementing Decision (EU) 2021/914). You can request a copy of the safeguards at [EMAIL DPO/CONTACTO].

## 6. Retention

As in section 2. Afterwards we delete or anonymise the data, unless it must be kept blocked for legal claims (Art. 32 LOPDGDD) for the limitation period. [Automatic retention-based purging is not yet implemented: a condition before the first real customer data.]

## 7. Your rights

You can exercise access, rectification, erasure, objection, restriction and portability, and withdraw consent, by writing to [EMAIL DPO/CONTACTO] with a way to identify you. We reply within one month (extendable by two months for complex requests, GDPR Art. 12(3)). You can complain to the Agencia Española de Protección de Datos (www.aepd.es).

## 8. Security

Per-customer data isolation in the database, encryption in transit and at rest by our providers, MFA to administer an organisation, audit logging and security configuration reviews. We will notify you of a breach affecting you where GDPR Art. 34 requires it.

## 9. Children

The platform is for businesses and is not directed at people under 18.

## 10. Changes

We will announce material changes on the website and, for users, in the platform or by email.
