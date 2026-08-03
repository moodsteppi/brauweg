@echo off
set "IN=%~1"
set "OUT=%~2"
if "%OUT%"=="" set "OUT=%IN%"
magick "%IN%" -alpha set -fuzz 16%% ^
  -fill none -draw "color 0,0 floodfill" ^
  -fill none -draw "color %%[fx:w-1],0 floodfill" ^
  -fill none -draw "color 0,%%[fx:h-1] floodfill" ^
  -fill none -draw "color %%[fx:w-1],%%[fx:h-1] floodfill" ^
  -fuzz 12%% -transparent "rgb(32,105,252)" -transparent "rgb(40,120,255)" -transparent "rgb(20,90,240)" ^
  -trim +repage -bordercolor none -border 10 "%OUT%"
magick identify -format "%%f meanA=%%[fx:mean.a] corner=%%[pixel:p{2,2}]\n" "%OUT%"
