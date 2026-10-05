"""Extend the saved Euler animation forward; never close it by a short-path return."""

import json
import math

import bpy
from mathutils import Euler, Quaternion

PROFILE = "device-inertia-216-v1"
SCENE_PROPERTY = "portfolio_device_inertia"
DEVICES = {
    "sony": ("动画控制器", "z轴移动", 0, 108),
    "pocket": ("模型三轴旋转", "z轴移动.001", 36, 144),
}


def action_curves(obj):
    data = obj.animation_data
    if not data or not data.action:
        raise RuntimeError(f"Missing authored action: {obj.name}")
    bags = [bag for layer in data.action.layers for strip in layer.strips for bag in strip.channelbags]
    if len(bags) != 1:
        raise RuntimeError(f"Review multi-slot animation before extending: {obj.name}")
    return list(bags[0].fcurves)


def copy_action(obj):
    original = obj.animation_data.action
    obj.animation_data.action = original.copy()
    obj.animation_data.action.name = original.name + "_Inertia216"


def forward_endpoint(initial, current, direction):
    turns = (current - initial) / math.tau
    winding = math.floor(turns) if direction < 0 else math.ceil(turns)
    result = initial + winding * math.tau
    if direction * (result - current) < 1e-6:
        result += direction * math.tau
    return result


def hermite(initial, final, velocity, span, u):
    delta = final - initial
    value = initial + delta * (3 * u * u - 2 * u ** 3) + velocity * span * u * (1 - u) ** 2
    slope = delta / span * (6 * u - 6 * u * u) + velocity * (1 - 4 * u + 3 * u * u)
    return value, slope


def extend_axis(curve, start, join, end):
    keys = sorted(curve.keyframe_points, key=lambda key: key.co.x)
    if len(keys) != 3 or [key.co.x for key in keys] != [start, (start + join) / 2, join]:
        raise RuntimeError("The extension expects the three reviewed authored Euler keys")
    original_keys = [[float(key.co.x), float(key.co.y)] for key in keys]
    initial, current = float(keys[0].co.y), float(keys[-1].co.y)
    secant = (current - keys[-2].co.y) / (join - keys[-2].co.x)
    if abs(secant) < 1e-8:
        raise RuntimeError("Review a stationary terminal axis before choosing its forward winding")
    direction = 1 if secant > 0 else -1
    final = forward_endpoint(initial, current, direction)
    span = end - join
    # Limit the incoming momentum so the cubic remains monotone and settles
    # without overshooting. Preserve poses; refine only the original end handle.
    velocity = direction * min(abs(secant), 2.5 * abs(final - current) / span)
    middle, middle_velocity = hermite(current, final, velocity, span, 0.5)
    middle_frame = (join + end) / 2
    last = keys[-1]
    incoming_span = join - keys[-2].co.x
    last.handle_left_type = last.handle_right_type = "FREE"
    last.handle_left = (join - incoming_span / 3, current - velocity * incoming_span / 3)
    last.handle_right = (join + span / 6, current + velocity * span / 6)
    curve.keyframe_points.insert(middle_frame, middle, options={"FAST"})
    curve.keyframe_points.insert(end, final, options={"FAST"})
    mid = next(key for key in curve.keyframe_points if abs(key.co.x - middle_frame) < 1e-4)
    tail = next(key for key in curve.keyframe_points if abs(key.co.x - end) < 1e-4)
    for key in [mid, tail]:
        key.interpolation = "BEZIER"
        key.handle_left_type = key.handle_right_type = "FREE"
    mid.handle_left = (middle_frame - span / 6, middle - middle_velocity * span / 6)
    mid.handle_right = (middle_frame + span / 6, middle + middle_velocity * span / 6)
    tail.handle_left = (end - span / 6, final)
    tail.handle_right = (end + span / 6, final)
    curve.update()
    values = [curve.evaluate(join + step / 8) for step in range(span * 8 + 1)]
    if any(direction * (right - left) < -2e-6 for left, right in zip(values, values[1:])):
        raise RuntimeError(f"An extended Euler axis rolled backwards: {curve.array_index}")
    if abs((curve.evaluate(end) - initial) / math.tau - round((final - initial) / math.tau)) > 2e-6:
        raise RuntimeError("The final Euler angle does not match its initial orientation")
    return {
        "axis": "XYZ"[curve.array_index],
        "originalKeysDegrees": [[frame, math.degrees(value)] for frame, value in original_keys],
        "direction": direction,
        "joinVelocityDegreesPerFrame": math.degrees(velocity),
        "finalDegrees": math.degrees(curve.evaluate(end)),
        "middleDegrees": math.degrees(curve.evaluate(middle_frame)),
        "windingTurns": round((final - initial) / math.tau),
    }


def extend_travel(obj, start):
    copy_action(obj)
    for curve in action_curves(obj):
        if curve.data_path != "location":
            raise RuntimeError("Review non-translation curves on the travel parent")
        # Freeze each handle before scaling time so Blender cannot recompute a
        # neighbouring automatic handle against a half-updated keyframe list.
        records = [(key, tuple(key.co), tuple(key.handle_left), tuple(key.handle_right))
                   for key in curve.keyframe_points]
        for key, co, left, right in records:
            key.handle_left_type = key.handle_right_type = "FREE"
            key.co = (start + (co[0] - start) * 2, co[1])
            key.handle_left = (start + (left[0] - start) * 2, left[1])
            key.handle_right = (start + (right[0] - start) * 2, right[1])
        curve.update()


def extend_device_animation(scene):
    existing = json.loads(scene.get(SCENE_PROPERTY, "null"))
    if existing:
        if existing.get("profile") != PROFILE:
            raise RuntimeError("Review an unknown previously extended animation profile")
        return existing
    report = {"profile": PROFILE, "devices": {}, "gimbalRange": [62, 138],
              "gimbalTreatment": "Original tracks preserved once; hold their resting pose afterwards",
              "endpoint": "Initial XYZ angles plus integral full turns, with zero terminal velocity",
              "travelTreatment": "Double parent translation duration, preserving distance and the Pocket delay"}
    basis = Quaternion((math.sqrt(0.5), -math.sqrt(0.5), 0, 0))
    for device, (control_name, travel_name, start, join) in DEVICES.items():
        control = bpy.data.objects[control_name]
        if control.rotation_mode != "XYZ":
            raise RuntimeError(f"Expected authored XYZ Euler control: {control_name}")
        copy_action(control)
        curves = sorted(action_curves(control), key=lambda curve: curve.array_index)
        if len(curves) != 3 or any(curve.data_path != "rotation_euler" for curve in curves):
            raise RuntimeError(f"Review unexpected controller curves: {control_name}")
        end = start + (join - start) * 2
        axes = [extend_axis(curve, start, join, end) for curve in curves]
        first = Euler([curve.evaluate(start) for curve in curves], "XYZ").to_quaternion()
        last = Euler([curve.evaluate(end) for curve in curves], "XYZ").to_quaternion()
        if abs(first.dot(last)) < 1 - 1e-6:
            raise RuntimeError(f"The extended device does not finish at its initial orientation: {device}")
        extend_travel(bpy.data.objects[travel_name], start)
        samples = []
        for frame in range(join, end + 1):
            angles = [curve.evaluate(frame) for curve in curves]
            quaternion = basis @ Euler(angles, "XYZ").to_quaternion() @ basis.inverted()
            samples.append({"frame": frame, "eulerDegrees": [math.degrees(a) for a in angles],
                            "gltfQuaternion": [quaternion.x, quaternion.y, quaternion.z, quaternion.w]})
        report["devices"][device] = {"control": control_name, "travel": travel_name,
                                    "startFrame": start, "originalEndFrame": join, "endFrame": end,
                                    "axes": axes, "extensionSamples": samples}
    scene.frame_start = 0
    scene.frame_end = 252
    scene.frame_set(0)
    scene[SCENE_PROPERTY] = json.dumps(report, ensure_ascii=False)
    return report
