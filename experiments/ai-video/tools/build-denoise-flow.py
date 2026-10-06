"""Bake bidirectional OpenCV Farneback flow for the authored generation atlas.

The source artwork and generated atlas are read only. The output is vector data,
not another edited artwork. OpenCV: https://github.com/opencv/opencv (Apache 2.0).
"""
import argparse
import json
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--metadata', required=True, type=Path)
    parser.add_argument('--opencv-path', type=Path)
    args = parser.parse_args()
    if args.opencv_path:
        sys.path.insert(0, str(args.opencv_path))
    import cv2
    import numpy as np

    metadata = json.loads(args.metadata.read_text(encoding='utf-8'))
    root = args.metadata.resolve().parent
    atlas = cv2.imread(str(root / metadata['atlas']['asset']))
    cover = cv2.imread(str(root / metadata['reference']['asset']))
    if atlas is None or cover is None:
        raise ValueError('Cannot decode the atlas or reference image')
    columns, rows = metadata['atlas']['columns'], metadata['atlas']['rows']
    width, height = 512, 276
    frames = []
    for index in range(len(metadata['sequence']['steps'])):
        col, row = index % columns, index // columns
        x0, x1 = round(col * atlas.shape[1] / columns), round((col + 1) * atlas.shape[1] / columns)
        y0, y1 = round(row * atlas.shape[0] / rows), round((row + 1) * atlas.shape[0] / rows)
        frame = atlas[y0:y1, x0:x1]
        if index == metadata['sequence']['posterFrame']:
            x, y, w, h = metadata['reference']['crop']
            frame = cover[y:y+h, x:x+w]
        frame = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
        frames.append(cv2.GaussianBlur(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (5, 5), 0.8))

    vector_range = metadata['flow']['range']
    center, scale = metadata['flow']['center'], metadata['flow']['scale']
    output = np.full((rows * height, columns * width, 4), center, dtype=np.uint8)
    movement = []
    for index, (before, after) in enumerate(zip(frames, frames[1:])):
        forward = cv2.calcOpticalFlowFarneback(before, after, None, 0.5, 5, 27, 5, 7, 1.5, 0)
        backward = cv2.calcOpticalFlowFarneback(after, before, None, 0.5, 5, 27, 5, 7, 1.5, 0)
        vectors = np.concatenate((forward, backward), axis=-1)
        vectors /= np.array([width, -height, width, -height], dtype=np.float32)
        vectors = np.clip(vectors, -vector_range, vector_range)
        encoded = np.rint(center + vectors / vector_range * scale).astype(np.uint8)
        col, row = index % columns, index // columns
        output[row*height:(row+1)*height, col*width:(col+1)*width] = encoded
        movement.append(float(np.mean(np.linalg.norm(vectors[..., :2], axis=-1))))
    # OpenCV stores BGRA; the browser reads RGBA. Alpha is the backward Y vector,
    # bounded to [32,224], not used for visual compositing or premultiplication.
    destination = root / metadata['flow']['asset']
    if not cv2.imwrite(str(destination), output[..., [2, 1, 0, 3]]):
        raise OSError('Unable to save flow texture')
    metadata['flow'].update({
        'width': columns * width, 'height': rows * height,
        'cellWidth': width, 'cellHeight': height, 'opencvVersion': cv2.__version__,
        'meanForwardMotion': movement, 'bytes': destination.stat().st_size,
    })
    args.metadata.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(metadata['flow'], indent=2))


if __name__ == '__main__':
    main()
