# Certificados del worker

`supabase-prod-ca-2021.crt`: CA de Supabase (pública), del panel del proyecto
(Database → Settings → SSL Configuration → Download certificate). El worker la
usa para verificar el certificado del pooler (`sslmode=verify-full` y
`sslrootcert` en `WORKER_SYSTEM_DATABASE_URL`), en Railway y en el workflow
«Staging · worker».
