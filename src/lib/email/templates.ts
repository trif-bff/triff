/**
 * Transactional email templates (pure). Spanish, plain and accessible:
 * HTML + text alternative, no tracking pixels, no external images.
 * User-provided values (names) are HTML-escaped.
 */
export type EmailContent = { subject: string; html: string; text: string };

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function safeUrl(url: string) {
  const u = new URL(url); // throws on garbage
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("URL no permitida");
  return u.toString();
}

function layout(title: string, body: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f7f5f0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1b1a2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e3ded3;border-radius:16px;padding:32px">
<tr><td style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#4f46c8;padding-bottom:16px">Triff</td></tr>
<tr><td style="font-size:16px;line-height:1.6">${body}</td></tr>
<tr><td style="padding-top:24px;font-size:12px;line-height:1.5;color:#6e6b80">Has recibido este correo porque se ha usado esta dirección en Triff. Si no has sido tú, puedes ignorarlo.</td></tr>
</table></td></tr></table></body></html>`;
}

function button(url: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#4f46c8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600">${escapeHtml(label)}</a></p>
<p style="font-size:13px;color:#6e6b80">Si el botón no funciona, copia este enlace en tu navegador:<br><span style="word-break:break-all">${escapeHtml(url)}</span></p>`;
}

const hello = (name: string) => `Hola, ${escapeHtml(name.split(" ")[0] || name)}:`;

export function resetPasswordEmail(opts: { name: string; url: string; minutes: number }): EmailContent {
  const url = safeUrl(opts.url);
  return {
    subject: "Restablece tu contraseña de Triff",
    html: layout("Restablece tu contraseña", `<p>${hello(opts.name)}</p><p>Hemos recibido una solicitud para restablecer tu contraseña.</p>${button(url, "Crear una contraseña nueva")}<p>El enlace caduca en ${opts.minutes} minutos y solo se puede usar una vez. Al cambiarla se cerrarán tus sesiones abiertas.</p>`),
    text: `${hello(opts.name)}\n\nHemos recibido una solicitud para restablecer tu contraseña de Triff.\n\nCrea una contraseña nueva aquí (caduca en ${opts.minutes} minutos, un solo uso):\n${url}\n\nSi no has sido tú, ignora este correo: tu contraseña no cambiará.`,
  };
}

export function verifyEmailEmail(opts: { name: string; url: string }): EmailContent {
  const url = safeUrl(opts.url);
  return {
    subject: "Confirma tu correo en Triff",
    html: layout("Confirma tu correo", `<p>${hello(opts.name)}</p><p>Confirma que este es tu correo para poder recuperar tu cuenta si olvidas la contraseña.</p>${button(url, "Confirmar mi correo")}`),
    text: `${hello(opts.name)}\n\nConfirma tu correo en Triff abriendo este enlace:\n${url}\n\nSi no te has registrado en Triff, ignora este correo.`,
  };
}

export function passwordChangedEmail(opts: { name: string; when: Date; supportUrl: string }): EmailContent {
  const when = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Madrid" }).format(opts.when);
  const support = safeUrl(opts.supportUrl);
  return {
    subject: "Tu contraseña de Triff ha cambiado",
    html: layout("Contraseña cambiada", `<p>${hello(opts.name)}</p><p>La contraseña de tu cuenta se cambió el ${escapeHtml(when)} y se cerraron todas tus sesiones.</p><p><strong>Si no has sido tú</strong>, restablece tu contraseña de inmediato desde <a href="${escapeHtml(support)}" style="color:#4f46c8">${escapeHtml(support)}</a>.</p>`),
    text: `${hello(opts.name)}\n\nLa contraseña de tu cuenta de Triff se cambió el ${when} y se cerraron todas tus sesiones.\n\nSi no has sido tú, restablécela de inmediato: ${support}`,
  };
}
