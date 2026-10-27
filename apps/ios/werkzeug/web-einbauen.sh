#!/bin/sh
# Build-Phase „Client ins Paket" (project.yml, postBuildScripts): legt den
# gebauten Web-Client als web/ ins App-Paket.
#
# Das Gegenstueck zu apps/android/werkzeug/web-uebernehmen.mjs. Gebaut wird
# der GEWOEHNLICHE Client, kein eigener App-Build: Die Huelle sagt ihm zur
# Laufzeit, wo der Server steht (window.BRAUWEG_APP, Huelle.swift). So laeuft
# in der App Zeichen fuer Zeichen derselbe Client wie auf der Webseite.
#
# Den Client baut dieses Skript NICHT selbst: In der Build-Phase von Xcode
# fehlt oft das `node` aus dem Terminal (Homebrew, nvm), und ein halber
# npm-Lauf im Xcode-Protokoll ist schwer zu lesen. Vorher im
# Repo-Wurzelverzeichnis:
#
#   npm ci && npm run build --workspace @brauweg/client
#
# werkzeug/app/ios-testflight.sh erledigt das selbst.
set -eu

QUELLE="$SRCROOT/../../packages/client/dist"
ZIEL="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/web"

if [ ! -f "$QUELLE/index.html" ]; then
  # Ohne Client gibt es keine App, die man verteilen duerfte. Im Debug-Bau
  # zeigt sie stattdessen einen Hinweis (PaketSchema.swift) — so laesst sich
  # die Huelle auch ohne Node im Simulator starten.
  if [ "${CONFIGURATION:-}" = "Release" ]; then
    echo "error: Kein gebauter Client unter $QUELLE. Vorher im Repo-Wurzelverzeichnis: npm ci && npm run build --workspace @brauweg/client"
    exit 1
  fi
  echo "warning: Kein gebauter Client unter $QUELLE — die App zeigt nur einen Hinweis. Vorher: npm run build --workspace @brauweg/client"
  rm -rf "$ZIEL"
  exit 0
fi

rm -rf "$ZIEL"
mkdir -p "$ZIEL"
ditto "$QUELLE" "$ZIEL"

# Was NICHT ins App-Paket gehoert — dieselbe Liste wie bei Android: Startbilder
# und Homescreen-Symbole der Safari-Fassung, Entwuerfe. Zusammen mehrere
# Megabyte, die jedes Geraet sonst mitschleppt, ohne sie je zu zeigen.
for weg in start hub-entwuerfe icon-1024.png appicon.png; do
  rm -rf "$ZIEL/$weg"
done

# Welcher Stand im Paket liegt: beantwortet „laeuft da wirklich der neue
# Client?", ohne zu raten — dieselbe Datei wie bei Android.
COMMIT="$(git -C "$SRCROOT" rev-parse --short HEAD 2>/dev/null || echo unbekannt)"
printf '{ "commit": "%s", "gebaut": "%s", "build": "%s", "server": "%s" }\n' \
  "$COMMIT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${CURRENT_PROJECT_VERSION:-}" "${BRAUWEG_API_BASE:-}" \
  > "$ZIEL/stand.json"

echo "Client liegt in $ZIEL ($(du -sh "$ZIEL" | cut -f1), Stand $COMMIT)."
