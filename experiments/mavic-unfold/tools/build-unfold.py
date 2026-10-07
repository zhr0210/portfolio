"""Build a separate, packed Blender project and baked GLB from the supplied ZIP.

Run with Blender --background --disable-autoexec --python this_file -- --source ZIP.
The source archive and any open Blender session remain untouched.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import zipfile

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[3]
ASSETS = ROOT / 'experiments/mavic-unfold/assets'
OUTPUT = ROOT / 'output/drone-reference'
FPS = 30
END = 300


def smooth(t, start, end):
    u = max(0.0, min(1.0, (t - start) / (end - start)))
    return u * u * u * (10 + u * (-15 + 6 * u))


def attach(obj, parent):
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def empty(name, point, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = Vector(point) * .01
    obj.empty_display_type = 'ARROWS'
    obj.empty_display_size = .018
    obj.rotation_mode = 'QUATERNION'
    bpy.context.view_layer.update()
    if parent:
        attach(obj, parent)
    return obj


def center(obj):
    return sum((obj.matrix_world @ Vector(v) for v in obj.bound_box), Vector()) / 8


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    OUTPUT.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    source = zipfile.ZipFile(args.source).read('source/DJI-Mavic_3.glb')
    size = struct.unpack_from('<I', source, 12)[0]
    document = json.loads(source[20:20 + size])
    binary = source[28 + size:]
    # Calibrate the supplied pale material to the reference's graphite housing.
    # The texture pixels, dimensions, roughness, metalness and normals are retained.
    document['materials'][0]['pbrMetallicRoughness']['baseColorFactor'] = [.28, .28, .28, 1]
    # Stable part identifiers avoid the archive's corrupted non-ASCII node names.
    for i, node in enumerate(document['nodes']):
        node['name'] = f'Part_{node["mesh"]:03}' if 'mesh' in node else f'Node_{i:03}'
    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    named = OUTPUT / 'named.glb'
    named.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary))
                     + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
                     + struct.pack('<II', len(binary), 0x004E4942) + binary)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(named))
    parts = {int(o.name.split('_')[1]): o for o in bpy.data.objects if o.type == 'MESH'}
    original_vertices = sum(len(o.data.vertices) for o in parts.values())
    original_triangles = sum(len(p.vertices) - 2 for o in parts.values() for p in o.data.polygons)
    scale = Matrix.Diagonal((.01, .01, .01, 1))
    for obj in parts.values():
        transform = scale @ obj.matrix_world
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
        obj.data.transform(transform)
    for obj in list(bpy.data.objects):
        if obj.type != 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
    root = empty('Mavic_Unfold_Root', (0, 0, 0))
    for obj in parts.values():
        attach(obj, root)

    # Hinge centres measured from the supplied model in its fully open pose.
    arms = {
        'Front_L': dict(point=(-4.54, 5.71, 2.44), axis=(-.07, .16, 1), angle=115,
                        ids=list(range(61, 72)) + list(range(28, 38)) + [107], start=6.05, end=7.55),
        'Front_R': dict(point=(4.54, 5.71, 2.44), axis=(.07, .16, 1), angle=-115,
                        ids=list(range(74, 86)) + list(range(48, 58)) + [88], start=6.10, end=7.60),
        'Rear_L': dict(point=(-3.77, -6.14, .55), axis=(.90, -.435, 0), angle=169,
                       ids=list(range(128, 137)) + list(range(38, 48)), start=5.05, end=6.55),
        'Rear_R': dict(point=(3.77, -6.14, .55), axis=(.90, .435, 0), angle=-169,
                       ids=list(range(138, 147)) + list(range(18, 28)), start=5.10, end=6.60),
    }
    assigned = set()
    for name, info in arms.items():
        pivot = empty('Hinge_' + name, info['point'], root)
        info['object'] = pivot
        info['axis'] = Vector(info['axis']).normalized()
        for part in info['ids']:
            assert part not in assigned, f'Double assigned part {part}'
            assigned.add(part)
            attach(parts[part], pivot)

    # Two source meshes contain disconnected fasteners from all four arms.
    # Separate their islands without remeshing, changing UVs, or removing faces.
    fasteners = []
    for part in (58, 59):
        bpy.ops.object.select_all(action='DESELECT')
        obj = parts[part]
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.separate(type='LOOSE')
        bpy.ops.object.mode_set(mode='OBJECT')
        for island in bpy.context.selected_objects:
            fasteners.append(island)
            p = center(island)
            side = 'L' if p.x < 0 else 'R'
            position = 'Front' if p.y > 0 else 'Rear'
            # Fasteners inside the central hinge casing stay with the fuselage.
            if abs(p.x) > .065:
                attach(island, arms[position + '_' + side]['object'])
    # glTF duplicates vertices at UV/normal seams. Join the separated fastener
    # surfaces per rigid parent to avoid hundreds of tiny browser draw calls.
    fastener_groups = [(parent, [o for o in fasteners if o.parent == parent])
                       for parent in [root] + [a['object'] for a in arms.values()]]
    for parent, group in fastener_groups:
        if not group:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in group:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.join()
        group[0].name = 'Fasteners_' + parent.name

    blades = []
    blade_pairs = {
        'Front_L': [(35, 33), (36, 32)],
        'Front_R': [(52, 50), (54, 51)],
        'Rear_L': [(46, 42), (47, 43)],
        'Rear_R': [(26, 23), (27, 22)],
    }
    for arm_name, pair in blade_pairs.items():
        arm = arms[arm_name]
        fold = Quaternion(arm['axis'], math.radians(arm['angle']))
        desired = Vector((0, 1 if arm_name.startswith('Front') else -1, 0))
        local_target = fold.inverted() @ desired
        target_angle = math.atan2(local_target.y, local_target.x)
        for blade_id, pin_id in pair:
            pin = center(parts[pin_id])
            direction = center(parts[blade_id]) - pin
            open_angle = math.atan2(direction.y, direction.x)
            angle = (target_angle - open_angle + math.pi) % (2 * math.pi) - math.pi
            pivot = empty(f'Blade_{arm_name}_{blade_id}', pin * 100, arm['object'])
            attach(parts[blade_id], pivot)
            blades.append((pivot, angle))

    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 0, END
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
    scene.render.resolution_percentage = 100
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.world = bpy.data.worlds.new('Black_Studio')
    scene.world.use_nodes = True
    next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND').inputs[0].default_value = (0, 0, 0, 1)
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = -.3

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = 'Reference_Camera'
    camera.data.lens = 50
    camera.data.sensor_width = 36
    camera.data.clip_start, camera.data.clip_end = .01, 100
    camera.rotation_mode = 'QUATERNION'
    scene.camera = camera
    target = Vector((0, .01, .012))
    for frame in range(END + 1):
        t = frame / FPS
        for arm in arms.values():
            angle = math.radians(arm['angle']) * (1 - smooth(t, arm['start'], arm['end']))
            arm['object'].rotation_quaternion = Quaternion(arm['axis'], angle)
            arm['object'].keyframe_insert('rotation_quaternion', frame=frame)
        for i, (pivot, angle) in enumerate(blades):
            pivot.rotation_quaternion = Quaternion((0, 0, 1), angle * (1 - smooth(t, 7.3 + i * .025, 8.4 + i * .025)))
            pivot.keyframe_insert('rotation_quaternion', frame=frame)
        u = smooth(t, 4.8, 8.9)
        root.rotation_quaternion = Quaternion((0, 0, 1), math.radians(-9 + 9 * u))
        root.keyframe_insert('rotation_quaternion', frame=frame)
        camera.location = Vector((-.16, .5, .23)).lerp(Vector((-.20, .80, .45)), u)
        camera.rotation_quaternion = (target - camera.location).to_track_quat('-Z', 'Y')
        camera.keyframe_insert('location', frame=frame)
        camera.keyframe_insert('rotation_quaternion', frame=frame)

    lights = []
    for name, position, power, size, color in [
        ('Key_Softbox', (.25, .35, .65), 5.5, .6, (1, .98, .96)),
        ('Fill_Softbox', (-.45, .15, .28), 1.5, .55, (.86, .91, 1)),
        ('Rim_Strip', (.15, -.45, .4), 6.5, .4, (.88, .93, 1)),
    ]:
        bpy.ops.object.light_add(type='AREA', location=position)
        light = bpy.context.object
        light.name = name
        light.data.energy, light.data.size, light.data.color = power, size, color
        light.rotation_euler = (target - light.location).to_track_quat('-Z', 'Y').to_euler()
        lights.append(dict(name=name, position=position, power=power, size=size, color=color))
    for name, t in [('Folded', 0), ('Rear arms', 5.05), ('Front arms', 6.05), ('Propellers', 7.3), ('Open', 8.7)]:
        scene.timeline_markers.new(name, frame=round(t * FPS))
    # Use exactly the sampled rotations in Blender and the web GLB.
    for action in bpy.data.actions:
        for layer in action.layers:
            for strip in layer.strips:
                for slot in action.slots:
                    bag = strip.channelbag(slot, ensure=False)
                    if bag:
                        for curve in bag.fcurves:
                            for key in curve.keyframe_points:
                                key.interpolation = 'LINEAR'
    scene.frame_set(0)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
                area.spaces.active.shading.type = 'MATERIAL'
    scene['Reference'] = 'https://www.youtube.com/watch?v=r5kukRMmZNI — 3:45–3:55; mechanical shot ≈3:50–3:54'
    scene['Model'] = 'User supplied DJI Mavic 3, not Mavic 3 Pro; original geometry and full-size textures retained.'
    scene['Timing'] = '0–4.8 s hold folded instead of live-action footage; 5.05–8.6 s unfold; final pose held.'
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / 'Mavic-3-Unfold.blend'))
    bpy.ops.export_scene.gltf(filepath=str(ASSETS / 'mavic-3-unfold.glb'), export_format='GLB',
        export_cameras=True, export_lights=False, export_animations=True, export_animation_mode='SCENE',
        export_nla_strips_merged_animation_name='Mavic3_Unfold_10s', export_frame_range=True,
        export_force_sampling=True, export_frame_step=1, export_optimize_animation_size=False,
        export_sampling_interpolation_fallback='LINEAR', export_current_frame=False,
        export_image_format='AUTO', export_texcoords=True, export_normals=True,
        export_extras=False, export_vertex_color='NONE')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    assert sum(len(o.data.vertices) for o in meshes) == original_vertices
    assert sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons) == original_triangles
    metadata = dict(sourceZip='dji-mavic-3.zip', sourceSHA256=hashlib.sha256(source).hexdigest(),
        model='DJI Mavic 3', reference='https://www.youtube.com/watch?v=r5kukRMmZNI&t=225s',
        duration=10, fps=FPS, frames=[0, END], sourceMeshes=147, riggedMeshes=len(meshes),
        vertices=original_vertices, triangles=original_triangles, lights=lights,
        housingColorFactor=[.28, .28, .28, 1],
        stages=dict(rear=[5.05, 6.6], front=[6.05, 7.6], blades=[7.3, 8.6]),
        limitations=['Mavic 3 supplied model has a different camera to the reference Mavic 3 Pro.',
          'Live-action footage before the mechanical shot is represented by a folded-pose hold.',
          'Hinge axes fitted from static geometry and visual reference; not manufacturer CAD.'])
    (ASSETS / 'mavic-3-unfold.metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    # Small checkpoint renders are local review artifacts, never website assets.
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.render.resolution_percentage = 50
    for frame in (0, 180, 210, 240, 300):
        scene.frame_set(frame)
        scene.render.filepath = str(OUTPUT / f'frame-{frame:03}.png')
        bpy.ops.render.render(write_still=True)
    print('UNFOLD_COMPLETE', json.dumps(metadata))


if __name__ == '__main__':
    main()
