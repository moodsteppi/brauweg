import type { Woerterbuch } from '../woerterbuch';

/** Deutsche Texte, Bereich „einladung". Umgezogen aus dem alten i18n.ts, Wortlaut unverändert. */
export const einladung: Woerterbuch = {
  // Einladung an den Tisch (22.09.2026): Code, Link, QR — und die Eingabe dazu.
  'einladung.titel': 'Leute dazuholen',
  'einladung.hinweis': 'Code vorlesen, Link teilen oder den QR-Code scannen lassen.',
  'einladung.codeAria': 'Beitrittscode',
  'einladung.teilen': 'Link teilen',
  // Davor steht der Spielname (Einladung.tsx) — bis zum 21.10.2026 hiess es
  // hier fest „Partykiste bei BroweGGames", auch am privaten Doppelkopftisch.
  'einladung.teilenTitel': 'bei BroweGGames',
  'einladung.teilenText': 'Komm an meinen Tisch. Code:',
  'einladung.kopiert': 'Link kopiert - jetzt in den Gruppenchat einfügen.',
  'einladung.nichtKopiert': 'Kopieren ging nicht. Der Link steht unter dem QR-Code.',
  'einladung.qrAria': 'QR-Code des Einladungslinks',
  // „sitzt du direkt dort" stimmte nicht mehr, seit private Kartentische eine
  // Zusage des Gastgebers verlangen (tables/anfragen.ts, 13.10.2026).
  'einladung.vorgemerkt': 'Du bist an einen Tisch eingeladen. Melde dich an oder spiel als Gast - danach geht es zum Tisch.',
  'einladung.laeuft': 'Du wirst an den Tisch gesetzt …',
  'einladung.eingabeTitel': 'Mit Code beitreten',
  'einladung.eingabeAria': 'Beitrittscode eingeben',
  'einladung.beitreten': 'Beitreten',
  'einladung.tischVon': 'Tisch von',
  'einladung.offenerTisch': 'Offener Tisch',
  'einladung.besetzt': 'Plätze besetzt',
  'einladung.anderesSpiel': 'Dieser Code gehört zu einem Tisch für',
  'einladung.fehlgeschlagen': 'Beitreten fehlgeschlagen.',
};
