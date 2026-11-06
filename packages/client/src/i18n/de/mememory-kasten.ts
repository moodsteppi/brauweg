import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „mememory-kasten": Vorschlagskasten und
 * Sammlungsseite von Mememory (`minispiele/mememory/Vorschlagskasten.tsx`,
 * `SammlungSeite.tsx`). Wortlaut unverändert aus dem Code übernommen.
 * Eigener Bereich, damit `mememory.ts` nicht weiter anwächst.
 */
export default {
  'mememory.kasten.titel': 'Vorschlagskasten',
  'mememory.kasten.schliessen': 'Schließen',
  'mememory.kasten.meme': 'Meme',
  'mememory.kasten.motiv': 'Motiv',
  'mememory.kasten.vorschlag': 'Vorschlag',
  'mememory.kasten.reiter.hochladen': 'Hochladen',
  'mememory.kasten.reiter.vorschlagen': 'Meme vorschlagen',
  'mememory.kasten.reiter.kasten': 'Kasten',
  'mememory.kasten.reiter.bestand': 'Bestand',

  'mememory.kasten.hinweisHochladen':
    'Bilder aussuchen - auch mehrere auf einmal. Du schneidest sie nacheinander zu, jedes ist sofort im Spiel.',
  'mememory.kasten.hinweisVorschlagen':
    'Such dir Memes aus deiner Galerie aus, gern mehrere auf einmal. Du schneidest sie nacheinander selbst zurecht - was auf dem Brett landet, entscheidet die Aufsicht.',
  'mememory.kasten.frei.eins': 'Du kannst gerade noch ein Bild einreichen.',
  'mememory.kasten.frei.mehr': 'Du kannst gerade noch {n} Bilder einreichen.',
  'mememory.kasten.grenze': 'Es warten schon fünf Bilder von dir. Warte, bis sie geprüft sind.',
  'mememory.kasten.grenzeRest':
    'Es warten schon fünf Bilder von dir. Die restlichen {n} sind nicht eingereicht - warte, bis die anderen geprüft sind.',
  'mememory.kasten.grenzeWarten':
    'Es warten schon fünf Bilder von dir. Sobald eines geprüft ist, geht wieder etwas.',
  'mememory.kasten.auswaehlenBilder': 'Bilder auswählen',
  'mememory.kasten.auswaehlenMemes': 'Memes auswählen',
  'mememory.kasten.stapel.begrenzt':
    'Von {von} Bildern nimmst du {n}: mehr Vorschläge darfst du gerade nicht offen haben.',
  'mememory.kasten.stapel.erste': 'Von {von} Bildern nimmst du die ersten {n}.',
  'mememory.kasten.fortschritt': 'Bild {i} von {n}',
  'mememory.kasten.hinweisBearbeiten':
    'Neuer Ausschnitt, neuer Name - die Kennung bleibt, laufende Tische behalten das Motiv.',
  'mememory.kasten.hinweisZuschnitt':
    'Schieben zum Verrücken, zwei Finger oder der Regler zum Zoomen. Was im Rahmen steht, kommt auf die Karte.',
  'mememory.kasten.naechstes': 'Nächstes Bild wird geöffnet…',
  'mememory.kasten.ueberspringen': 'Überspringen',
  'mememory.kasten.verwerfen': 'Verwerfen',
  'mememory.kasten.speichern': 'Speichern',
  'mememory.kasten.aufnehmen': 'Aufnehmen',
  'mememory.kasten.einreichen': 'Einreichen',
  'mememory.kasten.stapelWeg': 'Dieses und die {n} übrigen verwerfen',

  'mememory.kasten.ton': 'Ton',
  'mememory.kasten.ton.schneidet': 'wird geschnitten…',
  'mememory.kasten.ton.neu': 'neu gewählt',
  'mememory.kasten.ton.weg': 'wird entfernt',
  'mememory.kasten.ton.da': 'vorhanden',
  'mememory.kasten.ton.keiner': 'keiner',
  'mememory.kasten.anhoeren': 'Anhören',
  'mememory.kasten.dateiAndere': 'Andere Datei',
  'mememory.kasten.dateiWaehlen': 'Datei wählen',
  'mememory.kasten.entfernen': 'Entfernen',
  'mememory.kasten.tonGrenze':
    'Höchstens {s} Sekunden - was länger ist, wird abgeschnitten. Er spielt, sobald jemand dieses Meme über den Tisch wirft.',

  'mememory.kasten.schluss.aufsichtEins': 'Aufgenommen. Ab der nächsten Partie kann es auf dem Brett liegen.',
  'mememory.kasten.schluss.aufsichtMehr':
    '{n} Bilder aufgenommen. Ab der nächsten Partie können sie auf dem Brett liegen.',
  'mememory.kasten.schluss.nutzerEins': 'Danke! Dein Meme liegt jetzt im Kasten und wartet auf Freigabe.',
  'mememory.kasten.schluss.nutzerMehr': 'Danke! {n} Memes liegen jetzt im Kasten und warten auf Freigabe.',
  'mememory.kasten.schluss.unlesbar.eins': 'Eine Datei ließ sich nicht öffnen und wurde übergangen.',
  'mememory.kasten.schluss.unlesbar.mehr': '{n} Dateien ließen sich nicht öffnen und wurden übergangen.',
  'mememory.kasten.schluss.uebersprungen.eins': 'Eines hast du übersprungen.',
  'mememory.kasten.schluss.uebersprungen.mehr': '{n} hast du übersprungen.',

  'mememory.kasten.listeFehler': 'Die Liste ließ sich nicht laden.',
  'mememory.kasten.bildZuGross': 'Das Bild ist zu groß. Etwas näher heranzoomen hilft.',
  'mememory.kasten.einreichenAbgelehnt': 'Dieses Bild hat der Server nicht angenommen.',
  'mememory.kasten.einreichenFehler': 'Das Einreichen ist fehlgeschlagen.',
  'mememory.kasten.bearbeitenFehler': 'Das Bild ließ sich nicht zum Bearbeiten öffnen.',
  'mememory.kasten.tonZuGross': 'Der Ton ist zu groß geworden.',
  'mememory.kasten.tonOeffnenFehler': 'Diese Tondatei ließ sich nicht öffnen.',
  'mememory.kasten.tonSpielFehler': 'Der Ton ließ sich nicht abspielen.',
  'mememory.kasten.aenderungGut': 'Geändert. Neue Partien zeigen den neuen Zuschnitt.',
  'mememory.kasten.aenderungFehler': 'Das Ändern hat nicht geklappt.',
  'mememory.kasten.allgemeinFehler': 'Das hat nicht geklappt.',

  'mememory.kasten.laedt': 'Wird geladen…',
  'mememory.kasten.leer': 'Der Kasten ist leer.',
  'mememory.kasten.freigeben': 'Freigeben',
  'mememory.kasten.ablehnen': 'Ablehnen',
  'mememory.kasten.bestandHinweis':
    'Alles, was zusätzlich zu den 88 Grundmotiven im Spiel ist. ✎ ändert Name, Zuschnitt und Ton, ✕ nimmt heraus - beides wirkt sofort für neue Partien. Der Name steht im Spiel groß über dem Brett, sobald jemand das Paar findet.',
  'mememory.kasten.bestandLeer': 'Noch nichts hochgeladen.',
  'mememory.kasten.imSpiel': 'Im Spiel',
  'mememory.kasten.mitTon': '{n}/{von} mit Ton',
  'mememory.kasten.bearbeiten': '{name} bearbeiten',
  'mememory.kasten.tonAnhoeren': 'Ton von {name} anhören',
  'mememory.kasten.herausnehmen': '{name} herausnehmen',

  'mememory.kasten.sammlung.laedt': 'Wird geladen…',
  'mememory.kasten.sammlung.gefunden': '{habe} von {gesamt} gefunden',
  'mememory.kasten.sammlung.ladenFehler': 'Die Sammlung ließ sich nicht laden.',
  'mememory.kasten.sammlung.speichernFehler': 'Das Speichern hat nicht geklappt.',
  'mememory.kasten.sammlung.gruppeHoch': 'Aus dem Vorschlagskasten',
  'mememory.kasten.sammlung.gruppeGrund': 'Grundstock',
  'mememory.kasten.sammlung.gurtLabel': 'Gewählte Memes',
  'mememory.kasten.sammlung.ausGurt': '{name} aus dem Gurt nehmen',
  'mememory.kasten.sammlung.festhalten': '{name} festhalten',
  'mememory.kasten.sammlung.loesen': '{name} nicht mehr festhalten',
  'mememory.kasten.sammlung.zufallHilfe':
    'Jede Partie zieht drei andere Memes aus deiner Sammlung - festgehaltene Fächer bleiben.',
  'mememory.kasten.sammlung.leer': 'Noch nichts gefunden. Jedes Paar, das du selbst aufdeckst, landet hier.',
  'mememory.kasten.sammlung.waehle': 'Wähle bis zu {max} aus - die wirfst du im Spiel über den Tisch.',
  'mememory.kasten.sammlung.nochNicht': 'Noch nicht gefunden',
} satisfies Woerterbuch;
