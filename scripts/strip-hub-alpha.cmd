@echo off
REM Remove baked white/checkerboard matte from a PNG via corner flood-fill.
REM Usage: strip-hub-alpha.cmd input.png output.png
setlocal
if "%~2"=="" (
  echo Usage: %~nx0 input.png output.png
  exit /b 1
)
magick "%~1" -alpha set -fuzz 14%% -fill none ^
  -draw "color 0,0 floodfill" ^
  -draw "color %%[fx:w-1],0 floodfill" ^
  -draw "color 0,%%[fx:h-1] floodfill" ^
  -draw "color %%[fx:w-1],%%[fx:h-1] floodfill" ^
  -trim +repage -bordercolor none -border 16 "%~2"
magick identify -format "%%f %%wx%%h meanA=%%[fx:mean.a] corner=%%[pixel:p{2,2}]\n" "%~2"
