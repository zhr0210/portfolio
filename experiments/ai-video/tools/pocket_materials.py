"""Repair Pocket 3 material bindings against the supplied three-view reference.

The imported atlas is useful, but several components had no image material,
incorrect UV selection or generic white metal. Keep every mesh and animation;
use named glTF-compatible PBR materials for the different physical surfaces.
"""

import json
from pathlib import Path

import bpy
import numpy as np


PROFILE = "pocket3-reference-v1"
ATLAS_NAME = "000002339E020538.dds"
NORMAL_NAME = "000002339D2BCDF8.dds"

# Hex colors are sRGB. The shader constants below are converted to linear.
SURFACES = {
    "body": {"name": "Pocket3_Body_Graphite", "color": "303536", "roughness": .82, "specular": .28, "atlas": "corrected", "normal": .45},
    "grip": {"name": "Pocket3_Grip_Textured", "color": "414649", "roughness": .91, "specular": .25, "atlas": "corrected", "normal": .7},
    "gimbal": {"name": "Pocket3_Gimbal_Satin", "color": "1F2325", "roughness": .57, "specular": .3, "normal": .25},
    "motor": {"name": "Pocket3_Motor_Cover", "color": "41474A", "roughness": .66, "specular": .3, "normal": .3},
    "bezel": {"name": "Pocket3_Lens_Bezel", "color": "303638", "roughness": .43, "specular": .35, "normal": .3},
    "lens": {"name": "Pocket3_Lens_Optics", "color": "FFFFFF", "roughness": .14, "specular": .4, "coat": .35, "atlas": "source", "normal": .15},
    "lens_interior": {"name": "Pocket3_Lens_Interior", "color": "141A18", "roughness": .38, "specular": .3},
    "lens_window": {"name": "Pocket3_Lens_Window", "color": "71897B", "roughness": .13, "specular": .4, "coat": .45, "alpha": .03},
    "screen_frame": {"name": "Pocket3_Screen_Frame", "color": "242B2D", "roughness": .48, "specular": .3, "normal": .25},
    "screen": {"name": "Pocket3_Screen_Glass", "color": "10191B", "roughness": .24, "specular": .35, "coat": .25},
    "rubber": {"name": "Pocket3_Control_Rubber", "color": "303638", "roughness": .88, "specular": .25},
    "shutter": {"name": "Pocket3_Shutter_Ring", "color": "FFFFFF", "roughness": .57, "specular": .3, "atlas": "source"},
    "led": {"name": "Pocket3_Status_Green", "color": "68A078", "roughness": .34, "specular": .3, "emission": .12},
    "connector": {"name": "Pocket3_Connector_Dark", "color": "252B2D", "roughness": .62, "specular": .3, "metallic": .25},
    "label": {"name": "Pocket3_Rear_Print", "color": "BBC0BD", "roughness": .8, "specular": .25},
}

# Restored camera-head atlas islands use .001. Existing textured components
# have identical UVMap through .004, so keep their original UVMap coordinates.
PARTS = {
    "Object_5": "gimbal", "Object_8": "gimbal", "Object_11": "gimbal",
    "Object_13": "bezel", "Object_15": "bezel", "Object_17": "lens",
    "Object_19": "lens_interior", "Object_21": "lens_window", "Object_23": "lens_window",
    "Object_25": "lens_interior", "Object_27": "lens_window", "Object_29": "lens_window",
    "Object_31": "lens_window", "Object_33": "lens_window", "Object_35": "gimbal", "Object_37": "bezel",
    "Object_39": "gimbal", "Object_41": "gimbal", "Object_43": "motor",
    "Object_45": "gimbal", "Object_47": "connector", "Object_49": "connector",
    "Object_59": "connector", "Object_61": "body", "Object_63": "grip",
    "Object_65": "gimbal", "Object_67": "led", "Object_69": "rubber",
    "Object_71": "shutter", "Object_73": "body", "Object_75": "grip",
    "Object_215": "rubber", "Object_217": "connector", "Object_221": "grip",
    "Object_223": "screen_frame", "Object_225": "screen",
}
RESTORED_UV = {"Object_13", "Object_15", "Object_17", "Object_19"}
ATLAS_BASE = "454B4D"


def rgb(hex_color):
    return np.array([int(hex_color[i:i+2], 16) / 255 for i in (0, 2, 4)])


def linear(values):
    values = np.asarray(values)
    return np.where(values <= .04045, values / 12.92, ((values + .055) / 1.055) ** 2.4)


def texture_node(material, image, uv):
    node = material.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = image
    material.node_tree.links.new(uv.outputs[0], node.inputs["Vector"])
    return node


def make_surface(role, uv_name, atlas, source_atlas, normal):
    spec = SURFACES[role]
    material = bpy.data.materials.new(spec["name"] + ("_AtlasUV" if uv_name == "UVMap.001" and role != "lens" else ""))
    material.use_nodes = True
    material.node_tree.nodes.clear()
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    output = nodes.new("ShaderNodeOutputMaterial")
    links.new(shader.outputs[0], output.inputs["Surface"])
    color = linear(rgb(spec["color"]))
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = spec["roughness"]
    shader.inputs["Metallic"].default_value = spec.get("metallic", 0)
    shader.inputs["Specular IOR Level"].default_value = spec["specular"]
    shader.inputs["Coat Weight"].default_value = spec.get("coat", 0)
    shader.inputs["Coat Roughness"].default_value = .16
    shader.inputs["Alpha"].default_value = spec.get("alpha", 1)
    if shader.inputs.get("Weight"):
        shader.inputs["Weight"].default_value = 1
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = spec.get("emission", 0)
    uv = nodes.new("ShaderNodeUVMap")
    uv.uv_map = uv_name
    if spec.get("atlas"):
        image = atlas if spec["atlas"] == "corrected" else source_atlas
        texture = texture_node(material, image, uv)
        if spec["atlas"] == "source":
            links.new(texture.outputs["Color"], shader.inputs["Base Color"])
        else:
            mix = nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            next(s for s in mix.inputs if s.type == "VALUE" and s.name == "Factor").default_value = 1
            a, b = [s for s in mix.inputs if s.type == "RGBA"]
            factor = color / linear(rgb(ATLAS_BASE))
            b.default_value = (*factor, 1)
            links.new(texture.outputs["Color"], a)
            links.new(next(s for s in mix.outputs if s.type == "RGBA"), shader.inputs["Base Color"])
    if spec.get("normal"):
        texture = texture_node(material, normal, uv)
        node = nodes.new("ShaderNodeNormalMap")
        node.uv_map = uv_name
        node.inputs["Strength"].default_value = spec["normal"]
        links.new(texture.outputs["Color"], node.inputs["Color"])
        links.new(node.outputs["Normal"], shader.inputs["Normal"])
    material.diffuse_color = (*color, spec.get("alpha", 1))
    material["portfolio_pocket_role"] = role
    material["portfolio_pocket_profile"] = PROFILE
    nodes.active = shader
    return material


def apply_pocket_reference(root, meshes, packed_png_copy, temporary_directory):
    if root.get("portfolio_pocket_profile") == PROFILE:
        return json.loads(root["portfolio_pocket_record"])
    directory = Path(temporary_directory)
    source_atlas = bpy.data.images.get(ATLAS_NAME)
    source_normal = bpy.data.images.get(NORMAL_NAME)
    if source_atlas is None or source_normal is None:
        raise RuntimeError("Pocket source color/normal atlas is missing")
    width, height = source_atlas.size
    pixels = np.empty(len(source_atlas.pixels), dtype=np.float32)
    source_atlas.pixels.foreach_get(pixels)
    colors = pixels.reshape((height, width, 4))
    original = colors[:, :, :3].copy()
    luminance = original @ np.array([.2126, .7152, .0722])
    variation = 1 + (np.clip(luminance, 0, .2) - .08) * .65
    colors[:, :, :3] = rgb(ATLAS_BASE) * variation[:, :, None]
    # Retain the source's actual OSMO and POCKET 3 print rather than white
    # incomplete islands elsewhere in the atlas. Blender's pixel rows are bottom-up.
    for x0, x1, y0, y1 in [(.38, .50, .88, .95), (.77, .86, .34, .44)]:
        ys, xs = slice(int(y0*height), int(y1*height)), slice(int(x0*width), int(x1*width))
        region = original[ys, xs]
        mask = region.max(axis=2) > .42
        colors[ys, xs, :3][mask] = region[mask]
    colors[:, :, 3] = 1
    atlas = packed_png_copy(source_atlas, "Pocket3_Reference_Color_2048", directory / "pocket-reference-color.png", pixels)
    normal = packed_png_copy(source_normal, "Pocket3_Reference_Normal_2048", directory / "pocket-reference-normal.png")
    normal.colorspace_settings.name = "Non-Color"
    materials, bindings, repaired_normals = {}, [], []
    for obj in sorted(meshes, key=lambda obj:obj.name):
        role = PARTS.get(obj.name)
        original_names = [m.get("portfolio_source_material", m.name) for m in obj.data.materials if m]
        if role is None:
            if original_names and len(obj.data.vertices) < 40 and all(name in {"mat_0.002_0.005", "mat_0.006", "mat_0.007", "mat_0.008"} for name in original_names):
                role = "rubber"  # Geometric knurl pieces around the joystick.
            else:
                raise RuntimeError(f"Review unclassified Pocket component: {obj.name}")
        uv_name = "UVMap.001" if obj.name in RESTORED_UV else "UVMap"
        spec = SURFACES[role]
        if (spec.get("normal") or spec.get("atlas")) and uv_name not in obj.data.uv_layers:
            raise RuntimeError(f"Required Pocket UV {uv_name} is missing on {obj.name}")
        key = (role, uv_name)
        if key not in materials:
            materials[key] = make_surface(role, uv_name, atlas, source_atlas, normal)
        # Preserve shared and unselected source data; only this device gets the
        # new material assignments. Vertex coordinates/UVs are copied unchanged.
        obj.data = obj.data.copy()
        # The imported CORNER/INT16_2D custom_normal attribute is corrupt:
        # even neutral PBR renders black with it. Remove it on the copy so
        # Blender and glTF derive normals from the unchanged faces/smoothing.
        custom_normal = obj.data.attributes.get("custom_normal")
        if custom_normal is not None:
            obj.data.attributes.remove(custom_normal)
            obj.data.update()
            repaired_normals.append(obj.name)
        obj.data.materials.clear()
        obj.data.materials.append(materials[key])
        for polygon in obj.data.polygons:
            polygon.material_index = 0
        binding = {"object":obj.name, "sourceMaterials":original_names,
                   "role":role, "material":materials[key].name,
                   "uvMap":uv_name if spec.get("normal") or spec.get("atlas") else None}
        if obj.name == "Object_221":
            # The four raised DJI print caps already have separate UV islands
            # outside the rear panel (.467-.608). Color the existing faces;
            # do not add decals/geometry or paint the diagonal grip grooves.
            uv_data = obj.data.uv_layers["UVMap"].data
            label_faces = [p for p in obj.data.polygons
                           if all(0 <= uv_data[i].uv.x < .14 and 0 <= uv_data[i].uv.y < .06
                                  for i in p.loop_indices)]
            if len(label_faces) != 191:
                raise RuntimeError("Review changed rear DJI print UV islands")
            label_key = ("label", "UVMap")
            if label_key not in materials:
                materials[label_key] = make_surface("label", "UVMap", atlas, source_atlas, normal)
            obj.data.materials.append(materials[label_key])
            for polygon in label_faces:
                polygon.material_index = 1
            binding["secondaryMaterials"] = [{"role":"label", "material":materials[label_key].name,
                                              "faces":len(label_faces)}]
        bindings.append(binding)
    record = {"kind":"pocket-reference", "profile":PROFILE, "reference":"bin-render-04.webp",
              "sourceColorAtlas":ATLAS_NAME, "sourceNormalAtlas":NORMAL_NAME,
              "nativeSize":[width,height], "repairedMeshes":len(bindings),
              "removedInvalidCustomNormals":repaired_normals,
              "restoredLensUv":sorted(RESTORED_UV), "bindings":bindings,
              "surfaces":{role:spec for role,spec in SURFACES.items()},
              "treatment":"Per-component graphite plastic, rubber grip, satin gimbal, black display, restored lens photo, orange shutter ring and green LED. Correct non-color normal atlas. Keep all geometry and original motion."}
    root["portfolio_pocket_profile"] = PROFILE
    root["portfolio_pocket_record"] = json.dumps(record)
    return record
