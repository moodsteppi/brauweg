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

## Was hier (noch) nicht steht

Nur die vier Kartenspiele aus `protocol.ts`: Doppelkopf, Skat, Zauberer,
Cambio. Die Minispiele (Feldherr, Mememory, Filler, Eiland, Tafelrunde,
Poker) beschreiben ihre Sichten nicht in `protocol.ts`, sondern jeweils im
eigenen Bildschirm (`interface TafelrundeSicht` in `src/screens/Tafelrunde.tsx`
und so weiter) — dieselbe Lücke, nur an anderer Stelle, und noch ungedeckt.
