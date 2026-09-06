# Verträge zwischen Client und Spielmodulen

`packages/client` importiert nichts aus den Spielpaketen. Jede Sicht steht in
`src/protocol.ts` ein zweites Mal beschrieben — `RoundView` neben `PlayerView`
des Doppelkopfs, `WizardRoundView` neben der Sicht des Zauberers, und so
weiter. Das ist Absicht (der Client soll genau die Felder kennen, die er
benutzt, und nicht mit einer neueren Serverfassung mitwandern) und hat eine
Kehrseite: **Benennt ein Modul ein Feld um oder lässt es weg, fällt das beim
Bauen nicht auf.** Der Client übersetzt weiter gegen seine eigene
Beschreibung. Auffallen tut es im Betrieb, als leere Anzeige an einem Tisch.

Hier steht die Gegenprobe. Je Spiel eine Datei, alle nach demselben Muster.

## Was geprüft wird

**Beim Übersetzen** (`npm run build`, also auch in der CI):

- `PasstAuf<Clientsicht, Beweglich<Modulsicht>>` — die echte Modulsicht muss
  auf den Client-Typ passen. Fehlt ein Feld oder hat es einen anderen Typ,
  bricht der Bau.
- `Leer<Exclude<keyof Clientsicht, keyof Modulsicht>>` — und kein Feld darf
  nur noch im Client stehen. Nötig **neben** der Zuweisung: Ein optionales
  Client-Feld, das kein Modul mehr schickt, ist zuweisbar und trotzdem tot.

**Beim Prüfen** (`vitest`): Eine echte, mit Bots gespielte Partie muss jedes
Feld auch wirklich liefern — gesammelt über alle Sitze und jeden
Zwischenstand. Das fängt den Fall, den die Übersetzung nicht sehen kann: ein
Feld, das im Typ steht, aber in keiner Lage mehr entsteht.

Die Module dürfen **mehr** liefern, als der Client kennt; das ist der normale
Weg, auf dem ein Modul vorangeht. Weniger dürfen sie nicht.

## Eine neue Datei anlegen

1. `<spiel>.test.ts` neben die vorhandenen legen, `doppelkopf.test.ts` als
   Vorlage nehmen.
2. Das Spielpaket in `tsconfig.json` (`paths`) **und** in `vitest.config.ts`
   (`resolve.alias`) eintragen — beide zeigen bewusst auf die **Quelle** des
   Pakets, nicht auf sein `dist`; die Gründe stehen an beiden Stellen.
   Zusätzlich als `devDependency` in `package.json`, damit die
   Testauswahl den Zusammenhang sieht: Ändert sich ein Spielpaket, muss der
   Vertrag mitlaufen.
3. Die Feldliste einmal abschreiben. Veralten kann sie nicht — die beiden
   `Leer<…>`-Zeilen darunter brechen den Bau, sobald ein Feld dazukommt oder
   verschwindet.

## Die andere Richtung: was der Bildschirm schickt

`tafelrunde-tisch.test.ts` fällt aus dem Muster, weil es nicht um eine Sicht
geht, sondern um die Werte, mit denen ein Bildschirm einen **Tisch aufmacht**.
Die Kehrseite ist dieselbe: Bis zum 05.09.2026 stand `DEFAULT_REGELN` in
`screens/Tafelrunde.tsx` ein zweites Mal, wortgleich abgeschrieben, und ging
als `config` an `createTable`. Der Server schreibt eine mitgeschickte
`config` als Regelsatz des Tisches fest — die Kopie **überstimmte** also das
Modul, und die Umstellung der Startleben (100 → 20 → 14) wäre zweimal an
jedem echten Tisch vorbeigelaufen, ohne dass etwas rot geworden wäre.

Behoben ist das nicht hier, sondern an der Wurzel: Der Bildschirm lässt
`config` weg, und der Server setzt `defaultConfig()` des Moduls ein
(`tables/service.ts`, geprüft in `packages/server/test/tables.test.ts`). Was
im Bildschirm an Zahlen bleibt, ist die **Auswahl** der angebotenen
Sitzzahlen — die darf kürzer sein als `SEAT_COUNTS`, aber nichts enthalten,
was das Modul nicht kennt. Genau das hält die Datei fest.

**Merksatz für neue Bildschirme:** Zahlen aus einem Spielmodul im Client
abschreiben ist nur dann richtig, wenn der Bildschirm sie auch wirklich
einstellen lässt. Sonst weglassen.

## Die Minispiele: die Sicht steht neben dem Bildschirm

Die vier Kartenspiele beschreiben ihre Sichten in `protocol.ts`. Die
Minispiele taten es bis zum 06.09.2026 **im eigenen Bildschirm** —
`interface TafelrundeSicht` stand mitten in `screens/Tafelrunde.tsx`, dasselbe
Muster in Eiland, Filler, Mememory, EasyPoker und FeldherrTisch.

Das ging so nicht: Ein Vertrag, der von dort importiert, zöge den ganzen
Bildschirm samt React in einen Test, der nur Typen vergleichen will. Deshalb
liegt der Sicht-Typ jetzt je Spiel in einer eigenen Datei neben dem
Bildschirm, `src/minispiele/<spiel>/sicht.ts`, und der Bildschirm importiert
ihn von dort. **Für ein neues Minispiel gilt das von Anfang an** — die Sicht
gehört nicht in die `.tsx`.

Wo ein solcher Typ auf Client-Typen zurückgreift, die in einem Bauteil stehen
(`Kampfpaarung` in `KampfAnzeige.tsx`, `Stufe` in `Stufenregler.tsx`), wird
`import type` benutzt und nichts anderes: Ein Wert-Import wäre React im
Vertrag.

### Drei Besonderheiten, die dabei angefallen sind

**`Beweglich` behält Tupel.** Fillers Barrieren sind
`readonly (readonly [number, number])[]`. Pauschal zu `number[][]` verflacht,
passte das auf keinen Client-Typ, der `[number, number]` schreibt — der
Vertrag wäre rot geworden, obwohl beide Seiten dasselbe meinen.

**`felderEinerPartie` nimmt eine `config`.** Manche Felder hängen an einer
Spielart: `barrierenMoeglich` gibt es bei Filler nur in `build`. Eine Partie
in der Vorgabe-Spielart ließe genau dieses Feld ungeprüft.

**`felderEinerPartie` nimmt `unterobjekte`.** Die Kartenspiele haben genau
eine zweite Ebene, `round`, und die kennt das Werkzeug fest. Tafelrundes
Sicht hat zwei weitere (`eigenes`, `gegner`) — und dort steht, was der
Bildschirm am meisten liest. Die Namen kommen als Liste mit, die Felder
stehen danach unter `gesehen.unter.<name>`.

## Was hier (noch) nicht steht

Feldherrs Spielkern. `minispiele/feldherr/kern.js` ist gebaut, nicht
geschrieben (Quelle: `packages/game-feldherr/quelle/teile/`), und der ganze
Spielstand lebt dort auf den Geräten — der Server sieht ihn nie. Gedeckt ist
die **Naht**: Die Zugform des Vertrags kommt aus `kern.d.ts` und wird gegen
die des Moduls gehalten. Laufen Kern und Modul auseinander, bricht der Bau;
vorher wurde daraus eine strittige Partie.
