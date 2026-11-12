// Buzón de contacto de la web pública: el mismo de SECURITY.md y de
// public/.well-known/security.txt (F14, decisión de producto del 2026-11-10).
// Los textos lo toman de aquí con el hueco {email}; nunca se escribe a mano.
export const CONTACT_EMAIL = "contact@moodly.com";

export const withContact = (text) => text.replaceAll("{email}", CONTACT_EMAIL);
