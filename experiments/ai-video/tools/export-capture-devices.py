"""Export the two finished devices from a saved Blender file in a background process.

Run Blender with --background --disable-autoexec before loading the source file.
This script changes only its process-local copy and never saves the .blend file.
"""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import sys
import tempfile

import bpy


ROOT_NAMES = {"sony": "z轴移动", "pocket": "空物体"}
FRAME_START = 0
FRAME_END = 144
FPS = 24
CLIP_NAME = "CaptureDevices"


def parse_arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--metadata", type=Path)
    parser.add_argument("--max-texture-size", type=int, default=1024)
    parser.add_argument("--texture-quality", type=int, default=90)
    extra = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(extra)


def rounded(values):
    return [round(float(v), 7) for v in values]


def read_glb(path):
    data = path.read_bytes()
    if struct.unpack_from("<III", data, 0) != (0x46546C67, 2, len(data)):
        raise RuntimeError("Invalid GLB header")
    length, kind = struct.unpack_from("<II", data, 12)
    if kind != 0x4E4F534A:
        raise RuntimeError("GLB JSON chunk is missing")
    return json.loads(data[20 : 20 + length])


def keyframes(action):
    """Blender 5.2 layered actions expose F-curves through channel bags."""
    return sorted(
        {
            float(point.co.x)
            for layer in action.layers
            for strip in layer.strips
            for bag in strip.channelbags
            for curve in bag.fcurves
            for point in curve.keyframe_points
        }
    )


def prepare_textures(materials, max_size, temporary_directory):
    copies = {}
    records = []
    for material in materials:
        if material.node_tree is None:
            continue
        for node in material.node_tree.nodes:
            image = node.image if node.type == "TEX_IMAGE" else None
            if image is None:
                continue
            if image not in copies:
                original_size = list(image.size)
                if not all(original_size):
                    raise RuntimeError(f"Missing image pixels: {image.name}")
                copy = image.copy()
                copy.name = image.name + "_web"
                width, height = original_size
                ratio = min(1.0, max_size / max(width, height))
                output_size = [max(1, round(width * ratio)), max(1, round(height * ratio))]
                if output_size != original_size:
                    copy.scale(*output_size)
                # Saving the process-local copy also prevents the exporter from
                # reusing packed bytes from the original 4K image after resizing.
                copy.filepath_raw = str(Path(temporary_directory) / f"image-{len(copies)}.png")
                copy.file_format = "PNG"
                copy.save()
                copy.pack()
                copies[image] = copy
                records.append(
                    {"name": image.name, "sourceSize": original_size, "webSize": output_size}
                )
            node.image = copies[image]
    return records


def remove_unused_uv_layers(meshes):
    removed = 0
    for obj in meshes:
        uv_layers = obj.data.uv_layers
        if not uv_layers:
            continue
        materials = [material for material in obj.data.materials if material]
        has_texture = any(
            node.type == "TEX_IMAGE" and node.image
            for material in materials if material.node_tree
            for node in material.node_tree.nodes
        )
        named_maps = {
            node.uv_map
            for material in materials if material.node_tree
            for node in material.node_tree.nodes
            if node.type == "UVMAP" and node.uv_map
        }
        if len(named_maps) > 1:
            raise RuntimeError(f"Review multiple material UV maps on {obj.name}")
        chosen = next(iter(named_maps)) if named_maps else next(
            (layer.name for layer in uv_layers if layer.active_render), uv_layers[0].name
        )
        if named_maps and chosen not in uv_layers:
            raise RuntimeError(f"Required UV map {chosen} is missing on {obj.name}")
        # Pocket's screen explicitly uses UVMap.004. Keep its coordinates,
        # discard the four unused sets, and let glTF map it to TEXCOORD_0.
        for layer in list(uv_layers):
            if not has_texture or layer.name != chosen:
                uv_layers.remove(layer)
                removed += 1
        if uv_layers:
            uv_layers.active_index = 0
            uv_layers[0].active_render = True
    return removed


def main():
    args = parse_arguments()
    if not bpy.app.background:
        raise RuntimeError("Use a background Blender process; do not run this in the live editor")
    source = Path(bpy.data.filepath)
    if not source.is_file():
        raise RuntimeError("Load the saved source .blend file before running this script")
    args.output = args.output.resolve()
    if args.output.suffix.lower() != ".glb":
        raise RuntimeError("The output must be a .glb file")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    metadata_path = args.metadata or args.output.with_suffix(".metadata.json")
    scene = bpy.context.scene
    source_camera = scene.camera
    if source_camera is None or source_camera.data.type != "PERSP":
        raise RuntimeError("The source perspective camera is missing")
    roots = {key: bpy.data.objects[name] for key, name in ROOT_NAMES.items()}
    selected = set()
    for root in roots.values():
        selected.add(root)
        selected.update(root.children_recursive)
    area_lights = [obj for obj in selected if obj.type == "LIGHT"]
    selected.difference_update(area_lights)
    selected.add(source_camera)
    if any(obj.type not in {"MESH", "EMPTY", "CAMERA"} for obj in selected):
        raise RuntimeError("Unexpected object type in device subtrees")
    if any(obj.constraints for obj in selected):
        raise RuntimeError("The source now contains constraints; review the baking strategy")
    if any(obj.animation_data and obj.animation_data.drivers for obj in selected):
        raise RuntimeError("The source now contains drivers; review the baking strategy")

    source_camera.name = "sourceCamera"
    scene.frame_start = FRAME_START
    scene.frame_end = FRAME_END
    scene.render.fps = FPS
    scene.render.fps_base = 1.0
    scene.frame_set(FRAME_START)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in selected:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = roots["sony"]
    meshes = [obj for obj in selected if obj.type == "MESH"]
    materials = sorted({m for obj in meshes for m in obj.data.materials if m}, key=lambda m: m.name)
    triangles = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    removed_uv_layers = remove_unused_uv_layers(meshes)

    actions = [
        {"object": obj.name, "action": obj.animation_data.action.name,
         "keyFrames": keyframes(obj.animation_data.action)}
        for obj in sorted(selected, key=lambda o: o.name)
        if obj.animation_data and obj.animation_data.action
    ]
    camera = {
        "node": "sourceCamera",
        "type": source_camera.data.type,
        "lensMm": source_camera.data.lens,
        "sensorWidthMm": source_camera.data.sensor_width,
        "sourceAspect": 1920 / 1080,
        "sourceResolution": [1920, 1080],
        "blenderPosition": rounded(source_camera.matrix_world.translation),
        "blenderQuaternionWxyz": rounded(source_camera.matrix_world.to_quaternion()),
    }
    light_records = [
        {"name": obj.name, "type": obj.data.type, "parent": obj.parent.name,
         "energy": obj.data.energy, "color": rounded(obj.data.color),
         "size": obj.data.size, "blenderPositionAtFrame0": rounded(obj.matrix_world.translation),
         "blenderQuaternionWxyz": rounded(obj.matrix_world.to_quaternion())}
        for obj in sorted(area_lights, key=lambda o: o.name)
    ]
    with tempfile.TemporaryDirectory(prefix="portfolio-device-textures-") as temporary_directory:
        texture_records = prepare_textures(materials, args.max_texture_size, temporary_directory)
        bpy.ops.export_scene.gltf(
            filepath=str(args.output),
            export_format="GLB",
            use_selection=True,
            export_cameras=True,
            export_lights=False,
            export_animations=True,
            export_animation_mode="SCENE",
            export_nla_strips_merged_animation_name=CLIP_NAME,
            export_frame_range=True,
            export_frame_step=1,
            export_force_sampling=True,
            export_sampling_interpolation_fallback="LINEAR",
            export_optimize_animation_size=False,
            export_optimize_animation_keep_anim_object=False,
            export_bake_animation=False,
            export_current_frame=False,
            export_image_format="WEBP",
            export_image_quality=args.texture_quality,
            export_image_webp_fallback=False,
            export_unused_images=False,
            export_unused_textures=False,
            export_texcoords=True,
            export_normals=True,
            export_tangents=False,
            export_extras=False,
            export_vertex_color="NONE",
            export_hierarchy_flatten_objs=False,
            export_meshopt_compression_enable=False,
            export_draco_mesh_compression_enable=False,
        )
    gltf = read_glb(args.output)
    node_names = {node.get("name", "") for node in gltf["nodes"]}
    if any("无人机" in name or name in {"Cam tilt", "mesh_18_217.nr", "mesh_18_220.nr", "mesh_0_0.nr"} for name in node_names):
        raise RuntimeError("An excluded source object leaked into the GLB")
    if not {"sourceCamera", *ROOT_NAMES.values()}.issubset(node_names):
        raise RuntimeError("A required camera or device root is missing")
    clips = gltf.get("animations", [])
    if not clips:
        raise RuntimeError("The shared scene timeline was not exported")
    # Blender Scene mode samples a common timeline but emits separate clips
    # for objects. Merge their channel references without shifting any samples.
    merge_glb_clips(args.output, CLIP_NAME)
    gltf = read_glb(args.output)
    clip = gltf["animations"][0]
    duration = max(gltf["accessors"][sampler["input"]]["max"][0] for sampler in clip["samplers"])
    if abs(duration - FRAME_END / FPS) > 1e-6:
        raise RuntimeError(f"Unexpected clip duration: {duration}")
    camera["gltfPerspective"] = gltf["cameras"][0]["perspective"]
    camera["verticalFovDegrees"] = math.degrees(camera["gltfPerspective"]["yfov"])
    report = {
        "schemaVersion": 1,
        "sourceFile": source.name,
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "exporter": f"Blender {bpy.app.version_string}",
        "asset": args.output.name,
        "bytes": args.output.stat().st_size,
        "roots": ROOT_NAMES,
        "camera": camera,
        "timeline": {"clip": CLIP_NAME, "startFrame": FRAME_START, "endFrame": FRAME_END,
                     "fps": FPS, "durationSeconds": duration, "sampleStepFrames": 1,
                     "sonyRange": [0, 108], "pocketRange": [36, 144], "gimbalRange": [62, 138]},
        "sourceGeometry": {"meshes": len(meshes), "triangles": triangles, "materials": len(materials)},
        "removedUnusedUvLayers": removed_uv_layers,
        "gltf": {"nodes": len(gltf["nodes"]), "meshes": len(gltf["meshes"]),
                 "materials": len(gltf.get("materials", [])), "animations": len(gltf["animations"]),
                 "animationChannels": len(clip["channels"]), "extensionsRequired": gltf.get("extensionsRequired", [])},
        "actions": actions,
        "textures": texture_records,
        "sourceAreaLights": light_records,
        "excluded": ["无人机 collection", "Pocket unparented original fragments", "AREA lights"],
        "rendering": {"sourceViewTransform": scene.view_settings.view_transform,
                      "sourceExposure": scene.view_settings.exposure,
                      "note": "Use the exported camera and a shared timeline. Do not add a second DOM translation or fit each model to its bounds."},
    }
    metadata_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("CAPTURE_EXPORT=" + json.dumps(report, ensure_ascii=False), flush=True)


def merge_glb_clips(path, name):
    data = path.read_bytes()
    old_json_length, _ = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20 : 20 + old_json_length])
    merged = {"name": name, "channels": [], "samplers": []}
    targets = set()
    for clip in gltf["animations"]:
        offset = len(merged["samplers"])
        merged["samplers"].extend(clip["samplers"])
        for channel in clip["channels"]:
            target = (channel["target"]["node"], channel["target"]["path"])
            if target in targets:
                raise RuntimeError("Conflicting animation channels on the shared timeline")
            targets.add(target)
            channel["sampler"] += offset
            merged["channels"].append(channel)
    gltf["animations"] = [merged]
    json_bytes = json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((-len(json_bytes)) % 4)
    tail = data[20 + old_json_length :]
    total = 12 + 8 + len(json_bytes) + len(tail)
    path.write_bytes(struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes + tail)


if __name__ == "__main__":
    main()
