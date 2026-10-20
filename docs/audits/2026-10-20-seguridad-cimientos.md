# Revisión de seguridad de los cimientos — 2026-10-20

Objetivo (producto): dejar los cimientos a nivel de seguridad enterprise antes de construir el producto encima.

Alcance:
- `apps/web`: auth, proxy, Server Actions, cabeceras y PWA;
- `packages/db`: RLS, guardas, funciones `SECURITY DEFINER` y configuración de Auth;
- CI y cadena de suministro;
- dependencias;
- secretos en el historial.

Método: lectura del código y la configuración, `pnpm audit` y gitleaks sobre los 74 commits. Cada arreglo lleva sus tests y, cuando ha sido posible, una prueba en negativo.

## Lo que ya estaba bien
- **Aislamiento por cliente** con RLS activado y forzado en las 5 tablas de tenants:
  - 186 tests pgTAP;
  - guardas `guard_*` en lista blanca;
  - `SECURITY DEFINER` solo en helpers de lectura, todos con `search_path = ''` y `revoke … from public`;
  - mínimo privilegio para `authenticated` y nada para `anon`.
- **Revocación real de sesiones:** `private.session_is_active()` en todas las políticas. Un JWT copiado deja de servir al cerrar sesión.
- **Auth en `apps/web`:**
  - `getUser()` en la capa de datos y `getClaims()` solo para la redirección optimista; nunca `getSession()`;
  - `safeNextPath()` contra redirecciones abiertas, probado con 7 vectores;
  - mensaje de error genérico en el login;
  - registro público cerrado.
- **Navegador:** solo habla con la app. No recibe la service role ni ninguna clave secreta (test e2e).
- **Service worker:** nunca guarda páginas ni datos del tenant.
- **Proceso:** guarda de mergeo con zonas sensibles y revisión humana por commit.

## Hallazgos y arreglos

| # | Hallazgo | Gravedad | Arreglo |
|---|---|---|---|
| 1 | Next 16.3.6: SSRF en la optimización de imágenes y envenenamiento de caché (8 avisos de `pnpm audit`, 2 altos) | Alta | **#28**: Next 16.3.8 y `overrides` de las dependencias indirectas. Audit limpio |
| 2 | Sin cabeceras de seguridad: la app se podía incrustar en un iframe (clickjacking) y no había CSP | Alta | **#29**: CSP con nonce y `strict-dynamic`, HSTS, `X-Frame-Options`, nosniff, COOP/CORP, `Referrer-Policy` y `Permissions-Policy` |
| 3 | MFA desactivado | Alta | **#30**: TOTP activado. Exigirlo por rol: siguiente paso, punto A |
| 4 | Contraseñas sin requisitos de composición; el cambio de contraseña no pedía haber entrado hace poco | Media | **#30**: minúscula, mayúscula y dígito (12 caracteres) y `secure_password_change` |
| 5 | Sesiones sin límite de inactividad ni duración máxima | Media | **#30**: 12 h sin actividad y 7 días como máximo |
| 6 | GitHub Actions fijadas por etiqueta, que puede moverse a otro código | Media | **#31**: fijadas al commit |
| 7 | Sin revisión automática de dependencias ni de secretos en CI | Media | **#31**: `pnpm audit` y gitleaks en cada PR (check obligatorio) y Dependabot con *cooldown* de 14 días |
| 8 | Sin política de divulgación ni dueños de código | Baja | **#31**: `SECURITY.md` y `CODEOWNERS` |

## Lo que falta para «nivel enterprise», por prioridad

### A. Antes del primer cliente real (lo hago yo; zonas sensibles, con tu revisión)
1. **Exigir MFA (AAL2) por rol:**
   - pantalla de alta del TOTP y paso extra en el login;
   - obligatorio para dueño, administración y equipo interno;
   - RLS que compruebe `aal2` para escribir en datos sensibles.
2. **Registro de auditoría** (#16 y los PRs de `/ops`): quién hizo qué y cuándo, solo de inserción. También entradas y salidas: Supabase ya guarda `auth.audit_log_entries`; falta exponerlo.
3. **Protección contra fuerza bruta:**
   - CAPTCHA en el login (Cloudflare Turnstile, gratis; necesita que crees la cuenta y me des la clave del sitio);
   - aviso al usuario tras varios intentos fallidos.
4. **Monitorización y alertas:** errores de servidor y eventos de seguridad (Sentry u otro, con alojamiento en la UE).
5. **Gestión de secretos en producción:** variables cifradas en el proveedor de despliegue, rotación documentada y la service role solo en el worker.

### B. Decisiones de plan (solo tú)
- **GitHub Free en repo privado:** sin protección de rama, la regla «nada entra en `main` sin CI verde y revisión» depende solo del proceso. GitHub Team la convierte en una regla que GitHub hace cumplir.
- **Supabase Free:**
  - sin copias de seguridad diarias ni restauración a un momento concreto (PITR);
  - el proyecto se pausa si no se usa;
  - los límites de sesión del punto 5 no se aplican en alojado.
  - Antes de datos reales: plan Pro y región UE.

### C. Para vender a empresas grandes (más adelante)
- Pentest externo antes del primer cliente enterprise.
- Políticas escritas: respuesta a incidentes, retención y borrado de datos (RGPD), gestión de accesos del equipo y continuidad.
- SSO SAML para los clientes (está diseñado en el prototipo).
- Cifrado con clave por cliente para BYOK (ADR 0019, KMS).
- Ruta de certificación: ISO 27001 o SOC 2. Supabase y Vercel aportan sus informes; el resto lo ponemos nosotros.

## Orden de merge propuesto
1. #28 (dependencias).
2. #29 (cabeceras).
3. #30 (Auth).
4. #31 (cadena de suministro). Su check de `pnpm audit` necesita que #28 esté dentro.

Todos tocan zonas sensibles: los revisas y mergeas tú.
