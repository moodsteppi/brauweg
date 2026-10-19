#!/usr/bin/env bash
# Ad 2 "Drei Staedte, eine Runde" — Schnitt 9:16, 28 s, nach konzept.md §3 und §8.
# Aufruf in Git Bash aus dem Arbeitsordner (quelle/, ebenen/ liegen daneben):
#   bash schnitt.sh <ausgabe.mp4>
set -euo pipefail
. ./ff.sh
AUS=${1:-ad-2-drei-staedte.mp4}
KLANG=/c/Users/robin/Broweg/repos/brauweg/packages/client/public/klang

cat > graph.txt <<'EOF'
[0:v]scale=3072:5504,setsar=1,
 zoompan=z='1.0667+0.0633*on/89':x='(2880-iw/zoom)/2':y='2720-ih/zoom/2':d=90:s=1080x1920:fps=30,
 format=yuv420p,setsar=1,trim=end_frame=90,setpts=PTS-STARTPTS[s1];
[1:v]trim=0.6:1.9,setpts=PTS-STARTPTS,fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,setsar=1[s2a];
[2:v]trim=0.0:1.3,setpts=PTS-STARTPTS,fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,setsar=1[s2b];
[3:v]trim=3.6:5.0,setpts=PTS-STARTPTS,fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,setsar=1[s2c];
[4:v]trim=0.3:1.6,setpts=PTS-STARTPTS,fps=30,crop=603:1072:952:0,scale=1080:1920:flags=lanczos,format=yuv420p,setsar=1[s3a];
[5:v]trim=0.0:1.3,setpts=PTS-STARTPTS,fps=30,crop=603:1072:750:0,scale=1080:1920:flags=lanczos,format=yuv420p,setsar=1[s3b];
[6:v]trim=0.0:1.4,setpts=PTS-STARTPTS,fps=30,crop=603:1072:817:0,scale=1080:1920:flags=lanczos,format=yuv420p,setsar=1[s3c];
[7:v]split[f4a][f4b];[f4a][f4b]freezeframes=first=65:last=66:replace=64,trim=0:6,setpts=PTS-STARTPTS,fps=30,format=yuv420p,setsar=1[s4];
[8:v]split[a5x][a5y];
[a5x]trim=0:2.9,setpts=PTS-STARTPTS[a5x1];[a5y]trim=4.0:5.0,setpts=PTS-STARTPTS[a5y1];
[a5x1][a5y1]concat=n=2:v=1:a=0[a5k];
[a5k]setpts=PTS*6/3.9,framerate=fps=30,tpad=stop_mode=clone:stop_duration=0.2,trim=0:6,setpts=PTS-STARTPTS,scale=-2:640,crop=1080:640,setsar=1[p5a];
[9:v]trim=0:5.0,setpts=PTS-STARTPTS,setpts=PTS*1.2,framerate=fps=30,tpad=stop_mode=clone:stop_duration=0.2,trim=0:6,setpts=PTS-STARTPTS,scale=-2:640,crop=1080:640,setsar=1[p5b];
[10:v]trim=0:5.0,setpts=PTS-STARTPTS,setpts=PTS*1.2,framerate=fps=30,tpad=stop_mode=clone:stop_duration=0.2,trim=0:6,setpts=PTS-STARTPTS,scale=-2:640,crop=1080:640,setsar=1[p5c];
[p5a][p5b][p5c]vstack=inputs=3,drawbox=x=0:y=637:w=1080:h=6:color=0x0e1a3d:t=fill,drawbox=x=0:y=1277:w=1080:h=6:color=0x0e1a3d:t=fill,format=yuv420p,setsar=1[s5];
[11:v]trim=end_frame=150,setpts=PTS-STARTPTS,fps=30,format=yuv420p,setsar=1[s6];
[s1][s2a][s2b][s2c][s3a][s3b][s3c][s4][s5][s6]concat=n=10:v=1:a=0[vk];
[vk][12:v]overlay=enable='between(t,0.3,3.0)'[v1];
[v1][13:v]overlay=enable='between(t,3.0,7.0)'[v2];
[v2][14:v]overlay=enable='between(t,7.0,11.0)'[v3];
[v3][15:v]overlay=enable='between(t,7.0,8.3)'[v4];
[v4][16:v]overlay=enable='between(t,8.3,9.6)'[v5];
[v5][17:v]overlay=enable='between(t,9.6,11.0)'[v6];
[v6][18:v]overlay=enable='between(t,11.4,17.0)'[v7];
[v7][19:v]overlay=enable='between(t,17.0,23.0)',format=yuv420p[vout];
[20:a]atrim=start=46:duration=28.2,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,
 volume='if(lt(t,7),0.5,if(lt(t,9),0.5+0.5*(t-7)/2,1))':eval=frame,afade=t=in:d=1.2,afade=t=out:st=24.0:d=4.0[mus];
[21:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.45,adelay=150:all=1[papier];
anoisesrc=color=white:d=0.9:a=0.5:r=48000,bandpass=f=2600:w=2200,tremolo=f=26:d=0.85,afade=t=in:d=0.05,afade=t=out:st=0.6:d=0.3,aformat=channel_layouts=stereo,volume=0.55,adelay=3150:all=1[band];
anoisesrc=color=brown:d=1.6:a=0.9:r=48000,highpass=f=40,lowpass=f=600,afade=t=in:d=0.5,afade=t=out:st=0.9:d=0.7,aformat=channel_layouts=stereo,volume=0.9,adelay=4150:all=1[zug];
anoisesrc=color=pink:d=1.5:a=0.25:r=48000,highpass=f=900,lowpass=f=7000,afade=t=in:d=0.25,afade=t=out:st=1.0:d=0.5,aformat=channel_layouts=stereo,adelay=7000:all=1[regen];
[22:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=13000:all=1[karte];
[23:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=14770:all=1[stich];
[mus][papier][band][zug][regen][karte][stich]amix=inputs=7:duration=first:dropout_transition=0:normalize=0,
 atrim=0:28,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]
EOF

"$FF/ffmpeg.exe" -v warning -stats -y \
  -loop 1 -framerate 30 -t 3 -i quelle/s1.png \
  -i quelle/v-2a.mp4 -i quelle/v-2b.mp4 -i quelle/v-2c.mp4 \
  -i quelle/v-3a.mp4 -i quelle/v-3b.mp4 -i quelle/v-3c.mp4 \
  -i quelle/s4.mp4 \
  -i quelle/v-5a.mp4 -i quelle/v-5b-n.mp4 -i quelle/v-5c.mp4 \
  -loop 1 -framerate 30 -t 5 -i ebenen/endkarte.png \
  -loop 1 -framerate 30 -t 28 -i ebenen/t1.png \
  -loop 1 -framerate 30 -t 28 -i ebenen/t2.png \
  -loop 1 -framerate 30 -t 28 -i ebenen/t3.png \
  -loop 1 -framerate 30 -t 28 -i ebenen/o-hamburg.png \
  -loop 1 -framerate 30 -t 28 -i ebenen/o-koeln.png \
  -loop 1 -framerate 30 -t 28 -i ebenen/o-leipzig.png \
  -loop 1 -framerate 30 -t 28 -i ebenen/t4.png \
  -loop 1 -framerate 30 -t 28 -i ebenen/streifen.png \
  -i "$KLANG/musik-traeume.mp3" \
  -i "$KLANG/karte-geben-1.mp3" \
  -i "$KLANG/karte-legen-1.mp3" \
  -i "$KLANG/stich-ein-1.mp3" \
  -/filter_complex graph.txt -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -t 28 "${AUS%.mp4}-roh.mp4"

# loudnorm in einem Durchgang landet bei -14,7 LUFS statt -16 (dynamisch, ohne Messlauf).
# Ein fester Abschlag trifft das Ziel, ohne die Mischung noch einmal anzufassen.
"$FF/ffmpeg.exe" -v error -y -i "${AUS%.mp4}-roh.mp4" -map 0 -c:v copy -af volume=-1.3dB   -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$AUS"
