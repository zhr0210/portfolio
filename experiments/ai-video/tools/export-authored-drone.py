"""Read the saved authoring file in background Blender; never overwrite it.

Export the drone hierarchy and its four authored rotor actions. Unwrapped
Euler samples accompany the GLB so continuous playback can retain terminal
speed without resetting a non-integral number of revolutions.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import tempfile
import importlib.util

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
spec = importlib.util.spec_from_file_location('devices', Path(__file__).with_name('export-capture-devices.py'))
devices = importlib.util.module_from_spec(spec)
spec.loader.exec_module(devices)

NAMES = ['右前桨叶自转', '右后桨叶自转', '左前桨叶自转', '左后桨叶自转']
START, END = 1, 252


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    if not bpy.app.background:
        raise RuntimeError('Use a separate background Blender process')
    source = Path(bpy.data.filepath)
    if args.output.resolve() == source.resolve():
        raise RuntimeError('Never overwrite the source')
    scene = bpy.context.scene
    fps = scene.render.fps / scene.render.fps_base
    root = bpy.data.objects['无人机']
    selected = {root, *root.children_recursive}
    selected = {o for o in selected if o.type in {'MESH', 'EMPTY'}}
    meshes = sorted((o for o in selected if o.type == 'MESH'), key=lambda o:o.name)
    controls = [bpy.data.objects[n] for n in NAMES]
    if any(o.constraints or (o.animation_data and o.animation_data.drivers) for o in selected):
        raise RuntimeError('Review constraints/drivers before exporting')
    if any(o.animation_data and o.animation_data.action for o in selected - set(controls)):
        raise RuntimeError('Unexpected animated drone part')
    timeline = []
    for o in controls:
        a = o.animation_data.action
        z = [c for l in a.layers for s in l.strips for b in s.channelbags
             for c in b.fcurves if c.data_path == 'rotation_euler' and c.array_index == 2]
        if len(z) != 1 or list(a.frame_range) != [START, END]:
            raise RuntimeError(f'Review rotor action {o.name}')
        values = [float(z[0].evaluate(f)) for f in range(START, END + 1)]
        o['portfolioRotor'] = {'axis': [0, 1, 0], 'fps': fps, 'samples': values}
        timeline.append({'controller':o.name, 'action':a.name,
                         'localBlenderAxis':'Z', 'localGltfAxis':'Y',
                         'revolutions':(values[-1]-values[0])/(2*math.pi)})
    # World-space source evidence uses Blender-to-glTF basis conversion.
    # Test representative actual vertices of EVERY mesh, not synthetic boxes.
    convert = Matrix.Rotation(-math.pi/2, 4, 'X')
    checks = []
    for frame in [1, 13, 47, 128, 219, 252]:
        scene.frame_set(frame)
        points = []
        for o in meshes:
            indices = sorted({0, len(o.data.vertices)//2, len(o.data.vertices)-1})
            points.append({'mesh':o.name, 'points':[
                {'local':list(convert @ o.data.vertices[i].co),
                 'world':list(convert @ (o.matrix_world @ o.data.vertices[i].co))}
                for i in indices]})
        checks.append({'seconds':(frame-START)/fps, 'frame':frame, 'meshes':points})
    scene.frame_start, scene.frame_end = START, END
    scene.frame_set(START)
    bpy.ops.object.select_all(action='DESELECT')
    for o in selected:
        o.select_set(True)
    bpy.context.view_layer.objects.active = root
    materials = sorted({m for o in meshes for m in o.data.materials if m}, key=lambda m:m.name)
    with tempfile.TemporaryDirectory(prefix='portfolio-authored-drone-') as temporary:
        textures = devices.prepare_textures(materials, temporary)
        devices.remove_unused_uv_layers(meshes)
        bpy.ops.export_scene.gltf(
            filepath=str(args.output.resolve()), export_format='GLB', use_selection=True,
            export_cameras=False, export_lights=False, export_animations=True,
            export_animation_mode='SCENE', export_frame_range=True,
            export_anim_slide_to_zero=True,
            export_frame_step=1, export_force_sampling=True,
            export_sampling_interpolation_fallback='LINEAR',
            export_optimize_animation_size=False,
            export_optimize_animation_keep_anim_object=False,
            export_bake_animation=False, export_current_frame=False,
            export_image_format='AUTO', export_unused_images=False,
            export_unused_textures=False, export_texcoords=True, export_normals=True,
            export_tangents=False, export_extras=True, export_vertex_color='NONE',
            export_hierarchy_flatten_objs=False, export_meshopt_compression_enable=False,
            export_draco_mesh_compression_enable=False,
        )
    devices.merge_glb_clips(args.output, 'AuthoredPropellers')
    gltf = devices.read_glb(args.output)
    devices.validate_texture_export(args.output, gltf, textures, [])
    for sampler in gltf['animations'][0]['samplers']:
        times = gltf['accessors'][sampler['input']]
        if abs(times['min'][0]) > 1e-6 or abs(times['max'][0] - (END-START)/fps) > 1e-6:
            raise RuntimeError('Authored GLB timeline must start at zero')
    if {gltf['nodes'][c['target']['node']]['name'] for c in gltf['animations'][0]['channels']} != set(NAMES):
        raise RuntimeError('Only four authored controls may animate')
    if len([n for n in gltf['nodes'] if 'mesh' in n]) != len(meshes):
        raise RuntimeError('Missing source mesh')
    metadata = {
        'sourceFile':source.name, 'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'assetSha256':hashlib.sha256(args.output.read_bytes()).hexdigest(),
        'bytes':args.output.stat().st_size, 'exporter':bpy.app.version_string,
        'frames':[START,END], 'fps':fps, 'controllers':timeline,
        'texturePolicy':{'nativeResolution':True, 'lossyCompression':False},
        'textures':textures, 'meshes':len(meshes),
        'runtime':'Original hierarchy and controller origins; unwrapped Euler samples play source acceleration then continue terminal angular velocity. No fitting or reparenting.',
        'sourcePoseChecks':checks,
    }
    # Dense numerical evidence stays compact; human-facing provenance stays readable.
    checks = metadata.pop('sourcePoseChecks')
    text = json.dumps(metadata,ensure_ascii=False,indent=2)
    text = text[:-2] + ',\n  "sourcePoseChecks": [\n    ' + ',\n    '.join(
        json.dumps(c,ensure_ascii=False,separators=(',', ':')) for c in checks
    ) + '\n  ]\n}\n'
    args.output.with_suffix('.metadata.json').write_text(text,encoding='utf8')
    print('AUTHORED_DRONE_EXPORT_SUCCESS', args.output.stat().st_size, flush=True)


if __name__ == '__main__':
    main()
