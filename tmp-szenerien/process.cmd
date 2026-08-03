@echo off
setlocal EnableExtensions
set RAW=C:\Users\Jan\.cursor\projects\c-Brauweg\assets
set HUB=C:\Brauweg\packages\client\public\hub
set TMP=C:\Brauweg\tmp-szenerien
if not exist "%TMP%" mkdir "%TMP%"

echo === Stube bleibt Kopie ===
if not exist "%HUB%\szene-stube.png" copy /Y "%HUB%\bg-spieltisch.png" "%HUB%\szene-stube.png" >nul

echo === Varianten 1024x1536 ===
for %%N in (filz-blau filz-rot filz-grau holz-hell winter sommer nacht) do (
  magick "%RAW%\szene-%%N-raw.png" -colorspace sRGB -alpha off -strip -resize "1024x1536^" -gravity center -extent 1024x1536 "%HUB%\szene-%%N.png"
  magick identify -format "%%f %%wx%%h\n" "%HUB%\szene-%%N.png"
)

rem Blau etwas weniger tuerkis, mehr Jeans
magick "%HUB%\szene-filz-blau.png" -modulate 100,95,94 "%HUB%\szene-filz-blau.png"

rem Sommer: Mitte der Flaeche etwas vergleichmaessigen (Stich-Zone)
magick "%HUB%\szene-sommer.png" ^
  ^( +clone -crop 410x540+307+460 +repage -blur 0x2.5 ^) ^
  -geometry +307+460 -compose over -composite "%HUB%\szene-sommer.png"

echo === Helligkeit Mitte (Soll mittel) ===
for %%N in (stube filz-blau filz-rot filz-grau holz-hell winter sommer nacht) do (
  magick "%HUB%\szene-%%N.png" -crop 410x540+307+460 +repage -colorspace Gray -format "%%f mean=%%[fx:mean]\n" info:
)

echo === Kontaktbogen ===
magick "%HUB%\szene-stube.png" "%HUB%\szene-filz-blau.png" "%HUB%\szene-filz-rot.png" "%HUB%\szene-filz-grau.png" +append -resize x384 "%TMP%\qa-satz-a.png"
magick "%HUB%\szene-holz-hell.png" "%HUB%\szene-winter.png" "%HUB%\szene-sommer.png" "%HUB%\szene-nacht.png" +append -resize x384 "%TMP%\qa-satz-b.png"

echo === Kartenprobe: Kreuz schwarz + Herz rot auf Mitte ===
for %%N in (stube filz-blau filz-rot filz-grau holz-hell winter sommer nacht) do (
  magick "%HUB%\szene-%%N.png" ^
    ^( -size 90x130 xc:white -fill black -draw "rectangle 8,8 82,122" -fill white -draw "rectangle 12,12 78,118" -fill black -font Arial-Bold -pointsize 48 -gravity center -annotate 0 "\x2663" ^) ^
    -geometry +350+700 -compose over -composite ^
    ^( -size 90x130 xc:white -fill black -draw "rectangle 8,8 82,122" -fill white -draw "rectangle 12,12 78,118" -fill red -font Arial-Bold -pointsize 48 -gravity center -annotate 0 "\x2665" ^) ^
    -geometry +520+700 -compose over -composite ^
    -crop 400x300+300+620 +repage "%TMP%\qa-karten-%%N.png"
)

echo DONE
