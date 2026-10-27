#!/usr/bin/env bash
# Die XCTests der iOS-Huelle auf dem Mac laufen lassen — im Simulator, ohne
# Konto und ohne Signierung.
#
#   apps/ios/werkzeug/pruefen.sh
#
# Erzeugt das Projekt aus project.yml und startet `xcodebuild test` auf dem
# ersten verfuegbaren iPhone-Simulator. Welche Simulatoren es gibt, haengt an
# der Xcode-Fassung; ein fest eingetragener Name ("iPhone 16") waere mit dem
# naechsten Xcode falsch.
set -euo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS="$(cd "$HIER/.." && pwd)"

stirb() { printf '\nFEHLER: %s\n' "$*" >&2; exit 1; }

[[ "$(uname)" == "Darwin" ]] || stirb "Nur auf macOS (xcodebuild)."
command -v xcodebuild >/dev/null || stirb "xcodebuild fehlt — Xcode installieren und einmal starten."
command -v xcodegen >/dev/null || stirb "xcodegen fehlt — brew install xcodegen"

GERAET="$(xcrun simctl list devices available | sed -nE 's/^ +iPhone[^(]*\(([0-9A-F-]{36})\).*/\1/p' | head -1)"
[[ -n "$GERAET" ]] || stirb "Kein iPhone-Simulator gefunden — in Xcode unter Settings → Components eine iOS-Laufzeit laden."

(cd "$IOS" && xcodegen generate --spec project.yml)

# CODE_SIGNING_ALLOWED=NO: Im Simulator braucht es keine Signatur, und so
# laeuft der Test auch auf einem Mac ohne Team.
xcodebuild test \
  -project "$IOS/Brauweg.xcodeproj" \
  -scheme Brauweg \
  -destination "id=$GERAET" \
  -derivedDataPath "$IOS/build/DerivedData" \
  CODE_SIGNING_ALLOWED=NO
