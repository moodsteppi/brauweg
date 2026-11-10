import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „hub-schrank": der Kleiderschrank
 * (`Kleiderschrank.tsx`, Präfix `schrank.`) und das Blatt mit Tagesaufgaben
 * und Truhen (`Aufgaben.tsx`, Präfix `aufgaben.`). Die Aufgabentexte selbst
 * schickt der Server als `quest.*` — die stehen im Bereich „ware".
 */
export default {
  'schrank.titel': 'Kleiderschrank',
  'schrank.deinSpind': 'Dein Spind',
  'schrank.untertitel': 'Dein Pinguin · für alle Spiele',
  'schrank.deinPinguin': 'Dein Pinguin',
  'schrank.anprobe': 'Anprobe',
  'schrank.plaetze': 'Plätze',
  'schrank.laedt': 'Wird geladen…',
  'schrank.ausziehen': 'Ausziehen',
  'schrank.nichtsAn': 'Nichts an',
  'schrank.gehoertDir': 'Gehört dir',
  'schrank.nurZuBekommen': 'Nur zu bekommen',
  'schrank.preisOder': '{muenzen} oder {edelsteine}',
  'schrank.geschenk': 'Geschenk',
  'schrank.fach.traegstDu': 'trägst du',
  'schrank.fach.gehoertDir': 'gehört dir',
  'schrank.fach.preis.eins': '{betrag} Münze',
  'schrank.fach.preis.mehr': '{betrag} Münzen',
  'schrank.kaufBestaetigen': 'Kauf bestätigen',
  'schrank.womit': 'Womit bezahlen?',
  'schrank.kauft': 'Kauft…',
  'schrank.spaeter': 'Später',
  'schrank.zurueck': '← Zurück',
  'schrank.fehler.laden': 'Der Kleiderschrank ließ sich nicht laden.',
  'schrank.fehler.anziehen': 'Das ließ sich nicht anziehen.',
  'schrank.fehler.ausziehen': 'Das ließ sich nicht ausziehen.',
  'schrank.fehler.kauf': 'Der Kauf ging nicht durch.',

  'aufgaben.zurueck': '← Zurück',
  'aufgaben.tagesaufgaben': 'Tagesaufgaben',
  'aufgaben.heuteErledigt': 'Heute erledigt',
  'aufgaben.setztSichZurueck': 'Setzt sich morgen zurück',
  'aufgaben.gezaehltHinweis':
    'Gezählt wird am Ende einer Partie - auch an Tischen mit Bots. Abgebrochene Partien zählen nicht.',
  'aufgaben.truhen': 'Truhen',
  'aufgaben.truhenOffen': '{n} offen',
  'aufgaben.keineOffen': 'Keine offen',
  'aufgaben.truhenHinweis':
    'Die Tagestruhe steht jeden Tag einmal bereit. Die anderen kommen mit den Stufen - erreicht ist erreicht, sie gehen nie wieder zu.',
  'aufgaben.truhe.geholt.eins': 'Geholt: {n} Münze',
  'aufgaben.truhe.geholt.mehr': 'Geholt: {n} Münzen',
  'aufgaben.truhe.spanne': '{von} bis {bis} Münzen',
  'aufgaben.truhe.abStufe.eins': 'Ab Stufe {stufe} · noch {n} Stufe',
  'aufgaben.truhe.abStufe.mehr': 'Ab Stufe {stufe} · noch {n} Stufen',
  'aufgaben.truhe.oeffnen': 'Öffnen',
  'aufgaben.truhe.oeffnet': 'Öffnet…',
  'aufgaben.schonGeholt': 'schon geholt',
  'aufgaben.holen': 'Holen',
  'aufgaben.holt': 'Holt…',
  'aufgaben.laeuft': 'Läuft',
  'aufgaben.kopf.bereit.eins': '{n} Münze liegt bereit',
  'aufgaben.kopf.bereit.mehr': '{n} Münzen liegen bereit',
  'aufgaben.kopf.allesGeholt': 'Heute alles geholt',
  'aufgaben.kopf.zuHolen.eins': '{n} Münze zu holen',
  'aufgaben.kopf.zuHolen.mehr': '{n} Münzen zu holen',
  'aufgaben.fehler.laden': 'Aufgaben und Truhen ließen sich nicht laden.',
  'aufgaben.fehler.oeffnen': 'Die Truhe ließ sich nicht öffnen.',
  'aufgaben.fehler.holen': 'Die Belohnung ließ sich nicht holen.',
} satisfies Woerterbuch;
