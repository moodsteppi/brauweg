#!/usr/bin/env bash
# iOS-App bauen und zu TestFlight hochladen — ohne dass jemand am Mac sitzt.
#
# Fuer Toms MacBook als Orchestrator-Worker (Auftrag vom 23.09.2026). Gebaut
# wird die Swift-Huelle in apps/ios dieses Repos (seit dem 23.09.2026; das in
# frueheren Fassungen genannte Repo `Brauweg-spiel-ios` hat es nie gegeben).
# Das Xcode-Projekt entsteht bei jedem Lauf frisch aus apps/ios/project.yml
# (XcodeGen), der Client wird im selben Lauf gebaut — so steht beides auf
# demselben Commit.
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
IOS="$WURZEL/apps/ios"

sag() { printf '\n==> %s\n' "$*"; }
stirb() { printf '\nFEHLER: %s\n' "$*" >&2; exit 1; }

[[ "$(uname)" == "Darwin" ]] || stirb "Nur auf macOS (xcodebuild)."
command -v xcodebuild >/dev/null || stirb "xcodebuild fehlt — Xcode installieren und einmal starten."
command -v xcodegen >/dev/null || stirb "xcodegen fehlt — brew install xcodegen"
command -v npm >/dev/null || stirb "npm fehlt — Node 22 installieren (brew install node@22)."
[[ -f "$LOKAL" ]] || stirb "$LOKAL fehlt. Vorlage: $HIER/ios-lokal.env.beispiel"
[[ -f "$IOS/project.yml" ]] || stirb "$IOS/project.yml fehlt — falscher Zweig?"

# shellcheck disable=SC1090
source "$LOKAL"
: "${TEAM_ID:?TEAM_ID fehlt in ios-lokal.env}"
: "${ASC_KEY_ID:?ASC_KEY_ID fehlt in ios-lokal.env}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID fehlt in ios-lokal.env}"
SCHEME="${SCHEME:-Brauweg}"
KONFIGURATION="${KONFIGURATION:-Release}"
SCHLUESSEL="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"

# Nur pruefen, OB der Schluessel da ist. Nie lesen.
[[ -f "$SCHLUESSEL" ]] || stirb "API-Schluessel fehlt: $SCHLUESSEL"

# Wahlweise: anderer Server (API_BASE) und Push an (PUSH=YES) — beide in
# ios-lokal.env. Ohne Angabe gilt, was apps/ios/project.yml fuer die
# Konfiguration sagt (Release: Produktion, Push aus).
EXTRA=()
[[ -n "${API_BASE:-}" ]] && EXTRA+=("BRAUWEG_API_BASE=$API_BASE")
[[ -n "${PUSH:-}" ]] && EXTRA+=("BRAUWEG_PUSH=$PUSH")

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

# Das Projekt ist ein Erzeugnis (apps/ios/.gitignore) und entsteht darum jedes
# Mal neu — ein altes Brauweg.xcodeproj von Hand geaendert zu haben, soll
# keinen Unterschied machen. Den eben gebauten Client legt die Build-Phase
# „Client ins Paket" (apps/ios/werkzeug/web-einbauen.sh) ins App-Paket.
sag "Xcode-Projekt aus apps/ios/project.yml"
(cd "$IOS" && xcodegen generate --spec project.yml)

sag "Archiv ($SCHEME, $KONFIGURATION, Build $BUILDNUMMER)"
xcodebuild archive \
  -project "$IOS/Brauweg.xcodeproj" \
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
  CURRENT_PROJECT_VERSION="$BUILDNUMMER" \
  ${EXTRA[@]+"${EXTRA[@]}"}

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
