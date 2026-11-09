/** Spanish messages for Better Auth error codes (the library returns English). */
const MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: "Ya existe una cuenta con ese correo. Prueba a entrar.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con ese correo. Prueba a entrar.",
  INVALID_EMAIL_OR_PASSWORD: "Correo o contraseña incorrectos.",
  INVALID_EMAIL: "El correo no es válido.",
  PASSWORD_TOO_SHORT: "La contraseña debe tener al menos 10 caracteres.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  // Returned when the session hook refuses a suspended account.
  FAILED_TO_CREATE_SESSION: "No se ha podido iniciar sesión. Si tu cuenta está suspendida, escribe a soporte.",
};

export function authErrorMessage(err: { code?: string; status?: number; message?: string } | null | undefined) {
  if (!err) return "No se ha podido completar la operación.";
  if (err.status === 429) return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
  return (err.code && MESSAGES[err.code]) || "No se ha podido completar la operación. Inténtalo de nuevo.";
}
