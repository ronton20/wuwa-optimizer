#!/bin/sh
# usage: extract.sh <video> <outdir>  -> timer/ party/ e/ q/ r/ crops at 10 fps
v="$1"; o="$2"; mkdir -p "$o/timer" "$o/party" "$o/e" "$o/q" "$o/r"
ffmpeg -v error -y -i "$v" -filter_complex "fps=10,split=5[a][b][c][d][e];\
[a]crop=iw*0.11:ih*0.056:iw*0.445:ih*0.112,scale=-2:120,format=gray[t];\
[b]crop=iw*0.07:ih*0.36:iw*0.9:ih*0.18[p];\
[c]crop=iw*0.048:ih*0.075:iw*0.64+iw*0.36*0.52:ih*0.83+ih*0.13*0.25,scale=-2:120,format=gray[ce];\
[d]crop=iw*0.048:ih*0.075:iw*0.64+iw*0.36*0.66:ih*0.83+ih*0.13*0.25,scale=-2:120,format=gray[cq];\
[e]crop=iw*0.048:ih*0.075:iw*0.64+iw*0.36*0.80:ih*0.83+ih*0.13*0.25,scale=-2:120,format=gray[cr]" \
 -map "[t]" "$o/timer/%05d.png" -map "[p]" "$o/party/%05d.png" -map "[ce]" "$o/e/%05d.png" -map "[cq]" "$o/q/%05d.png" -map "[cr]" "$o/r/%05d.png"
