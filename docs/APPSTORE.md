# Brauweg in den App Store

Stand: Der Client ist eine Web-App. Für den Store braucht sie einen nativen
Rahmen (Capacitor). Diese Datei hält fest, was fertig ist, was fehlt und wer
was macht.

## Heute schon möglich: Homescreen

Ohne Mac, ohne Apple-Konto, auf jedem iPhone:

1. **Safari** öffnen (nicht Chrome — nur Safari kann das)
2. `https://www.brauweg-spielen.de` aufrufen
3. Teilen-Symbol → **„Zum Home-Bildschirm"**
4. Name bestätigen

Danach: eigenes Icon, Vollbild ohne Browserleiste, eigenes Startbild.
Das ist kein Store-Eintrag, reicht aber zum Testen zu dritt.

Wichtig zu wissen:
- Die Anmeldung bleibt erhalten (Sitzungs-Cookie, 30 Tage).
- Ohne Netz startet die App nicht — es gibt bewusst keinen Offline-Speicher,
  weil ein veralteter zwischengespeicherter Stand nach einem Deploy schlimmer
  wäre als eine ehrliche Fehlermeldung.
- Push-Nachrichten gibt es nicht (brauchen wir noch nicht).

## Was für den Store noch fehlt

### Sichere Ablehnungsgründe — muss vorher weg

| Punkt | Was fehlt | Wo |
| --- | --- | --- |
| ~~**Konto löschen**~~ | ✅ **Erledigt.** Profil-Tab ganz unten, mit Passwortabfrage. Gelöscht wird als Anonymisierung. | `GameSelect.tsx` |
| **Datenschutzerklärung** | Entwurf fertig, **noch nicht ausgeliefert**. Wartet auf die Firmengründung: ohne Rechtsträger keine Anschrift. | `docs/rechtstexte-entwurf/` |
| **Impressum** | Ebenso. Mit Platzhaltern öffentlich wäre es schlechter als keins. | `docs/rechtstexte-entwurf/` |
| **Support-Adresse** | Pflichtfeld in App Store Connect — dieselbe Adresse gehört in beide Rechtstexte. Kommt mit der Firma. | — |
| **Testzugang für die Prüfer** | Der Einladungscode sperrt die Prüfer aus. Es muss ein fertiges Konto samt Code in den Prüfhinweisen stehen. | App Store Connect |
| **Shop** | „Bald"-Attrappen mit Paketangaben gelten als unfertig. Bis zum Release entweder fertig (dann zwingend über Apples Bezahlweg, 30 %) oder ausgeblendet. | `GameSelect.tsx` |

### Pflichtangaben (keine Programmierarbeit)

- Datenschutz-Etiketten („App Privacy"): E-Mail-Adresse, Anzeigename,
  Profilbild, Spielstatistiken.
- Altersfreigabe: Kartenspiel mit Spielmünzen, **kein** Echtgeld-Glücksspiel.
- Kategorie: Spiele → Karten.
- Screenshots je Gerätegröße, Beschreibung, Schlüsselwörter.

### Technisch

- **Capacitor** als Rahmen. Der Client wird ins App-Paket gepackt, nicht nur
  die Website geöffnet — eine reine Verknüpfung wird abgelehnt.
- App-Kennung (Bundle ID), Version und Build-Nummer.
- Icon liegt in 1024×1024 bereit (`public/icon-1024.png`).

## Für den Kollegen mit dem Mac

Der Client baut auf jedem Rechner, nur das iOS-Paket braucht macOS:

```bash
git clone git@github.com:moodsteppi/brauweg.git && cd brauweg
npm install
npm run build --workspace @brauweg/client
```

Danach einmalig den Rahmen anlegen:

```bash
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/ios
npx cap init Brauweg de.brauweg.app --web-dir=packages/client/dist
npx cap add ios
npx cap open ios
```

In Xcode: Team auf den Firmen-Account setzen, auf einem angeschlossenen
iPhone starten. Für die drei Testgeräte reicht danach **TestFlight**
(interne Tester, keine Prüfung nötig, sofort verfügbar).

Zwei Dinge, die dabei zu klären sind:

1. **Server-Adresse.** Im App-Paket liegt der Client örtlich, die API nicht.
   Entweder Capacitor auf `https://www.brauweg-spielen.de` zeigen lassen
   (`server.url` — einfach, aber Apple sieht darin schnell eine reine
   Website) oder die API-Adresse im Client konfigurierbar machen und das
   Sitzungs-Cookie auf `sameSite: none` umstellen. **Empfehlung: der zweite
   Weg**, dafür ist eine kleine Änderung an `api.ts` und den Cookie-Angaben
   nötig — sag Bescheid, dann baue ich das.
2. **WebSocket.** Läuft über dieselbe Adresse; bei getrennter API muss
   `useTable.ts` die konfigurierte Adresse benutzen statt `location.host`.

## Reihenfolge

1. ✅ Homescreen-Fassung (fertig — heute testbar)
2. ✅ Konto löschen (fertig, mit Passwortabfrage)
3. Firma gründen — hängt davor: Datenschutz, Impressum, Support-Adresse
   sind geschrieben, aber ohne Rechtsträger nicht ausfüllbar
4. Entscheidung Shop: fertig bauen oder ausblenden
5. Capacitor-Rahmen + getrennte API-Adresse
6. TestFlight für die drei Geräte
7. Einreichung App Store
8. Später: Play Store (baut auch auf Windows, deutlich einfacher)
