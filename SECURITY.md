# Política de seguridad

## Cómo informar de una vulnerabilidad
Escríbenos a **dsv.motion@gmail.com** con:
- qué has encontrado y dónde (URL, pantalla o componente);
- los pasos para reproducirlo;
- el impacto que crees que tiene.

No abras un issue público ni lo compartas hasta que lo hayamos corregido. Respondemos en menos de 3 días laborables y te mantenemos informado hasta el arreglo.

## Qué cubre
La plataforma (`apps/web`), el worker, la base de datos y la web pública. Quedan fuera: ataques de denegación de servicio, ingeniería social y servicios de terceros (Supabase, Vercel, Meta…), que se reportan a cada proveedor.

## Mientras investigas
Usa solo cuentas propias o de prueba, no accedas a datos de otros clientes ni los modifiques, y para en cuanto confirmes el problema. Si actúas de buena fe y con estas reglas, no emprenderemos acciones contra ti.

## Cómo protegemos la plataforma
Resumen en `docs/audits/2026-10-20-seguridad-cimientos.md`: aislamiento por cliente con RLS, cabeceras y CSP estricta, MFA, dependencias auditadas en cada PR, secretos detectados en CI y cambios sensibles con revisión humana.
