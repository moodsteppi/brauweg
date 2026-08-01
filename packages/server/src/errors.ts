/**
 * Fehler mit Schluessel statt Text.
 *
 * Der Client uebersetzt selbst. Deutsche Meldungen im Server waeren spaeter
 * nicht mehr herauszubekommen, und die Internationalisierung ist von Anfang an
 * ueber Schluessel vorgesehen.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly messageKey: string,
  ) {
    super(`${code}: ${messageKey}`);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, key = `error.${code}`) =>
  new AppError(400, code, key);
export const unauthorized = (code = 'unauthorized') =>
  new AppError(401, code, `error.${code}`);
export const forbidden = (code = 'forbidden') =>
  new AppError(403, code, `error.${code}`);
export const notFound = (code = 'notFound') =>
  new AppError(404, code, `error.${code}`);
export const conflict = (code: string) => new AppError(409, code, `error.${code}`);

/**
 * Regelsatz mit Widerspruechen. Traegt die Feldpfade des Moduls mit, damit der
 * Client die Meldung am jeweiligen Formularfeld anzeigen kann.
 */
export class RuleSetInvalidError extends AppError {
  constructor(readonly problems: readonly unknown[]) {
    super(400, 'ruleSetInvalid', 'error.ruleSetInvalid');
  }
}
