#!/usr/bin/env bash
# iOS-App bauen und zu TestFlight hochladen — ohne dass jemand am Mac sitzt.
#
# Fuer Toms MacBook als Orchestrator-Worker (Auftrag vom 23.09.2026). Gebaut
# wird die Swift-Huelle aus dem Repository `Brauweg-spiel-ios` (docs/APPSTORE.md);
# dieses Skript liegt im brauweg-Repo, weil das iOS-Repo von hier aus nicht
# erreichbar ist. Es bringt den Client selbst ins Paket, statt sich auf
# `scripts/web-uebernehmen.sh` der Huelle zu verlassen — so steht beides in
# EINEM Lauf auf demselben Commit.
#
#   werkzeug/app/ios-testflight.sh             bauen, exportieren, hochladen
#   werkzeug/app/ios-testflight.sh --trocken   bauen und exportieren, KEIN Upload
#
# Alles, was an Toms Konto haengt, steht in werkzeug/app/ios-lokal.env (NICHT im
# Repo, siehe .gitignore; Vorlage: ios-lokal.env.beispiel). Der API-Schluessel
# selbst liegt unter ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8 und wird
# hier nie gelesen, kopiert oder ausgegeben — nur sein Pfad geht an xcodebuild.
set -euo pipefail

TROCKEN=0
[[ "${1:-}" == "--trocken" ]] && TROCKEN=1

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WURZEL="$(cd "$HIER/../.." && pwd)"
LOKAL="$HIER/ios-lokal.env"

sag() { printf '\n==> %s\n' "$*"; }
stirb() { printf '\nFEHLER: %s\n' "$*" >&2; exit 1; }

[[ "$(uname)" == "Darwin" ]] || stirb "Nur auf macOS (xcodebuild)."
command -v xcodebuild >/dev/null || stirb "xcodebuild fehlt — Xcode installieren und einmal starten."
[[ -f "$LOKAL" ]] || stirb "$LOKAL fehlt. Vorlage: $HIER/ios-lokal.env.beispiel"

# shellcheck disable=SC1090
source "$LOKAL"
: "${TEAM_ID:?TEAM_ID fehlt in ios-lokal.env}"
: "${ASC_KEY_ID:?ASC_KEY_ID fehlt in ios-lokal.env}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID fehlt in ios-lokal.env}"
IOS_REPO="${IOS_REPO:-$WURZEL/../Brauweg-spiel-ios}"
SCHEME="${SCHEME:-Brauweg-spiel-ios}"
KONFIGURATION="${KONFIGURATION:-Release}"
SCHLUESSEL="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"

[[ -d "$IOS_REPO" ]] || stirb "iOS-Repo nicht gefunden: $IOS_REPO (IOS_REPO in ios-lokal.env setzen)."
# Nur pruefen, OB der Schluessel da ist. Nie lesen.
[[ -f "$SCHLUESSEL" ]] || stirb "API-Schluessel fehlt: $SCHLUESSEL"

# Projekt oder Arbeitsbereich — die Huelle braucht kein CocoaPods, also meist
# ein .xcodeproj. Liegt ein .xcworkspace daneben, gilt der.
if ls "$IOS_REPO"/*.xcworkspace >/dev/null 2>&1; then
  QUELLE=(-workspace "$(ls -d "$IOS_REPO"/*.xcworkspace | head -1)")
else
  QUELLE=(-project "$(ls -d "$IOS_REPO"/*.xcodeproj | head -1)")
fi

# Alles, was der Bau erzeugt, bleibt im Arbeitsraum — nicht in ~/Library.
BAU="$HIER/ios-bau"
ABLEITUNG="$BAU/DerivedData"
ARCHIV="$BAU/Brauweg.xcarchive"
EXPORT="$BAU/export"
rm -rf "$ARCHIV" "$EXPORT"
mkdir -p "$BAU"

# Buildnummer: Anzahl der Commits. Steigt mit jedem Merge, ist auf jedem
# Rechner gleich und laesst sich einem Commit zuordnen. Datum/Uhrzeit dahinter,
# damit zwei Laeufe auf demselben Commit (Neuversuch) nicht kollidieren —
# App Store Connect nimmt jede Nummer nur einmal.
BUILDNUMMER="$(git -C "$WURZEL" rev-list --count HEAD).$(date -u +%m%d%H%M)"

sag "Abhaengigkeiten und Client (Commit $(git -C "$WURZEL" rev-parse --short HEAD))"
cd "$WURZEL"
npm ci
npm run build --workspace @brauweg/client

sag "Client ins Paket der Huelle"
WEB="$IOS_REPO/web"
rm -rf "$WEB"
cp -R "$WURZEL/packages/client/dist" "$WEB"
# Dieselbe Liste wie bei Android (apps/android/werkzeug/web-uebernehmen.mjs):
# Safari-Startbilder und Entwuerfe braucht die App nicht.
rm -rf "$WEB/start" "$WEB/hub-entwuerfe" "$WEB/icon-1024.png" "$WEB/appicon.png"
printf '{ "commit": "%s", "gebaut": "%s", "build": "%s" }\n' \
  "$(git -C "$WURZEL" rev-parse --short HEAD)" "$(date -u +%FT%TZ)" "$BUILDNUMMER" > "$WEB/stand.json"

sag "Archiv ($SCHEME, $KONFIGURATION, Build $BUILDNUMMER)"
xcodebuild archive \
  "${QUELLE[@]}" \
  -scheme "$SCHEME" \
  -configuration "$KONFIGURATION" \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$ABLEITUNG" \
  -archivePath "$ARCHIV" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$SCHLUESSEL" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  CURRENT_PROJECT_VERSION="$BUILDNUMMER"

# ExportOptions: die eingecheckte Vorlage plus Team-ID — die steht nur lokal.
OPTIONEN="$BAU/ExportOptions.plist"
cp "$HIER/ExportOptions.plist" "$OPTIONEN"
/usr/libexec/PlistBuddy -c "Add :teamID string $TEAM_ID" "$OPTIONEN"
if [[ $TROCKEN -eq 1 ]]; then
  # Trockenlauf: exportieren, aber nicht hochladen.
  /usr/libexec/PlistBuddy -c "Set :destination export" "$OPTIONEN"
fi

sag "Export$([[ $TROCKEN -eq 1 ]] && echo ' (Trockenlauf, kein Upload)' || echo ' und Upload zu App Store Connect')"
xcodebuild -exportArchive \
  -archivePath "$ARCHIV" \
  -exportPath "$EXPORT" \
  -exportOptionsPlist "$OPTIONEN" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$SCHLUESSEL" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"

if [[ $TROCKEN -eq 1 ]]; then
  sag "Fertig (Trockenlauf). IPA liegt unter $EXPORT"
else
  sag "Hochgeladen: Build $BUILDNUMMER. In App Store Connect → TestFlight erscheint er nach 10–30 Minuten Verarbeitung."
fi
