# App-Symbole der Android-Huelle aus dem Web-Symbol erzeugen.
#
# Quelle ist packages/client/public/icon-1024.png — dasselbe Bild wie auf dem
# Homescreen der Webseite. PLATZHALTER im Sinne von CLAUDE.md Regel 5: Es ist
# fuer iOS gemalt (eigene Rundung und Rahmen im Bild), ein eigens bestelltes
# Android-Symbol (Vordergrund mit Freiraum, ohne Rahmen) gibt es noch nicht.
#
# Nur Windows (System.Drawing). Aufruf aus dem Repo-Wurzelverzeichnis:
#   powershell -ExecutionPolicy Bypass -File apps/android/werkzeug/symbole.ps1
Add-Type -AssemblyName System.Drawing

$wurzel = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$quelle = Join-Path $wurzel 'packages\client\public\icon-1024.png'
$res = Join-Path $wurzel 'apps\android\app\src\main\res'
$bild = [System.Drawing.Image]::FromFile($quelle)

function Schreibe([int]$groesse, [string]$ziel) {
  $leinwand = New-Object System.Drawing.Bitmap $groesse, $groesse
  $g = [System.Drawing.Graphics]::FromImage($leinwand)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($bild, 0, 0, $groesse, $groesse)
  $g.Dispose()
  New-Item -ItemType Directory -Force (Split-Path $ziel) | Out-Null
  $leinwand.Save($ziel, [System.Drawing.Imaging.ImageFormat]::Png)
  $leinwand.Dispose()
}

# Klassisches Symbol (bis Android 7) und Vordergrund des adaptiven Symbols
# (108 dp; sichtbar ist die Mitte von 72 dp — dort sitzt der Pinguinkopf).
$dichten = @{ 'mdpi' = 1.0; 'hdpi' = 1.5; 'xhdpi' = 2.0; 'xxhdpi' = 3.0; 'xxxhdpi' = 4.0 }
foreach ($d in $dichten.Keys) {
  $f = $dichten[$d]
  Schreibe ([int](48 * $f)) (Join-Path $res "mipmap-$d\ic_launcher.png")
  Schreibe ([int](108 * $f)) (Join-Path $res "mipmap-$d\ic_launcher_vordergrund.png")
}
$bild.Dispose()
Write-Output 'Symbole geschrieben.'
