# Runbook: la app de Microsoft Entra ID para Outlook (calendario)

**Para quién:** producto (Diego), en el centro de administración de Microsoft Entra y en el panel de Nango.
**Por qué:** el calendario de Outlook / Microsoft 365 entra por Nango (ADR 0053, O-02). Nango necesita una app registrada en Microsoft Entra ID (antes Azure AD), con su id de cliente y su secreto. Sin ella, la integración «outlook» no existe en Nango y Outlook sigue bloqueado en `docs/STATUS.md`.
**Cuánto se tarda:** unos 20 minutos.
**Qué no hacer:** no pegues el secreto de cliente en el chat, en GitHub ni en el repositorio. Va directamente del centro de Entra al panel de Nango.

> Entorno: **Nango Cloud, entorno `dev`** (el mismo de Google Calendar). Producción tendrá su propia app y su propio secreto.

## 1. Registrar la app

1. Entra en el [centro de administración de Microsoft Entra](https://entra.microsoft.com) con una cuenta que sea al menos **Application Developer** del inquilino (tenant) de la empresa. Si tienes varios inquilinos, cambia al de Moodly con el icono de configuración de arriba.
2. **Applications → App registrations → New registration**.
3. **Name:** `Moodly staging · calendario`.
4. **Supported account types:** **Accounts in any organizational directory and personal Microsoft accounts** (multiinquilino y cuentas personales). Así pueden conectarlo tanto los negocios con Microsoft 365 como los que usan una cuenta de outlook.com.
   - Si producto prefiere solo Microsoft 365 de empresa, elige **Accounts in any organizational directory**. **No** elijas «this organizational directory only»: entonces solo entraría la cuenta de Moodly.
5. **Redirect URI:** déjalo vacío aquí (va en el paso 2).
6. **Register**.
7. En **Overview**, apunta el **Application (client) ID**. No es secreto.

## 2. La URI de redirección

1. En la app → **Authentication** → **Add a platform** → **Web**.
2. **Redirect URI:** `https://api.nango.dev/oauth/callback`
   - Es la de Nango Cloud, la misma que usa Google Calendar. Compruébala en el panel de Nango: al configurar la integración (paso 5), Nango enseña su **Callback URL**. Si no coinciden, manda la de Nango.
3. Deja sin marcar **Access tokens** e **ID tokens** (no usamos el flujo implícito).
4. En **Advanced settings**, deja **Allow public client flows** en **No**.
5. **Configure**.

## 3. Los permisos de Microsoft Graph (solo estos)

El worker solo lee las horas ocupadas del calendario (`GET /v1.0/me/calendarView`, ADR 0053 y `packages/integrations/src/platform/catalog.ts`). Hacen falta dos permisos **delegados**, y nada más:

| Permiso (Microsoft Graph, delegado) | Para qué |
|---|---|
| `Calendars.Read` | Leer los eventos del calendario de la persona que conecta |
| `offline_access` | Que Nango pueda renovar el token sin que la persona vuelva a entrar |

1. **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**.
2. Marca `Calendars.Read` (grupo Calendars) y `offline_access` (grupo OpenId permissions) → **Add permissions**.
3. **Quita `User.Read`**, que Entra añade por defecto: no lo usamos. En la fila → **…** → **Remove permission**.
   - Comprobado (2026-11-14): ni nuestro código ni Nango leen el perfil (`/me`) al conectar. El código solo llama a `/v1.0/me/calendarView` (`packages/integrations/src/calendar/outlook.ts`), que pide `Calendars.Read`. La definición del proveedor `outlook` de Nango (`GET /providers/outlook`) no tiene `post_connection_script` ni `proxy.verification`, así que Nango no hace ninguna llamada al conectar. Sus scopes por defecto (`offline_access` y `.default`) los sustituyen los del paso 5.
   - Si al probar la conexión real Microsoft o Nango piden `User.Read`, se añade (delegado, solo leer el perfil de quien conecta) y se apunta aquí por qué.
4. **Ninguno de permisos de aplicación** (application permissions): darían acceso a los calendarios de todo un inquilino sin una persona detrás.
5. No hace falta **Grant admin consent**: `Calendars.Read` delegado lo puede aceptar la propia persona. Algunas empresas exigen que su administrador lo apruebe. Entonces esa persona verá un aviso al conectar, y es el administrador de **su** empresa quien lo concede.

> **Editor verificado:** muchas empresas solo dejan que sus usuarios acepten apps de un editor verificado (publisher verification, con una cuenta de Microsoft Partner). Para probar en staging con una cuenta personal o de Moodly no hace falta. Para clientes reales, sí conviene, y es un paso aparte de producto.

## 4. El secreto de cliente

1. **Certificates & secrets** → **Client secrets** → **New client secret**.
2. **Description:** `nango-dev`. **Expires:** 12 meses. Apunta la fecha en el calendario del equipo para renovarlo antes (ver «Rotación»).
3. **Add**. Copia el **Value**, no el «Secret ID». Solo se enseña una vez. Pégalo **directamente** en Nango (paso 5) y no lo guardes en ningún otro sitio. Si se pierde, borra ese y crea otro.

## 5. La integración en Nango

1. [Panel de Nango](https://app.nango.dev) → entorno **dev** → **Integrations** → **Configure new integration** → **Outlook**.
2. **Integration ID (unique key):** `outlook`. Tiene que ser exactamente este: es el `integrationKey` que usa el código.
3. **Client ID:** el Application (client) ID del paso 1.7.
4. **Client Secret:** el valor del paso 4.3.
5. **Scopes:** `offline_access,Calendars.Read`. El código los pide igual al abrir la conexión, pero así queda claro también en el panel.
6. Activa **Forward webhooks** como en Google Calendar, para que el aviso de «conexión creada» llegue al worker (`/webhooks/nango`).
7. Guarda.

## 6. Comprobar (V15 lo hace contigo)

- Cuando la integración exista en Nango `dev`, avisa a V1. V15 lo comprueba por su lado: lista las integraciones de Nango `dev` (debe salir `outlook`, sin campos que falten).
- La prueba real es la misma que con Google:
  - conectar una cuenta de Outlook desde Ajustes → Integraciones de staging;
  - ver «Conectado» y el log del worker «integración conectada»;
  - poner una hora ocupada en ese calendario y ver que Recepción no la ofrece (Actions → «Staging · agente»).
- Hasta esa prueba, Outlook sigue **sin verificar en real** en `docs/STATUS.md`.

## Rotación del secreto

1. Antes de que caduque, crea un secreto nuevo (paso 4) **sin borrar el viejo**.
2. Cámbialo en Nango (integración `outlook` → Client Secret) y guarda.
3. Comprueba que una conexión de Outlook sigue leyendo el calendario (otra corrida de «Staging · agente»).
4. Borra el secreto viejo en Entra.

## Si se filtra el secreto

1. En Entra → **Certificates & secrets**, borra ese secreto.
2. Crea otro y ponlo en Nango (paso 5).
3. Avisa a V1. Los tokens de las personas que ya conectaron siguen en Nango, que es quien los guarda (ADR 0053). El secreto de cliente solo sirve para pedir tokens nuevos.
