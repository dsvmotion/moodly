# Política de seguridad

## Cómo informar de una vulnerabilidad
Escríbenos a **contact@moodly.com** con:
- qué has encontrado y dónde (URL, pantalla o componente);
- los pasos para reproducirlo;
- el impacto que crees que tiene.

No abras un issue público ni lo compartas hasta que lo hayamos corregido. Respondemos en menos de 3 días laborables y te mantenemos informado hasta el arreglo.

## En qué punto está el proyecto
Estamos en preproducción:
- no hay entorno de producción ni datos reales de clientes;
- la aplicación (`apps/web`) y el worker corren solo en staging, con datos de prueba;
- la web pública incluye un prototipo navegable (`/plataforma`) con datos ficticios, que no es el producto.

## Qué cubre
La plataforma (`apps/web`), el worker, la base de datos y la web pública. Quedan fuera: ataques de denegación de servicio, ingeniería social y servicios de terceros (Supabase, Vercel, Railway, Meta…), que se reportan a cada proveedor.

## Mientras investigas
Usa solo cuentas propias o de prueba, no accedas a datos de otros clientes ni los modifiques, y para en cuanto confirmes el problema. Si actúas de buena fe y con estas reglas, no emprenderemos acciones contra ti.

## Cómo protegemos la plataforma
Lo que hay hoy:
- aislamiento por cliente en la base de datos (RLS en todas las tablas, con tests que fallan si falta una política);
- MFA obligatorio para administrar una organización;
- cabeceras de seguridad y CSP en la aplicación;
- dependencias auditadas (`pnpm audit`) y búsqueda de secretos (gitleaks) en cada PR;
- una guarda de mergeo que impide mergear un PR que debilita o borra tests.

**Lo que todavía no hay:** revisión humana obligatoria de los cambios, ni siquiera de los sensibles (migraciones, políticas RLS, auth, la guarda). Volverá antes de que entre el primer dato real de un cliente; es condición de salida a producción (`docs/STATUS.md`).

Más detalle: `docs/audits/2026-10-20-seguridad-cimientos.md` y la auditoría de preproducción (`docs/audits/2026-11-10-auditoria-preproduccion.md`).
