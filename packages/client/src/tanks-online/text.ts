import { aktiveSprache } from '../i18n';
/** Kleine, gemeinsam verwendete Texte für die eigenständige Arena. */
export const wort = (de: string, en: string): string =>
  aktiveSprache() === 'de' ? de : en;
