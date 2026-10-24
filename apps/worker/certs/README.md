# Certificados del worker

`supabase-prod-ca-2021.crt`: CA de Supabase (pública), del panel del proyecto
(Database → Settings → SSL Configuration → Download certificate). El worker la
usa para verificar el certificado del pooler (`sslmode=verify-full` y
`sslrootcert` en `WORKER_SYSTEM_DATABASE_URL`), en Railway y en el workflow
«Staging · worker».

Comprobación: `openssl x509 -in supabase-prod-ca-2021.crt -noout -subject -dates -fingerprint -sha256`
debe dar `CN = Supabase Root 2021 CA`, válida hasta el 26/04/2031, con SHA-256
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
Antes de esa fecha hay que sustituirla por la que publique Supabase.
