/** Callback registrado pelo AuthProvider quando a API devolve HTTP 401 com Bearer enviado. */
let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export function clearUnauthorizedHandler() {
  onUnauthorized = null;
}

export function notifyUnauthorizedFromApi() {
  onUnauthorized?.();
}