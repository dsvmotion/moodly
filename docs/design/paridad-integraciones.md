# Paridad de integraciones con heydiga y GuruSup

> Lista de paridad de la auditoría de preproducción (2026-11-10, §18.8 y tarea 1 de V3): el catálogo público de cada competidor contra `docs/scope.yaml`, con una forma de conectar por sistema. Es un documento de diseño: el estado de cada integración lo manda el registro, no esta lista. Si discrepan, gana `scope.yaml` (ADR 0023).

## Fuentes y método (2026-11-12)
- **heydiga:** [heydiga.com/es/integraciones](https://heydiga.com/es/integraciones), 28 integraciones con nombre (la página añade «y muchas más» sin nombrarlas).
- **GuruSup:** [gurusup.com/integrations](https://gurusup.com/integrations), 144 en la vista «All» (anuncian «141+»), en 13 categorías. Las que ya salen en heydiga van solo en su tabla.
- **Nango:** el catálogo de proveedores de su repositorio (`packages/providers/providers.yaml`, commit `49117c3` de `NangoHQ/nango`, 1.241 proveedores). Es la plataforma de conectores elegida (ADR 0053). Que Nango tenga el proveedor quiere decir que resuelve la autenticación; las acciones de cada sistema las escribimos nosotros como skills.
- **Registro:** las unidades `int-*` y `ch-*` de `docs/scope.yaml` en `main`, con su hito y estado. El cruce es por nombre normalizado, revisado a mano en los casos dudosos (p. ej. Monday → `int-mondaydotcom`, Zoho → `int-zoho`, Slackbot → `int-slack`).

**Cómo conectar cada sistema** (una forma por fila):
- **Nativa:** código nuestro, por la profundidad que pide el piloto (ADR 0053 §7: WhatsApp, calendario y pagos).
- **Plataforma:** Nango tiene el proveedor; la conexión vive en la plataforma y la acción es una skill nuestra.
- **Socio, contrato o API del cliente:** Nango no lo tiene. Toca integración nativa contra su API si es abierta, la clave del cliente guardada en la bóveda, un acuerdo de socio o un contrato. No está comprobado sistema a sistema si su API es abierta: es la siguiente tarea de cada uno.
- **Proveedor de modelos:** no es un conector; va detrás del enrutador de modelos (PL-T6).
- **Fuera (decisión 15):** sistemas de salud, fuera de la web y del alcance hasta que haya revisión legal y una DPIA.

## Resumen

| | Sistemas |
|---|---|
| Distintos entre los dos catálogos | 167 (heydiga 28, GuruSup sin repetir 139) |
| Plataforma (Nango) | 106 |
| Socio, contrato o API del cliente | 48 |
| Nativa | 5 |
| Proveedor de modelos | 4 |
| Fuera (decisión 15) | 4 |
| Con unidad del piloto (M0–M4) | 35 |
| Con unidad de después (after o stretch) | 50 |
| Sin unidad en el registro | 82 |

## Lo que sale de la lista
1. **Los sistemas de reservas de belleza del lote C no tienen conector en Nango.** Booksy, Treatwell, Koibox, Timp y Wilapp cuentan para las 50 del piloto (M4, lote C), pero ninguno está en el catálogo de Nango: cada uno es API propia, acuerdo de socio o contrato. Ya lo avisa el ADR 0053 («conviene empezar esas conversaciones pronto»). Con la regla de sustitución del registro, si alguno no se puede, entra el siguiente por orden de oleada; para no quedarse cortos, hay que saber pronto cuáles tienen API abierta. Primera comprobación, en «Reservas de belleza: qué API tiene cada uno».
2. **Todo lo sectorial de heydiga es «socio, contrato o API del cliente».** Ninguno de sus 21 sistemas sectoriales (17 sin contar los 4 de salud: belleza, restauración, talleres e inmobiliaria) está en Nango. Es la parte del catálogo de heydiga que no se iguala con una plataforma, sino con trabajo propio.
3. **Lo de GuruSup es amplitud que da la plataforma.** 106 de sus sistemas tienen proveedor en Nango; la paridad ahí es escribir las acciones como skills, no la autenticación. Muchos son herramientas de desarrollo o de datos (Sentry, Supabase, GitHub, Snowflake, BigQuery, Firecrawl…) que no encajan en una pyme de servicios; no hace falta perseguirlos para el piloto.
4. **Sin unidad en el registro (82).** Lo decide producto (V1 lleva el registro). Candidatos que encajan con los sectores de la web, por si se quieren dar de alta: DunaSoft (en el catálogo de heydiga; falta ver qué cubre), Icnea y Apaleo (alojamientos, hostelería), ServiceM8 (oficios, reformas), Dialpad (telefonía), PandaDoc (propuestas y firma), Eventbrite (eventos), SendPulse (email y mensajería), Zoho Invoice (facturación) y Attio y Apollo (CRM y prospección). El resto se puede quedar fuera sin perder paridad útil.
5. **Salud.** Doctoralia, Clinic Cloud, Gesden y Dentalink tienen unidad (after) pero quedan fuera por la decisión 15 mientras no haya revisión legal y DPIA; la web ya no los enseña (PR #246).

## Reservas de belleza: qué API tiene cada uno (2026-11-13)

Comprobación solo con fuentes públicas: la web y la documentación de cada uno, directorios de API y foros. No se ha pedido acceso a nadie ni se ha probado ninguna API. Es la tarea del punto 1 de la lista de arriba; quien hable con cada empresa debe confirmar lo que aquí sale como «indicio».

| Sistema | ¿API? | Cómo se accede | Lo que haría falta | Fuentes |
|---|---|---|---|---|
| Koibox | **Sí, documentada y pública.** REST con citas (crear, listar, horas libres por empleado y servicio), clientes, servicios, bloqueos de agenda, ventas y webhooks (citas, clientes, servicios, productos y ventas). | **API del cliente:** el administrador del centro crea la clave en Ajustes → API Keys; va en la cabecera `X-Koibox-Key`. Una clave es de un solo centro y queda a nombre de quien la creó. Hace falta el plan Platinum del centro (si no, 403). | Integración nativa contra su API con la clave del cliente guardada en la bóveda. Es el más directo de los cinco. Falta confirmar el coste del plan Platinum para los centros del piloto y la firma de sus webhooks. | [docs.koibox.cloud](https://docs.koibox.cloud/en/intro/first-steps), [uso responsable](https://docs.koibox.cloud/en/intro/responsible-use/) |
| Booksy | **Sí, pero de socio.** API REST para socios (citas, reservas, clientes, reseñas, webhooks), según directorios de API; la documentación oficial no es pública (responde 401). | **Acuerdo de socio:** no hay alta autoservicio; las claves (par RSA y JWT, sandbox y producción) las da Booksy. En un foro se cuenta que pesa más que lo pida el propio negocio a su comercial de Booksy. | Conversación con Booksy (partnerships). Es el que más tarda: empezar ya. | [apis.io](https://apis.io/apis/booksy/booksy-public-api/), [foro de Retell](https://community.retellai.com/t/anyone-integrated-retell-with-booksy-for-live-availability-booking/3448) |
| Treatwell | **Indicio de API de socio, sin documentación pública.** Sus condiciones para proveedores hablan de «Treatwell APIs»; directorios antiguos (GetApp, Softwarefinder) dicen que no tiene API. | **Acuerdo de socio:** Treatwell se conecta con software de salón integrado (lista de socios en su web; p. ej. Salonized documenta su integración). | Conversación con Treatwell como socio de software. Otra vía: llegar a través de un software de gestión ya integrado con Treatwell que sí tenga API. | [condiciones](https://www.treatwell.es/en/info/supplier-terms-and-conditions/), [socios](https://www.treatwell.co.uk/partners?p=9657), [Salonized](https://help.salonized.com/en/articles/6417703-how-does-the-treatwell-integration-work-in-salonized) |
| Timp | **No se encontró API pública.** Las integraciones que se anuncian son de producto (ClassPass, Stripe, Google Calendar…); las «integraciones avanzadas» son un módulo de pago. | **Por confirmar con Timp** (soporte@timp.pro, Time Management Technologies, S.L.). | Preguntar si hay API o acuerdo de socio. Mientras tanto, la vía de menos esfuerzo es su integración con Google Calendar, que ya leemos por Nango (solo lectura, sin reservar). | [Capterra](https://www.capterra.es/software/196549/timp), [App Store](https://apps.apple.com/cd/app/timp/id932832568) |
| Wilapp | **No se encontró API pública.** Solo un plugin de WordPress para reservar desde la web, que pide una cuenta de Wilapp (última actualización en 2023, sin probar con las tres últimas versiones de WordPress). | **Por confirmar con Wilapp.** | Preguntar si hay API o acuerdo de socio. No usar la API que use el plugin por dentro sin un acuerdo: no está documentada ni es un contrato. | [plugin](https://wordpress.org/plugins/wilapp/) |

**Lo que sale:**
1. Hoy, solo **Koibox** se puede integrar sin hablar con nadie (API abierta con la clave del cliente).
2. **Booksy y Treatwell** son acuerdos de socio. Es la conversación más larga, y conviene empezarla ya.
3. Con **Timp y Wilapp** hay que preguntar antes. Si no hay API ni acuerdo, la regla de sustitución del registro hace que entre el siguiente por orden de oleada.
4. Nada de esto se resuelve por la vía de automatizar la web o la app con la sesión del negocio. Algunos proveedores lo ofrecen para Booksy, pero tiene riesgo con sus condiciones y se rompe con cualquier cambio.

## Las tablas
### heydiga (28)

| Sistema | Lo anuncian | Unidad en `scope.yaml` | Cómo | Conector de Nango |
|---|---|---|---|---|
| Booksy | heydiga | `int-booksy` (M4, lote C, planned) | Socio, contrato o API del cliente: socio (ver «Reservas de belleza») | — |
| Treatwell | heydiga | `int-treatwell` (M4, lote C, planned) | Socio, contrato o API del cliente: socio (ver «Reservas de belleza») | — |
| Koibox | heydiga | `int-koibox` (M4, lote C, planned) | Socio, contrato o API del cliente: API abierta del cliente (ver «Reservas de belleza») | — |
| Timp | heydiga | `int-timp` (M4, lote C, planned) | Socio, contrato o API del cliente: por confirmar (ver «Reservas de belleza») | — |
| Square | heydiga | `int-square` (M3, lote B, planned) | Nativa | `squareup` |
| Wilapp | heydiga | `int-wilapp` (M4, lote C, planned) | Socio, contrato o API del cliente: por confirmar (ver «Reservas de belleza») | — |
| DunaSoft | heydiga | — | Socio, contrato o API del cliente | — |
| CoverManager | heydiga | `int-covermanager` (after, planned) | Socio, contrato o API del cliente | — |
| TheFork | heydiga | `int-thefork` (after, planned) | Socio, contrato o API del cliente | — |
| Restoo | heydiga | `int-restoo` (after, planned) | Socio, contrato o API del cliente | — |
| WordPress | heydiga | `int-wordpress` (M3, lote B, planned) | Plataforma | `wordpress` |
| Shopify | heydiga, GuruSup · E-commerce | `int-shopify` (M3, lote B, planned) | Plataforma | `shopify` |
| Quiter | heydiga | `int-quiter` (after, planned) | Socio, contrato o API del cliente | — |
| TallerGP | heydiga | `int-tallergp` (after, planned) | Socio, contrato o API del cliente | — |
| Salesforce | heydiga, GuruSup · CRM | `int-salesforce` (after, planned) | Plataforma | `salesforce` |
| HubSpot | heydiga, GuruSup · Canales | `int-hubspot` (M2, lote A, planned) | Plataforma | `hubspot` |
| Pipedrive | heydiga, GuruSup · CRM | `int-pipedrive` (M3, lote B, planned) | Plataforma | `pipedrive` |
| Doctoralia | heydiga | `int-doctoralia` (after, planned) | Fuera (decisión 15) | — |
| Clinic Cloud | heydiga | `int-cliniccloud` (after, planned) | Fuera (decisión 15) | — |
| Gesden | heydiga | `int-gesden` (after, planned) | Fuera (decisión 15) | — |
| Dentalink | heydiga | `int-dentalink` (after, planned) | Fuera (decisión 15) | — |
| Inmovilla | heydiga | `int-inmovilla` (after, planned) | Socio, contrato o API del cliente | — |
| Witei | heydiga | `int-witei` (after, planned) | Socio, contrato o API del cliente | — |
| Idealista | heydiga | `int-idealista` (after, planned) | Socio, contrato o API del cliente | — |
| Fotocasa | heydiga | `int-fotocasa` (after, planned) | Socio, contrato o API del cliente | — |
| Gesfincas | heydiga | `int-gesfincas` (after, planned) | Socio, contrato o API del cliente | — |
| Avantio | heydiga | `int-avantio` (after, planned) | Socio, contrato o API del cliente | — |
| Google Calendar | heydiga, GuruSup · Productividad | `int-googlecalendar` (M2, lote A, planned) | Nativa | `google-calendar` |

### GuruSup, sin las que ya salen en heydiga (139)

| Sistema | Lo anuncian | Unidad en `scope.yaml` | Cómo | Conector de Nango |
|---|---|---|---|---|
| Freshdesk | GuruSup · Canales | `int-freshdesk` (after, planned) | Plataforma | `freshdesk` |
| Intercom | GuruSup · Canales | `int-intercom` (M4, lote C, planned) | Plataforma | `intercom` |
| Zendesk | GuruSup · Canales | `int-zendesk` (M4, lote C, planned) | Plataforma | `zendesk` |
| Gmail | GuruSup · Canales | `int-gmail` (M2, lote A, planned) | Plataforma | `google-mail` |
| Icnea | GuruSup · Canales | — | Socio, contrato o API del cliente | — |
| Outlook | GuruSup · Canales | `int-microsoftoutlook` (M2, lote A, planned) | Nativa | `outlook` |
| WhatsApp | GuruSup · Canales | `ch-whatsapp` (M1, blocked) | Nativa | `whatsapp-business` |
| Instagram | GuruSup · Canales | `ch-instagram` (stretch, planned) | Plataforma | `instagram` |
| Airtable | GuruSup · Productividad | `int-airtable` (M4, lote C, planned) | Plataforma | `airtable` |
| Asana | GuruSup · Productividad | `int-asana` (after, planned) | Plataforma | `asana` |
| CalendarHero | GuruSup · Productividad | — | Socio, contrato o API del cliente | — |
| ClickUp | GuruSup · Productividad | `int-clickup` (after, planned) | Plataforma | `clickup` |
| Coda | GuruSup · Productividad | — | Plataforma | `coda` |
| Excel | GuruSup · Productividad | `int-microsoftexcel` (after, planned) | Plataforma | `microsoft-excel` |
| Google Docs | GuruSup · Productividad | `int-googledocs` (after, planned) | Plataforma | `google-docs` |
| Google Sheets | GuruSup · Productividad | `int-googlesheets` (M3, lote B, planned) | Plataforma | `google-sheet` |
| Google Slides | GuruSup · Productividad | `int-googleslides` (after, planned) | Plataforma | `google-slides` |
| Google Tasks | GuruSup · Productividad | `int-googletasks` (after, planned) | Plataforma | `google-tasks` |
| Harvest | GuruSup · Productividad | — | Plataforma | `harvest` |
| Jira | GuruSup · Productividad | `int-jira` (after, planned) | Plataforma | `jira` |
| Linear | GuruSup · Productividad | `int-linear` (after, planned) | Plataforma | `linear` |
| LinkHut | GuruSup · Productividad | — | Plataforma | `linkhut` |
| Monday | GuruSup · Productividad | `int-mondaydotcom` (after, planned) | Plataforma | `monday` |
| Notion | GuruSup · Productividad | `int-notion` (M2, lote A, planned) | Plataforma | `notion` |
| OnePage | GuruSup · Productividad | — | Socio, contrato o API del cliente | — |
| Pushbullet | GuruSup · Productividad | — | Socio, contrato o API del cliente | — |
| Slack | GuruSup · Productividad | `int-slack` (M2, lote A, planned) | Plataforma | `slack` |
| TickTick | GuruSup · Productividad | — | Plataforma | `ticktick` |
| Timely | GuruSup · Productividad | — | Plataforma | `timely` |
| Todoist | GuruSup · Productividad | `int-todoist` (after, planned) | Plataforma | `todoist` |
| Trello | GuruSup · Productividad | `int-trello` (after, planned) | Plataforma | `trello` |
| Wrike | GuruSup · Productividad | — | Plataforma | `wrike` |
| Cal.com | GuruSup · Productividad | `int-calcom` (M3, lote B, planned) | Plataforma | `cal-com-oauth` |
| Calendly | GuruSup · Productividad | `int-calendly` (M3, lote B, planned) | Plataforma | `calendly` |
| DocuSign | GuruSup · Productividad | `int-docusign` (after, planned) | Plataforma | `docusign` |
| Dropbox | GuruSup · Productividad | `int-dropbox` (M4, lote C, planned) | Plataforma | `dropbox` |
| Google Drive | GuruSup · Productividad | `int-googledrive` (M2, lote A, planned) | Plataforma | `google-drive` |
| Google Photos | GuruSup · Productividad | — | Socio, contrato o API del cliente | — |
| OneDrive | GuruSup · Productividad | `int-microsoftonedrive` (M3, lote B, planned) | Plataforma | `one-drive` |
| PandaDoc | GuruSup · Productividad | — | Plataforma | `pandadoc` |
| QuickBooks | GuruSup · Finanzas | `int-quickbooks` (M4, lote C, planned) | Plataforma | `quickbooks` |
| Ramp | GuruSup · Finanzas | — | Plataforma | `ramp` |
| RecallAI | GuruSup · Finanzas | — | Plataforma | `recall-ai` |
| Stripe | GuruSup · Finanzas | `int-stripe` (M2, lote A, planned) | Nativa | `stripe` |
| Xero | GuruSup · Finanzas | `int-xero` (M4, lote C, planned) | Plataforma | `xero` |
| Zoho Invoice | GuruSup · Finanzas | — | Plataforma | `zoho-invoice` |
| Bannerbear | GuruSup · Automatización | — | Plataforma | `bannerbear` |
| Formsite | GuruSup · Automatización | — | Socio, contrato o API del cliente | — |
| Make | GuruSup · Automatización | `int-make` (M2, lote A, planned) | Plataforma | `make` |
| Process Street | GuruSup · Automatización | — | Socio, contrato o API del cliente | — |
| ServiceM8 | GuruSup · Automatización | — | Plataforma | `servicem8` |
| Workiom | GuruSup · Automatización | — | Socio, contrato o API del cliente | — |
| n8n | GuruSup · Automatización | `int-n8n` (M3, lote B, planned) | Plataforma | `n8n` |
| Zapier | GuruSup · Automatización | `int-zapier` (M2, lote A, planned) | Plataforma | `zapier` |
| Chatwork | GuruSup · Comunicación | — | Socio, contrato o API del cliente | — |
| Dialpad | GuruSup · Comunicación | — | Plataforma | `dialpad` |
| Discordbot | GuruSup · Comunicación | `int-discord` (stretch, planned) | Plataforma | `discord-bot` |
| Echtpost | GuruSup · Comunicación | — | Socio, contrato o API del cliente | — |
| Google Meet | GuruSup · Comunicación | `int-googlemeet` (after, planned) | Plataforma | `google-meet` |
| Microsoft Teams | GuruSup · Comunicación | `int-microsoftteams` (after, planned) | Plataforma | `microsoft-teams` |
| RetellAI | GuruSup · Comunicación | — | Plataforma | `retell-ai` |
| SharePoint | GuruSup · Comunicación | — | Plataforma | `sharepoint-online` |
| Slackbot | GuruSup · Comunicación | `int-slack` (M2, lote A, planned) | Plataforma | `slack` |
| Stack Exchange | GuruSup · Comunicación | — | Plataforma | `stackexchange` |
| Webex | GuruSup · Comunicación | `int-webex` (after, planned) | Plataforma | `webex` |
| Zoom | GuruSup · Comunicación | `int-zoom` (M3, lote B, planned) | Plataforma | `zoom` |
| Anthropic | GuruSup · IA | `int-anthropic` (after, planned) | Proveedor de modelos (enrutador) | `anthropic` |
| Gemini | GuruSup · IA | `int-googlegemini` (after, planned) | Proveedor de modelos (enrutador) | `google-gemini` |
| HeyGen | GuruSup · IA | `int-heygen` (after, planned) | Plataforma | `heygen` |
| Humanloop | GuruSup · IA | — | Socio, contrato o API del cliente | — |
| LMNT | GuruSup · IA | — | Socio, contrato o API del cliente | — |
| Mem0 | GuruSup · IA | — | Socio, contrato o API del cliente | — |
| OpenAI | GuruSup · IA | `int-openai` (after, planned) | Proveedor de modelos (enrutador) | `openai` |
| Perplexity AI | GuruSup · IA | `int-perplexity` (after, planned) | Proveedor de modelos (enrutador) | `perplexity` |
| Semantic Scholar | GuruSup · IA | — | Socio, contrato o API del cliente | — |
| TextRazor | GuruSup · IA | — | Socio, contrato o API del cliente | — |
| Typefully | GuruSup · IA | — | Plataforma | `typefully` |
| Apaleo | GuruSup · Otros | — | Plataforma | `apaleo` |
| Canvas | GuruSup · Otros | — | Plataforma | `canvas-lms` |
| D2L Brightspace | GuruSup · Otros | — | Socio, contrato o API del cliente | — |
| More Trees | GuruSup · Otros | — | Socio, contrato o API del cliente | — |
| ActiveCampaign | GuruSup · CRM | `int-activecampaign` (after, planned) | Plataforma | `active-campaign` |
| Ahrefs | GuruSup · CRM | — | Plataforma | `ahrefs` |
| AMCards | GuruSup · CRM | — | Socio, contrato o API del cliente | — |
| Apollo | GuruSup · CRM | — | Plataforma | `apollo` |
| Attio | GuruSup · CRM | — | Plataforma | `attio` |
| Brandfetch | GuruSup · CRM | — | Plataforma | `brandfetch` |
| CrustData | GuruSup · CRM | — | Plataforma | `crustdata` |
| Dynamics365 | GuruSup · CRM | `int-dynamics365` (after, planned) | Plataforma | `microsoft-dataverse` |
| Eventbrite | GuruSup · CRM | — | Plataforma | `eventbrite` |
| Klaviyo | GuruSup · CRM | `int-klaviyo` (after, planned) | Plataforma | `klaviyo` |
| Mailchimp | GuruSup · CRM | `int-mailchimp` (M3, lote B, planned) | Plataforma | `mailchimp` |
| SendPulse | GuruSup · CRM | — | Socio, contrato o API del cliente | — |
| Zoho | GuruSup · CRM | `int-zoho` (M3, lote B, planned) | Plataforma | `zoho` |
| BaseLinker | GuruSup · E-commerce | — | Socio, contrato o API del cliente | — |
| CloudCart | GuruSup · E-commerce | — | Socio, contrato o API del cliente | — |
| Gumroad | GuruSup · E-commerce | — | Plataforma | `gumroad` |
| Jungle Scout | GuruSup · E-commerce | — | Socio, contrato o API del cliente | — |
| Lemon Squeezy | GuruSup · E-commerce | — | Socio, contrato o API del cliente | — |
| Payhip | GuruSup · E-commerce | — | Socio, contrato o API del cliente | — |
| Amplitude | GuruSup · Analítica | — | Plataforma | `amplitude` |
| BrowseAI | GuruSup · Analítica | — | Plataforma | `browseai` |
| Exa | GuruSup · Analítica | — | Plataforma | `exa` |
| Firecrawl | GuruSup · Analítica | — | Plataforma | `firecrawl` |
| Fireflies | GuruSup · Analítica | — | Plataforma | `fireflies` |
| Google Analytics | GuruSup · Analítica | `int-googleanalytics` (after, planned) | Plataforma | `google-analytics` |
| Google BigQuery | GuruSup · Analítica | — | Plataforma | `google-bigquery` |
| Kibana | GuruSup · Analítica | — | Socio, contrato o API del cliente | — |
| Microsoft Clarity | GuruSup · Analítica | — | Plataforma | `microsoft-clarity` |
| Mixpanel | GuruSup · Analítica | — | Plataforma | `mixpanel` |
| PeopleDataLabs | GuruSup · Analítica | — | Plataforma | `peopledatalabs` |
| Placekey | GuruSup · Analítica | — | Socio, contrato o API del cliente | — |
| PostHog | GuruSup · Analítica | — | Plataforma | `posthog` |
| ServiceNow | GuruSup · Analítica | — | Plataforma | `servicenow` |
| Snowflake | GuruSup · Analítica | — | Plataforma | `snowflake` |
| Tavily | GuruSup · Analítica | — | Plataforma | `tavily` |
| TinyURL | GuruSup · Marketing | — | Plataforma | `tinyurl` |
| YouTube | GuruSup · Marketing | `int-youtube` (after, planned) | Plataforma | `youtube` |
| Canva | GuruSup · Marketing | `int-canva` (after, planned) | Plataforma | `canva` |
| Figma | GuruSup · Marketing | `int-figma` (after, planned) | Plataforma | `figma` |
| LinkedIn | GuruSup · Marketing | `int-linkedin` (after, planned) | Plataforma | `linkedin` |
| Miro | GuruSup · Marketing | `int-miro` (after, planned) | Plataforma | `miro` |
| Mural | GuruSup · Marketing | — | Plataforma | `mural` |
| Reddit | GuruSup · Marketing | — | Plataforma | `reddit` |
| Webflow | GuruSup · Marketing | `int-webflow` (after, planned) | Plataforma | `webflow` |
| Foursquare | GuruSup · Desarrollo | — | Socio, contrato o API del cliente | — |
| Google Maps | GuruSup · Desarrollo | `int-googlemaps` (after, planned) | Plataforma | `google-maps` |
| LinkUp | GuruSup · Desarrollo | — | Plataforma | `linkup` |
| YouSearch | GuruSup · Desarrollo | — | Socio, contrato o API del cliente | — |
| Ably | GuruSup · Desarrollo | — | Socio, contrato o API del cliente | — |
| Baserow | GuruSup · Desarrollo | — | Plataforma | `baserow` |
| Bitbucket | GuruSup · Desarrollo | — | Plataforma | `bitbucket` |
| Contentful | GuruSup · Desarrollo | — | Plataforma | `contentful` |
| GitHub | GuruSup · Desarrollo | — | Plataforma | `github` |
| Ngrok | GuruSup · Desarrollo | — | Socio, contrato o API del cliente | — |
| PagerDuty | GuruSup · Desarrollo | — | Plataforma | `pagerduty` |
| Sentry | GuruSup · Desarrollo | — | Plataforma | `sentry` |
| Supabase | GuruSup · Desarrollo | — | Plataforma | `supabase` |
| ZenRows | GuruSup · Desarrollo | — | Socio, contrato o API del cliente | — |
