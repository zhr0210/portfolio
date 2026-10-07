"""Assemble image_gen checkpoints into a fixed 0..50 artistic animation.

This is offline animation interpolation, not RF/FLUX inversion. Generated source
images and the user's cover are read only. Only the PNG atlas is shipped to web.
Dependencies: numpy, Pillow, OpenCV (Apache-2.0); no model or GPU is required.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_rgb(path, size):
    with Image.open(path) as image:
        return np.asarray(image.convert("RGB").resize(size, Image.Resampling.LANCZOS)).copy()


def motion(before, after):
    # Estimate correspondence from structure, rather than treating fine grain
    # as independently moving scene features. Bound displacements at this scale.
    a = cv2.GaussianBlur(cv2.cvtColor(before, cv2.COLOR_RGB2GRAY), (5, 5), 1.1)
    b = cv2.GaussianBlur(cv2.cvtColor(after, cv2.COLOR_RGB2GRAY), (5, 5), 1.1)
    forward = cv2.calcOpticalFlowFarneback(a, b, None, 0.5, 4, 25, 5, 7, 1.5, 0)
    backward = cv2.calcOpticalFlowFarneback(b, a, None, 0.5, 4, 25, 5, 7, 1.5, 0)
    return np.clip(forward, -12, 12), np.clip(backward, -12, 12)


def intermediate(before, after, fields, fraction, preserve_texture=False):
    """Align structure; optionally preserve local fine-texture energy in between."""
    if fraction <= 0:
        return before.copy()
    if fraction >= 1:
        return after.copy()
    height, width = before.shape[:2]
    y, x = np.mgrid[:height, :width].astype(np.float32)
    forward, backward = fields
    sampling = cv2.INTER_CUBIC if preserve_texture else cv2.INTER_LINEAR
    a = cv2.remap(before, x - forward[..., 0] * fraction,
        y - forward[..., 1] * fraction, sampling, borderMode=cv2.BORDER_REFLECT_101)
    b = cv2.remap(after, x - backward[..., 0] * (1 - fraction),
        y - backward[..., 1] * (1 - fraction), sampling, borderMode=cv2.BORDER_REFLECT_101)
    # This is an authored transition between aligned predictions, not a claim
    # that a learned model calculated the missing denoising steps.
    a, b = a.astype(np.float32), b.astype(np.float32)
    prediction = a + fraction * (b - a)
    if preserve_texture:
        # Separate provisional structure from its own fine texture. Averaging
        # unrelated grains loses contrast, so match the interpolated endpoint
        # energy locally. No external noise or finished-photo overlay is added.
        # Box means are an analysis split, not a defocus filter on the output.
        low_a = cv2.boxFilter(a, -1, (5, 5))
        low_b = cv2.boxFilter(b, -1, (5, 5))
        detail_a, detail_b = a - low_a, b - low_b
        detail = detail_a + fraction * (detail_b - detail_a)
        energy_a = cv2.boxFilter(np.mean(detail_a ** 2, axis=2), -1, (9, 9))
        energy_b = cv2.boxFilter(np.mean(detail_b ** 2, axis=2), -1, (9, 9))
        expected = energy_a + fraction * (energy_b - energy_a)
        actual = cv2.boxFilter(np.mean(detail ** 2, axis=2), -1, (9, 9))
        gain = np.clip(np.sqrt((expected + 4) / (actual + 4)), 1, 1.65)
        prediction += detail * (gain[..., None] - 1)
    return np.clip(np.rint(prediction), 0, 255).astype(np.uint8)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoints", required=True, type=Path)
    parser.add_argument("--assets", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--width", type=int, default=512)
    args = parser.parse_args()
    definition = json.loads(args.checkpoints.read_text(encoding="utf-8"))
    checkpoints = definition["checkpoints"]
    maximum = definition["maximumStep"]
    steps = [entry["step"] for entry in checkpoints]
    if maximum != 50 or steps[0] != 0 or steps[-1] >= maximum or any(
        b <= a for a, b in zip(steps, steps[1:])):
        raise ValueError("Expected ordered checkpoints before the original cover at step 50")
    version = definition.get("assetVersion", "v2")
    if not re.fullmatch(r"v[0-9]+", version):
        raise ValueError("Use a simple asset version such as v3")
    detail_start = definition.get("detailStart", maximum * 0.72)
    if not 0 <= detail_start < maximum:
        raise ValueError("Detail restoration must start before the final step")
    motion_start = definition.get("motionStart", 2)
    interpolation = definition.get("interpolation", "aligned-residual")
    if interpolation not in ("aligned-residual", "texture-energy"):
        raise ValueError("Unsupported checkpoint interpolation")
    args.output.mkdir(parents=True, exist_ok=True)
    frame_dir = args.output / "frames"
    frame_dir.mkdir(exist_ok=True)
    source = args.assets / definition["reference"]["asset"]
    source_hash = digest(source)
    x, y, w, h = definition["reference"]["crop"]
    width = args.width
    height = round(width * h / w)
    if width < 128 or width * 8 > 4096:
        raise ValueError("Atlas must fit a 4096px mobile texture dimension")
    size = (width, height)
    with Image.open(source) as sheet:
        cover = np.asarray(sheet.convert("RGB").crop((x, y, x+w, y+h))
            .resize(size, Image.Resampling.LANCZOS)).copy()
    bank = [read_rgb(args.checkpoints.parent / entry["file"], size) for entry in checkpoints]
    bank.append(cover)
    steps.append(maximum)
    fields = []
    for index, (before, after) in enumerate(zip(bank, bank[1:])):
        # No visual features exist to track in the initial noise-only frame.
        fields.append(motion(before, after) if steps[index] >= motion_start else (
            np.zeros((*before.shape[:2], 2), np.float32),
            np.zeros((*before.shape[:2], 2), np.float32)))
    records, frames = [], []
    interval = 0
    for step in range(maximum + 1):
        while interval < len(steps) - 2 and step > steps[interval + 1]:
            interval += 1
        fraction = (step - steps[interval]) / (steps[interval+1] - steps[interval])
        frame = intermediate(bank[interval], bank[interval+1], fields[interval], fraction,
            preserve_texture=interpolation == "texture-energy")
        path = frame_dir / f"step-{step:03}.png"
        Image.fromarray(frame).save(path, compress_level=9)
        frames.append(frame)
        records.append({"step": step, "sha256": digest(path),
            "pixelsSha256": hashlib.sha256(frame.tobytes()).hexdigest(),
            "authoredCheckpoint": step in steps,
            "from": steps[interval], "to": steps[interval+1]})
    if len({record["pixelsSha256"] for record in records}) != maximum + 1:
        raise ValueError("The exported sequence must contain 51 distinct pixel states")
    if not np.array_equal(frames[-1], cover) or digest(source) != source_hash:
        raise ValueError("The original cover or final state changed")
    columns, rows = 8, 7
    atlas = Image.new("RGB", (columns * width, rows * height))
    for step, frame in enumerate(frames):
        atlas.paste(Image.fromarray(frame), ((step % columns) * width, (step // columns) * height))
    atlas_name = f"atonement-generation-50-{version}.png"
    atlas_path = args.assets / atlas_name
    if atlas_path.exists():
        raise FileExistsError("Use a new asset version instead of overwriting an existing atlas")
    atlas.save(atlas_path, compress_level=9)
    # Compact, labelled contact sheet for review; never used as a runtime texture.
    preview = Image.new("RGB", (5 * 256, 3 * 158), "#0c0d0e")
    draw = ImageDraw.Draw(preview)
    for index, step in enumerate(steps):
        px, py = (index % 5) * 256, (index // 5) * 158
        preview.paste(Image.fromarray(frames[step]).resize((256, 138)), (px, py))
        draw.text((px+6, py+140), f"KEY {index+1:02} / STEP {step:02}", fill="#d4d9df")
    preview.save(args.output / "checkpoints-preview.png")
    metadata = {
        "schemaVersion": 2, "kind": "imagegen-authored-baked-sequence", "simulation": True,
        "generator": "Built-in image_gen", "modelInference": False,
        "reference": {**definition["reference"], "sha256": source_hash},
        "processReference": definition.get("processReference"),
        "aesthetic": definition.get("aesthetic"),
        "atlas": {"asset": atlas_name, "width": columns*width, "height": rows*height,
            "columns": columns, "rows": rows, "cellWidth": width, "cellHeight": height,
            "bytes": atlas_path.stat().st_size, "sha256": digest(atlas_path), "lossless": True},
        "sequence": {"steps": list(range(maximum+1)), "posterFrame": maximum,
            "maximumStep": maximum, "mode": "baked", "detailStart": detail_start,
            "keyframeSteps": steps},
        "authoredCheckpoints": [{**entry, "sha256": digest(args.checkpoints.parent / entry["file"])}
            for entry in checkpoints],
        "bake": {"algorithm": "bounded bidirectional Farneback correspondence and aligned residual interpolation",
            "interpolation": interpolation, "maximumTextureGain": 1.65 if interpolation == "texture-energy" else 1,
            "opencvVersion": cv2.__version__, "maximumMotionPixels": 12,
            "motionStartStep": motion_start},
        "frames": records,
        "note": f"{len(checkpoints)} image_gen checkpoints plus the original cover are interpolated offline into 51 fixed artistic states. These are not 50 independent image_gen calls, RF inversion, FLUX inference outputs, or the original image's generation history.",
    }
    metadata_path = args.assets / f"atonement-generation-50-{version}.metadata.json"
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"frames": len(frames), "generatedCheckpoints": len(checkpoints),
        "atlasBytes": atlas_path.stat().st_size, "atlasSize": atlas.size,
        "sourcePreserved": True, "modelInference": False}, indent=2))


if __name__ == "__main__":
    main()
