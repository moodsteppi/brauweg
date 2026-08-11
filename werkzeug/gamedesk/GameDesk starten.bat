@echo off
rem GameDesk lokal starten. Ohne Python wird index.html direkt geoeffnet.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node nicht gefunden - oeffne index.html direkt im Browser.
  start "" "index.html"
  exit /b 0
)

echo Starte lokalen Server auf http://localhost:5190 ...
start "GameDesk Server" /min cmd /c node tools\serve.mjs 5190
timeout /t 2 /nobreak >nul
start "" http://localhost:5190/
echo.
echo Fertig. Das minimierte Fenster "GameDesk Server" schliessen beendet den Server.
exit /b 0
