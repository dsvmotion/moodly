# Nombres de los verticales: marketing + SEO

Fecha: 2026-10-07 · Estado: **PROPUESTO**.

Fuente de los datos: autocompletado de Google en España, EE. UU., Francia y Alemania
(`suggestqueries.google.com`), consultado el 7 oct 2026. El autocompletado refleja
búsquedas frecuentes, **no volúmenes**. Antes de lanzar páginas, validar con una
herramienta de volumen (Google Keyword Planner, Semrush o Ahrefs).

## 1. Hallazgo principal

En los cuatro idiomas, la gente busca por **tipo de negocio** y casi nunca por el nombre
del sector:

| Se busca (autocompletado) | Apenas se busca |
|---|---|
| ia para clínicas (dentales, estéticas, fisioterapia, veterinarias) | «salud y belleza» |
| agente ia para restaurantes · chatbot whatsapp para restaurantes · software hostelería | «hospitality» en español |
| ia para inmobiliarias · agente ia para inmobiliarias | «sector inmobiliario» |
| ia para despachos (abogados, contables, fiscales) · ia para asesorías / gestorías | «servicios profesionales» |
| ia para ecommerce · ia para tiendas online · ia para comercios | «retail» |
| ia para reformas · ia para instaladores eléctricos | «servicios técnicos», «field services» |
| ia para talleres mecánicos · ia para concesionarios | «automoción» |
| ia para academias · ia para gimnasios | «educación y fitness» |
| recepcionista virtual (ia, hotel) · chatbot whatsapp para agendar citas | — |

En otros idiomas:
- **EN:** *ai receptionist for small business / dental office / law firms / salons*,
  *ai for home services*, *ai for hospitality*, *ai for car dealerships*.
- **FR:** *ia pour cabinet dentaire / d'avocat / comptable*, *ia pour agence immobilière*,
  *ia pour garage automobile*, *ia pour artisan*.
- **DE:** *KI für Handwerker* (incluido *KI-Telefonassistent für Handwerker*),
  *KI für Kanzleien*, *KI für Autohaus*, *KI für Gastronomie*, *KI für Praxis*,
  *KI für Immobilienmakler*, *KI für Fitnessstudios*.

## 2. Nombres elegidos

En el menú y en las pestañas, el nombre es el del negocio que busca la gente. Debajo, una
línea con la palabra clave.

| id | ES | EN | FR | DE |
|---|---|---|---|---|
| salud | Clínicas y belleza | Clinics & Salons | Cliniques et instituts | Praxen & Studios |
| hosteleria | Hostelería y turismo | Hospitality | Hôtellerie-restauration | Gastronomie & Hotellerie |
| inmobiliario | Inmobiliarias | Real Estate | Immobilier | Immobilien |
| profesionales | Despachos y asesorías | Professional Services | Cabinets et conseil | Kanzleien & Beratung |
| retail | Tiendas y ecommerce | Retail & Ecommerce | Commerce et e-commerce | Handel & E-Commerce |
| hogar | Reformas y servicios técnicos | Home Services | Artisans et dépannage | Handwerk |
| automocion | Talleres y concesionarios | Auto Dealers & Repair | Garages et concessions | Autohaus & Werkstatt |
| educacion | Academias y gimnasios | Schools & Gyms | Écoles et salles de sport | Schulen & Fitnessstudios |

Dónde se cambian:
- ES: `apps/site/src/components/verticals.js` (`name` y `kw`).
- EN, FR y DE: `site-data.js` (`T.verticals`).

## 3. Siguiente paso SEO: una página por subsector

La estructura **Vertical → Subsector** permite páginas de intención alta. Propuesta de
rutas, empezando por ES:

| Ruta | Palabra clave principal |
|---|---|
| /es/ia-para-clinicas-dentales | ia para clínicas dentales |
| /es/ia-para-clinicas-esteticas | ia para clínicas estéticas |
| /es/agente-ia-restaurantes | agente ia para restaurantes / chatbot whatsapp para restaurantes |
| /es/recepcionista-virtual-hotel | recepcionista virtual hotel |
| /es/ia-para-inmobiliarias | ia para inmobiliarias |
| /es/ia-para-asesorias | ia para asesorías fiscales / gestorías |
| /es/ia-para-despachos-de-abogados | ia para despachos de abogados |
| /es/ia-para-ecommerce | ia para ecommerce / tiendas online |
| /es/ia-para-reformas | ia para reformas |
| /es/ia-para-talleres-mecanicos | ia para talleres mecánicos |
| /es/ia-para-concesionarios | ia para concesionarios |
| /es/ia-para-academias | ia para academias |
| /es/ia-para-gimnasios | ia para gimnasios |

Y transversales:
- /es/chatbot-whatsapp-para-agendar-citas
- /es/recepcionista-virtual-ia

En DE, prioridad a **/de/ki-telefonassistent-handwerker** (búsqueda muy específica).

Cada página reutiliza los datos del vertical (`verticals.js`) con un H1, un título y una
descripción propios, y enlaza de vuelta a `/sectores#id`.
