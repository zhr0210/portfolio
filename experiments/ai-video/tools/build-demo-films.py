"""Small silent H.264 preview films animated from the existing user cover.
These are motion placeholders, not real camera footage or AI-generated videos.
"""
import hashlib
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg

assets = Path(__file__).resolve().parents[1] / 'assets'
source = assets / 'vertical-film-sheet.jpg'
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
names = ['atonement-live', 'light-live', 'space-live', 'atonement-ai', 'texture-ai', 'echo-ai']
records = []
for index, name in enumerate(names):
    target = assets / f'demo-{name}.mp4'
    amplitude = 0.018 + index * 0.004
    filters = (f"crop=2196:1184:843:500,scale=1920:1036,"
        f"zoompan=z='1+{amplitude}*(1-cos(2*PI*on/240))/2':"
        f"x='(iw-iw/zoom)*(0.5+0.28*sin(2*PI*on/240))':"
        f"y='(ih-ih/zoom)*(0.5+0.2*sin(2*PI*on/240))':d=1:s=960x518:fps=30")
    subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
        '-loop', '1', '-framerate', '30', '-i', str(source), '-vf', filters,
        '-frames:v', '240', '-an', '-c:v', 'libx264', '-preset', 'fast',
        '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(target)], check=True)
    records.append({'asset': target.name, 'work': name, 'bytes': target.stat().st_size,
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'filter': filters})
(assets / 'demo-films.metadata.json').write_text(json.dumps({
    'kind': 'animated-cover-preview', 'realFootage': False, 'modelInference': False,
    'source': source.name, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'crop': [843, 500, 2196, 1184], 'durationSeconds': 8, 'fps': 30, 'frames': 240,
    'dimensions': [960, 518], 'codec': 'H.264', 'silent': True, 'films': records,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'films': len(records), 'totalBytes': sum(r['bytes'] for r in records)}))
