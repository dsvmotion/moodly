// Buzón de contacto de la web pública: el mismo de SECURITY.md y de
// public/.well-known/security.txt (F14, decisión de producto del 2026-11-10).
// Los textos lo toman de aquí con el hueco {email}; nunca se escribe a mano.
export const CONTACT_EMAIL = "contact@moodly.com";

export const withContact = (text) => text.replaceAll("{email}", CONTACT_EMAIL);

/** Enlace mailto: al buzón de contacto, con asunto y cuerpo ya escritos. */
export const mailtoContact = (subject, body) =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

// Formularios de la web (auditoría 2026-11-10, N-02): hasta que haya un endpoint de
// leads (M1), la web no recibe ni guarda nada. Un formulario válido abre el programa
// de correo de la persona con el mensaje escrito, y lo dice; nunca un «gracias, te
// escribimos» por un envío que no ha ido a ningún sitio.
export const FORM_TEXT = {
  es: { invalidEmail: "Escribe un email válido.", opened: "Hemos abierto tu programa de correo con el mensaje: envíalo desde ahí. Esta web todavía no recibe formularios ni guarda tus datos. Si no se ha abierto, escríbenos a {email}.", demoSubject: "Quiero una demo de Moodly", demoBody: "Hola, quiero ver una demo de Moodly. Mi email de trabajo es: " },
  en: { invalidEmail: "Enter a valid email.", opened: "We opened your email app with the message: send it from there. This website does not receive forms or store your data yet. If it did not open, write to us at {email}.", demoSubject: "I would like a Moodly demo", demoBody: "Hi, I would like to see a Moodly demo. My work email is: " },
  fr: { invalidEmail: "Saisissez un e-mail valide.", opened: "Nous avons ouvert votre messagerie avec le message : envoyez-le depuis celle-ci. Ce site ne reçoit pas encore de formulaires et ne conserve pas vos données. Si elle ne s'est pas ouverte, écrivez-nous à {email}.", demoSubject: "Je souhaite une démo de Moodly", demoBody: "Bonjour, je souhaite voir une démo de Moodly. Mon e-mail professionnel : " },
  de: { invalidEmail: "Gib eine gültige E-Mail-Adresse ein.", opened: "Wir haben dein E-Mail-Programm mit der Nachricht geöffnet: Sende sie von dort. Diese Website empfängt noch keine Formulare und speichert deine Daten nicht. Falls es sich nicht geöffnet hat, schreib uns an {email}.", demoSubject: "Ich möchte eine Moodly-Demo", demoBody: "Hallo, ich möchte eine Moodly-Demo sehen. Meine geschäftliche E-Mail: " },
};
