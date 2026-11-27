#!/bin/sh
# bar.sh <video> <start> <dur> <out.png>: 10 fps skill-bar + timer strips, 5 columns x 12 rows (6 s)
ffmpeg -v error -y -ss "$2" -t "$3" -i "$1" -filter_complex "fps=10,split[a][b];[a]crop=iw*0.30:ih*0.1:iw*0.68:ih*0.85,scale=360:-2[bar];[b]crop=iw*0.08:ih*0.045:iw*0.46:ih*0.117,scale=110:-2[tm];[bar][tm]overlay=0:0,drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='%{pts\:hms}':x=w-110:y=2:fontsize=14:fontcolor=yellow:box=1:boxcolor=black@0.7,tile=5x12" -frames:v 1 "$4" 2>&1 | grep -v Fontconfig
