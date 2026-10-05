"""Export the two finished devices from a saved Blender file in a background process.

Run Blender with --background --disable-autoexec before loading the source file.
The original .blend is never overwritten. --save-blend-copy can save a separate,
full-resolution material-adjusted authoring file before web-only optimization.
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
import numpy as np


ROOT_NAMES = {"sony": "z轴移动", "pocket": "空物体"}
FRAME_START = 0
FRAME_END = 144
FPS = 24
CLIP_NAME = "CaptureDevices"
MATTE_PROFILE = "portfolio-matte-v2"
DISPLAY_SCALE = 1.12
BODY_MATERIALS = {
    "Sony_A7RM3_Body_Mat": "sony-body",
    "Sony24_70G_Body_Mat": "sony-lens-barrel",
    "mat_0.007": "pocket-shell",
}


def parse_arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--metadata", type=Path)
    parser.add_argument("--material-profile", choices=["source", "matte"], default="matte")
    parser.add_argument("--save-blend-copy", type=Path)
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


def packed_png_copy(image, name, path, pixels=None):
    """Save current pixels, then pack a freshly loaded PNG with no stale bytes.

    Image.copy() alone omits unsaved edits and retains the original packed
    file. Image.pack() on that copy can therefore keep old DDS/ORM data.
    """
    if pixels is None:
        pixels = np.empty(len(image.pixels), dtype=np.float32)
        image.pixels.foreach_get(pixels)
    copy = image.copy()
    copy.pixels.foreach_set(pixels)
    copy.update()
    copy.filepath_raw = str(path)
    copy.file_format = "PNG"
    copy.save()
    result = bpy.data.images.load(str(path), check_existing=False)
    result.name = name
    result.colorspace_settings.name = image.colorspace_settings.name
    result.alpha_mode = image.alpha_mode
    result.pack()
    bpy.data.images.remove(copy)
    return result


def prepare_textures(materials, temporary_directory):
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
                output_size = original_size.copy()
                # Preserve native dimensions and encode without lossy texture compression.
                # PNG's lossless encoding also decodes imported DDS pixels for the web.
                copy = packed_png_copy(image, image.name + "_web",
                                       Path(temporary_directory) / f"image-{len(copies)}.png")
                copies[image] = copy
                records.append(
                    {"name": image.name, "sourceSize": original_size, "webSize": output_size,
                     "format": "PNG", "resized": False, "lossyCompression": False}
                )
            node.image = copies[image]
    return records


def principled(material):
    return next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)


def set_unlinked_value(material, shader, name, value):
    socket = shader.inputs[name]
    for link in list(socket.links):
        material.node_tree.links.remove(link)
    socket.default_value = value


def apply_matte_profile(meshes, roots, temporary_directory):
    """Change selected body material copies, never shared drone/source materials.

    Sony's ORM metal mask still preserves metal rings and contacts. Pocket's
    imported shell atlas misclassifies much of its plastic as metal, so only
    that material gets a nonmetal matte mask. Screens, optical coatings, the
    viewfinder and separate small metal materials retain their source nodes.
    """
    records = []
    copied = {}
    for obj in meshes:
        for slot in obj.material_slots:
            source_material = slot.material
            if source_material is None:
                continue
            original_name = source_material.get("portfolio_source_material", source_material.name)
            kind = BODY_MATERIALS.get(original_name)
            if kind is None:
                continue
            previous_profile = source_material.get("portfolio_material_profile")
            if previous_profile and previous_profile != MATTE_PROFILE:
                raise RuntimeError("Use the original saved .blend to upgrade an older material profile")
            if source_material.get("portfolio_material_profile") == MATTE_PROFILE:
                if source_material not in copied:
                    records.append(json.loads(source_material["portfolio_material_record"]))
                    copied[source_material] = source_material
                continue
            if source_material in copied:
                slot.material = copied[source_material]
                continue
            material = source_material.copy()
            material.name = "Pocket3_Body_Matte" if kind == "pocket-shell" else original_name + "_web_matte"
            material["portfolio_source_material"] = original_name
            material["portfolio_material_profile"] = MATTE_PROFILE
            shader = principled(material)
            if shader is None:
                raise RuntimeError(f"Missing body Principled material: {original_name}")
            roughness_socket = shader.inputs["Roughness"]
            if not roughness_socket.is_linked:
                raise RuntimeError(f"Review new untextured body material: {original_name}")
            separate = roughness_socket.links[0].from_node
            if separate.type != "SEPARATE_COLOR" or not separate.inputs["Color"].is_linked:
                raise RuntimeError(f"Review new ORM node layout: {original_name}")
            texture = separate.inputs["Color"].links[0].from_node
            if texture.type != "TEX_IMAGE" or texture.image is None:
                raise RuntimeError(f"Review new ORM texture: {original_name}")
            original_image = texture.image
            pixels = np.empty(len(original_image.pixels), dtype=np.float32)
            original_image.pixels.foreach_get(pixels)
            values = pixels.reshape((-1, 4))
            sample = values[::max(1, len(values) // 65536)]
            before = {"roughnessMean": float(sample[:, 1].mean()),
                      "metallicMean": float(sample[:, 2].mean()),
                      "specularIORLevel": float(shader.inputs["Specular IOR Level"].default_value),
                      "specularLinked": shader.inputs["Specular IOR Level"].is_linked,
                      "coatWeight": float(shader.inputs["Coat Weight"].default_value)}
            if kind == "pocket-shell":
                # Source mat_0.002_0.005 and mat_0.006 have roughness=1, coat=0.
                # They are lettering/marks, so use their finish as a reference,
                # keeping the shell's own high-resolution albedo, normal and AO.
                values[:, 1] = 1.0
                values[:, 2] = 0.0
                specular = 0.28
                treatment = "Unified graphite plastic shell: roughness 1, metallic 0, coat 0, specular 0.28; reference source mat_0.002_0.005/mat_0.006 matte finish, preserve shell albedo/normal/AO, apply neutral 0.9 color tint."
                base = shader.inputs["Base Color"]
                color_link = base.links[0]
                # Blender 5.2 glTF recognizes the modern Mix node's constant
                # multiplier; legacy MixRGB renders in Blender but loses its
                # tint on export.
                tint = material.node_tree.nodes.new("ShaderNodeMix")
                tint.label = "Unified graphite body color"
                tint.data_type = "RGBA"
                tint.blend_type = "MULTIPLY"
                next(s for s in tint.inputs if s.type == "VALUE" and s.name == "Factor").default_value = 1.0
                color_inputs = [s for s in tint.inputs if s.type == "RGBA"]
                color_inputs[1].default_value = (0.9, 0.9, 0.9, 1.0)
                material.node_tree.links.new(color_link.from_socket, color_inputs[0])
                material.node_tree.links.new(next(s for s in tint.outputs if s.type == "RGBA"), base)
            else:
                nonmetal = values[:, 2] < 0.5
                values[nonmetal, 1] = np.minimum(1.0, np.maximum(0.64, values[nonmetal, 1] * 0.9 + 0.14))
                specular = 0.35
                treatment = "Nonmetal body/barrel ORM roughness: max(0.64, source * 0.9 + 0.14), capped at 1; keep metal-mask pixels unchanged."
            adjusted_image = packed_png_copy(original_image, original_image.name + "_web_matte",
                                             Path(temporary_directory) / f"matte-orm-{len(copied)}.png", pixels)
            # Body AO and metallic nodes may reference the same atlas; reconnect
            # all of this material's references, but leave other materials alone.
            for node in material.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image == original_image:
                    node.image = adjusted_image
            set_unlinked_value(material, shader, "Specular IOR Level", specular)
            set_unlinked_value(material, shader, "Coat Weight", 0.0)
            material.node_tree.nodes.active = shader
            record = {"sourceMaterial": original_name, "material": material.name,
                      "kind": kind, "sourceOrm": original_image.name,
                      "adjustedOrm": adjusted_image.name, "before": before,
                      "after": {"roughnessMean": float(sample[:, 1].mean()),
                                "metallicMean": float(sample[:, 2].mean()),
                                "specularIORLevel": specular, "coatWeight": 0.0},
                      "treatment": treatment}
            if kind == "pocket-shell":
                record["referenceMaterials"] = ["mat_0.002_0.005", "mat_0.006"]
                record["baseColorFactor"] = [0.9, 0.9, 0.9, 1.0]
                record["preservedRoles"] = ["mat_0.008 display/button UV", "Material.006 lens coating", "mat_2.006 lens elements", "mat_0.002_0.005 and mat_0.006 lettering/marks"]
            material["portfolio_material_record"] = json.dumps(record)
            records.append(record)
            copied[source_material] = material
            slot.material = material
    for root in roots.values():
        # This is an authoring/display preference, not a transform multiplier.
        # The website applies it once; source motion and model units stay intact.
        root["portfolio_web_display_scale"] = DISPLAY_SCALE
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
    source_sha256 = hashlib.sha256(source.read_bytes()).hexdigest()
    blend_copy = args.save_blend_copy.resolve() if args.save_blend_copy else None
    if blend_copy and (blend_copy == source.resolve() or blend_copy.suffix.lower() != ".blend"):
        raise RuntimeError("The authoring copy must be a separate .blend path; never overwrite the source")
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

    meshes = [obj for obj in selected if obj.type == "MESH"]
    material_records = []
    if args.material_profile == "matte":
        with tempfile.TemporaryDirectory(prefix="portfolio-device-matte-") as temporary_directory:
            material_records = apply_matte_profile(meshes, roots, temporary_directory)
            if blend_copy:
                blend_copy.parent.mkdir(parents=True, exist_ok=True)
                # Save before changing camera names, timeline settings, UV sets
                # or texture resolution. Drone materials and all original
                # actions remain untouched in this complete authoring copy.
                bpy.ops.wm.save_as_mainfile(filepath=str(blend_copy), copy=True)
    elif blend_copy:
        raise RuntimeError("--save-blend-copy requires the matte material profile")

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
        texture_records = prepare_textures(materials, temporary_directory)
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
            # AUTO preserves the PNG images prepared above; PNG is not an
            # export_image_format enum in Blender 5.2's glTF exporter.
            export_image_format="AUTO",
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
    validate_texture_export(args.output, gltf, texture_records, material_records)
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
        "sourceSha256": source_sha256,
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
        "texturePolicy": {"resolution": "native", "format": "PNG", "lossyCompression": False,
                          "resampling": False, "meshCompression": False},
        "sourceAreaLights": light_records,
        "materialProfile": {"name": MATTE_PROFILE if args.material_profile == "matte" else "source",
                            "displayScalePreference": DISPLAY_SCALE if args.material_profile == "matte" else 1.0,
                            "authoringCopy": blend_copy.name if blend_copy else None,
                            "adjustments": material_records,
                            "preserved": ["Sony lens glass and viewfinder", "Pocket mat_0.008 optical/display material",
                                          "Pocket Material.006 optical coating", "separate Pocket metal materials",
                                          "metal pixels in Sony body/barrel ORM", "base-color and normal textures",
                                          "all source transforms and animation curves", "unselected materials, including drone"]},
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


def validate_texture_export(path, gltf, texture_records, material_records):
    """Check actual embedded bytes, not just the requested export settings."""
    data = path.read_bytes()
    json_length, _ = struct.unpack_from("<II", data, 12)
    binary_start = 28 + json_length
    source_sizes = {tuple(record["sourceSize"]) for record in texture_records}
    for image in gltf.get("images", []):
        if image.get("mimeType") != "image/png" or "bufferView" not in image:
            raise RuntimeError("Every exported texture must be an embedded lossless PNG")
        view = gltf["bufferViews"][image["bufferView"]]
        start = binary_start + view.get("byteOffset", 0)
        if data[start : start + 8] != b"\x89PNG\r\n\x1a\n":
            raise RuntimeError("An exported texture is not PNG encoded")
        size = struct.unpack_from(">II", data, start + 16)
        if size not in source_sizes:
            raise RuntimeError(f"Unexpected exported texture dimensions: {size}")
    for record in material_records:
        if record["kind"] != "pocket-shell":
            continue
        material = next(m for m in gltf["materials"] if m["name"] == record["material"])
        factor = material.get("pbrMetallicRoughness", {}).get("baseColorFactor", [1.0] * 4)
        if any(abs(a - b) > 1e-6 for a, b in zip(factor, record["baseColorFactor"])):
            raise RuntimeError("Pocket body color differs between Blender and glTF")


if __name__ == "__main__":
    main()
