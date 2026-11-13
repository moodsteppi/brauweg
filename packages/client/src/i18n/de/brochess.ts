import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „brochess": der Tisch, das Brett, die Zeitwahl und
 * die Secret-Dame-Meldungen. Die Regelsatz-Fehler stehen in `regeln-brochess`.
 *
 * Figuren stehen als GANZE Wortgruppe („Der Springer", „Deine Dame"), nicht
 * als Artikel und Name getrennt: Das Geschlecht der Dame und die Wortstellung
 * sind je Sprache anders.
 */
export default {
  'brochess.verbinde': 'Verbinde mit dem Tisch…',
  'brochess.verbindungWeg': 'Verbindung unterbrochen - verbinde neu…',
  'brochess.zurueck': 'Zurück',
  'brochess.zurAuswahl': 'Zur Spielauswahl',
  'brochess.bot': 'Bot',
  'brochess.farbe.w': 'Weiß',
  'brochess.farbe.b': 'Schwarz',
  'brochess.du': '(du)',
  'brochess.weg': 'weg',
  'brochess.geschlagenAria.eins': '{n} Figur geschlagen',
  'brochess.geschlagenAria.mehr': '{n} Figuren geschlagen',
  'brochess.zugliste': 'Zugliste',
  'brochess.keinZug': 'Noch kein Zug',
  'brochess.aufgeben': 'Aufgeben',
  'brochess.aufgeben.titel': 'Aufgeben?',
  'brochess.aufgeben.text': 'Die Partie ist dann verloren.',
  'brochess.secretDame': 'Secret Dame',
  'brochess.kopfModus': '{modus} · {regel}',

  // Figuren: schlicht (Beschriftungen), mit „Der/Die" und mit „Dein/Deine" (Meldungen)
  'brochess.figur.p': 'Bauer',
  'brochess.figur.n': 'Springer',
  'brochess.figur.b': 'Läufer',
  'brochess.figur.r': 'Turm',
  'brochess.figur.q': 'Dame',
  'brochess.figur.k': 'König',
  'brochess.figur.x': 'Figur',
  'brochess.figurDer.p': 'Der Bauer',
  'brochess.figurDer.n': 'Der Springer',
  'brochess.figurDer.b': 'Der Läufer',
  'brochess.figurDer.r': 'Der Turm',
  'brochess.figurDer.q': 'Die Dame',
  'brochess.figurDer.x': 'Die Figur',
  'brochess.figurDein.p': 'Dein Bauer',
  'brochess.figurDein.n': 'Dein Springer',
  'brochess.figurDein.b': 'Dein Läufer',
  'brochess.figurDein.r': 'Dein Turm',
  'brochess.figurDein.q': 'Deine Dame',
  'brochess.figurDein.x': 'Deine Figur',

  // Brett
  'brochess.brett': 'Schachbrett',
  // Je Farbe und Figur ein ganzer Satz: „weißer Springer“, aber „weiße Dame“ —
  // eine Lücke für die Farbe kann die Endung nicht beugen.
  'brochess.figurAufFeld.w.p': '{feld}, weißer Bauer',
  'brochess.figurAufFeld.w.n': '{feld}, weißer Springer',
  'brochess.figurAufFeld.w.b': '{feld}, weißer Läufer',
  'brochess.figurAufFeld.w.r': '{feld}, weißer Turm',
  'brochess.figurAufFeld.w.q': '{feld}, weiße Dame',
  'brochess.figurAufFeld.w.k': '{feld}, weißer König',
  'brochess.figurAufFeld.b.p': '{feld}, schwarzer Bauer',
  'brochess.figurAufFeld.b.n': '{feld}, schwarzer Springer',
  'brochess.figurAufFeld.b.b': '{feld}, schwarzer Läufer',
  'brochess.figurAufFeld.b.r': '{feld}, schwarzer Turm',
  'brochess.figurAufFeld.b.q': '{feld}, schwarze Dame',
  'brochess.figurAufFeld.b.k': '{feld}, schwarzer König',
  'brochess.marke.meineVerdeckt': 'deine geheime Dame, nur für dich sichtbar',
  'brochess.marke.aufgedeckt': 'aufgedeckte geheime Dame',
  'brochess.marke.warDame': 'hier wurde eine geheime Dame geschlagen',
  'brochess.marke.koenigGeschlagen': 'hier wurde der König geschlagen',
  'brochess.umwandlung.aria': 'Umwandlung wählen',
  'brochess.umwandlung.titel': 'Umwandeln in …',
  'brochess.abbrechen': 'Abbrechen',

  // Ergebnis und Status
  'brochess.remis': 'Remis',
  'brochess.remis.patt': 'Patt',
  'brochess.remis.fuenfzigZuege': '50-Züge-Regel',
  'brochess.remis.wiederholung': 'dreifache Stellungswiederholung',
  'brochess.remis.material': 'zu wenig Material zum Mattsetzen',
  'brochess.remis.zeit': 'Zeit abgelaufen, aber kein Matt mehr möglich',
  'brochess.grund.matt': 'durch Schachmatt',
  'brochess.grund.zeit': 'auf Zeit',
  'brochess.grund.aufgabe': 'durch Aufgabe',
  'brochess.grund.koenigsschlag': 'durch Königsschlag der geheimen Dame',
  'brochess.duGewinnst': 'Du gewinnst!',
  'brochess.gewinnt': '{name} gewinnt',
  'brochess.titelGrund': '{titel} - {grund}',
  'brochess.duAmZug': 'Du bist am Zug',
  'brochess.amZug': '{name} ist am Zug',
  'brochess.schach': 'Schach! {zug}.',

  // Secret Dame: Meldungen
  'brochess.meldung.aufgedeckt.meine': 'Aufgedeckt! {figur} auf {feld} ist als geheime Dame bekannt.',
  'brochess.meldung.aufgedeckt.fremde': 'Aufgedeckt! {figur} auf {feld} ist die geheime Dame von {name}.',
  'brochess.meldung.geschlagen.meine': 'Geschlagen auf {feld}: {figur} war deine geheime Dame.',
  'brochess.meldung.geschlagen.fremde': 'Geschlagen auf {feld}: {figur} war die geheime Dame von {name}.',
  'brochess.meldung.umgewandelt.meine': 'Deine geheime Dame hat sich auf {feld} umgewandelt und ist keine geheime Dame mehr.',
  'brochess.meldung.umgewandelt.fremde': 'Die geheime Dame von {name} hat sich auf {feld} umgewandelt.',
  'brochess.meldung.koenig.meine': 'Königsschlag! Deine geheime Dame hat den König auf {feld} geschlagen.',
  'brochess.meldung.koenig.zuschauer': 'Königsschlag! Die geheime Dame von {name} hat den König auf {feld} geschlagen.',
  'brochess.meldung.koenig.fremde': 'Königsschlag! Die geheime Dame von {name} hat deinen König auf {feld} geschlagen.',
  'brochess.wahl.zuschauer': 'Beide wählen ihre geheime Dame …',
  'brochess.wahl.anleitung': 'Wähle deine geheime Dame: eine eigene Figur antippen, dann bestätigen.',
  'brochess.wahl.warten': '{name} wählt noch die geheime Dame …',
  'brochess.wahl.erstAntippen': 'Erst eine Figur antippen',
  'brochess.wahl.bestaetigen': '{figur} auf {feld} als geheime Dame',

  // Regeln A und B
  'brochess.regel.A.kurz': 'Regel A',
  'brochess.regel.A.satz': 'Eine verdeckte Dame gibt kein Schach – wer seinen König in ihrer Reichweite lässt, verliert ihn.',
  'brochess.regel.B.kurz': 'Regel B',
  'brochess.regel.B.satz': 'Eine verdeckte Dame gibt Schach wie eine echte Dame – dafür verraten die erlaubten Züge, wo sie stehen kann.',

  // Zeit
  'brochess.zeit.sek': '{n} Sek',
  'brochess.zeit.min': '{n} min',
  'brochess.zeit.titelArt': '{zeit} · {art}',
  'brochess.uhr': 'Uhr {name}: {zeit}',
  'brochess.zeitWahl.titel': 'Zeit wählen',
  'brochess.zeitWahl.hinweis': 'Die Zeit gilt für jeden Spieler. Die Zahl hinter dem Plus sind Sekunden, die nach jedem eigenen Zug dazukommen. Wer keine Zeit mehr hat, verliert.',

  // Spielart (Lobby)
  'brochess.modi.knopf': 'Spezial-Modi',
  'brochess.modi.klassisch': 'Klassisches Schach',
  'brochess.modi.klassischSpielen': 'Klassisch spielen',
  'brochess.modi.fertig': 'Fertig',
  'brochess.modi.secretDame.satz': 'Jeder macht heimlich eine eigene Figur zur Dame – sie verrät sich erst mit ihrem ersten Damenzug.',
  'brochess.spielart.hinweis': 'Vor dem ersten Zug wählt jeder heimlich eine eigene Figur außer dem König. Sie darf zusätzlich wie eine Dame ziehen – erst dann sieht der Gegner, welche es war.',
  'brochess.spielart.regelTitel': 'Schach durch die verdeckte Dame',
  'brochess.spielart.regelAria': 'Regel',
  'brochess.spielart.vorgabe': 'Vorgabe',
} satisfies Woerterbuch;
