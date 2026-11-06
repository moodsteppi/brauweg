import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „hub-einstellungen": das fremde Spielerprofil
 * (`Profile.tsx`, Präfix `spielerprofil.`) und das Einstellungsblatt
 * (`Einstellungen.tsx`). Der Sprach-Schalter steht im Bereich „sprache".
 */
export default {
  'spielerprofil.titel': 'Profil',
  'spielerprofil.verbindungFehlgeschlagen': 'Verbindung fehlgeschlagen.',
  'spielerprofil.dabeiSeit': 'Dabei seit {datum}',
  'spielerprofil.nochmal': 'Nochmal versuchen',
  'spielerprofil.laedt': 'Profil wird geladen…',
  'spielerprofil.wert.partien': 'Partien',
  'spielerprofil.wert.siege': 'Siege',
  'spielerprofil.wert.siegquote': 'Siegquote',
  'spielerprofil.wert.spiele': 'Spiele',
  'spielerprofil.beenden.frage': 'Freundschaft beenden?',
  'spielerprofil.beenden.text': '{name} verschwindet aus deiner Freundesliste.',
  'spielerprofil.beenden.ja': 'Beenden',
  'spielerprofil.beenden.knopf': 'Freundschaft beenden',
  'spielerprofil.trophaeen': 'Trophäen',
  'spielerprofil.partien.eins': '{n} Partie',
  'spielerprofil.partien.mehr': '{n} Partien',
  'spielerprofil.alleSpiele': 'alle Spiele zusammen',
  'spielerprofil.keinePartie': 'Noch keine gewertete Partie gespielt.',
  'spielerprofil.zeile': '{partien} gewertet · {siege} Siege',
  'spielerprofil.trophaeenHinweis':
    'Trophäen gibt es auch gegen Bots - nur nicht, wenn ein Gast mitspielt oder Training an ist.',
  'spielerprofil.melden.knopf': 'Melden oder blockieren',
  'spielerprofil.melden.blockiert': 'Blockiert · Melden oder aufheben',
  'spielerprofil.marke.selbst': 'Das bist du',
  'spielerprofil.marke.freunde': '✓ Ihr seid Freunde',
  'spielerprofil.marke.gesendet': 'Anfrage gesendet',
  'spielerprofil.marke.eingehend': 'Möchte dein Freund sein',
  'spielerprofil.knopf.hinzufuegen': 'Freund hinzufügen',
  'spielerprofil.knopf.zurueckziehen': 'Anfrage zurückziehen',
  'spielerprofil.knopf.annehmen': 'Annehmen',
  'spielerprofil.knopf.ablehnen': 'Ablehnen',

  'einstellungen.titel': 'Einstellungen',
  'einstellungen.benachrichtigungen': 'Benachrichtigungen',
  'einstellungen.einenMoment': 'Einen Moment…',
  'einstellungen.fertig': 'Fertig',
  'einstellungen.ton': 'Ton',
  'einstellungen.sounds': 'Sounds',
  'einstellungen.sounds.hinweis': 'Karten, Knöpfe, Abrechnung',
  'einstellungen.musik': 'Musik',
  'einstellungen.musik.hinweis': 'Im Menü und am Spieltisch',
  'einstellungen.klanghalleHinweis':
    'Welches Stück läuft und welches Klangpaket gilt, steht in der Klanghalle in deinem Profil.',
  'einstellungen.klingelschalter':
    'Läuft bei dir Musik in einer anderen App, spielt sie weiter - wir drängeln uns nicht davor. Dafür schaltet am iPhone der Klingelschalter auch uns stumm.',
} satisfies Woerterbuch;
