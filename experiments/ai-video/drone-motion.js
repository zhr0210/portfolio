const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);

/** A single scroll-burst clock shapes the spring's command. Updating the goal
 * during a burst does not restart it; reversing rebases from the last command. */
export function createDroneDrive(config) {
  let command = 0,
    start = 0,
    goal = 0,
    elapsed = config.duration,
    lastInput = null;
  return {
    reset(value) {
      command = start = goal = finite(value);
      elapsed = config.duration;
      lastInput = null;
    },
    update(value, input, navigation = false) {
      goal = finite(value, command);
      if (navigation || !input?.sequence) {
        command = start = goal;
        elapsed = config.duration;
        lastInput = input ? { ...input } : null;
        return;
      }
      if (input.sequence !== lastInput?.sequence) {
        if (
          !lastInput ||
          input.direction !== lastInput.direction ||
          input.time - lastInput.time > config.burstGap ||
          elapsed >= config.duration
        ) {
          start = command;
          elapsed = 0;
        }
        lastInput = { ...input };
      }
    },
    step(dt) {
      if (dt > 0) {
        elapsed = Math.min(config.duration, elapsed + dt);
        command = start + (goal - start) * (elapsed / config.duration) ** config.exponent;
      }
      return { command, progress: elapsed / config.duration };
    },
  };
}

// Closed-form underdamped spring: a constant target gives the same result at
// 30, 60 or 120 Hz. Positions and velocities are in viewport-height units.
export function springStep(position, velocity, target, dt, frequency, damping) {
  const decay = damping * frequency;
  const oscillation = frequency * Math.sqrt(1 - damping * damping);
  const displacement = position - target;
  const c = Math.cos(oscillation * dt),
    s = Math.sin(oscillation * dt);
  const envelope = Math.exp(-decay * dt);
  return {
    position:
      target +
      envelope * (displacement * c + ((velocity + decay * displacement) * s) / oscillation),
    velocity:
      envelope *
      (velocity * c -
        ((decay * velocity + frequency * frequency * displacement) * s) / oscillation),
  };
}

export function createDroneMotion(config) {
  const spring = config.spring,
    hover = config.hover;
  const drive = createDroneDrive(config.drive);
  let position = null,
    velocity = 0,
    target = 0,
    base = 0,
    time = 0;
  let pitch = 0,
    roll = 0;
  const phase = (channel) => {
    const n = Math.sin((hover.seed + channel * 97.13) * 12.9898) * 43758.5453;
    return (n - Math.floor(n)) * Math.PI * 2;
  };
  // Smooth band-limited gusts; bounded sum avoids frame-random flicker.
  const wind = (channel) =>
    0.62 * Math.sin(time * (0.73 + channel * 0.07) + phase(channel)) +
    0.26 * Math.sin(time * (1.37 + channel * 0.11) + phase(channel + 7)) +
    0.12 * Math.sin(time * (2.11 + channel * 0.05) + phase(channel + 13));
  const motion = {
    reset(value) {
      position = target = base = finite(value);
      velocity = pitch = roll = 0;
      drive.reset(base);
    },
    setTarget(value, anchor, reduced = false, { input, navigation = false } = {}) {
      base = finite(anchor);
      if (position === null || reduced) motion.reset(base);
      target = clamp(finite(value, base), base - spring.maxOffset, base + spring.maxOffset);
      drive.update(target, input, navigation || reduced);
      const bounded = clamp(position, base - spring.maxOffset, base + spring.maxOffset);
      if (bounded !== position) {
        position = bounded;
        // Prevent pressure accumulating against the displacement limit.
        if ((position - base) * velocity > 0) velocity = 0;
      }
    },
    step(seconds, { mobile = false, reduced = false } = {}) {
      if (position === null) motion.reset(base);
      const dt = clamp(finite(seconds), 0, 0.05);
      if (reduced) {
        motion.reset(base);
        return { x: 0, y: base, pitch: 0, yaw: 0, roll: 0, velocity: 0, offset: 0 };
      }
      time += dt;
      const command = drive.step(dt);
      target = clamp(command.command, base - spring.maxOffset, base + spring.maxOffset);
      const next = springStep(position, velocity, target, dt, spring.frequency, spring.damping);
      position = clamp(next.position, base - spring.maxOffset, base + spring.maxOffset);
      velocity = position === next.position ? next.velocity : 0;
      const acceleration =
        spring.frequency ** 2 * (target - position) -
        2 * spring.damping * spring.frequency * velocity;
      const tilt = clamp(
        -velocity * spring.velocityTilt - acceleration * spring.accelerationTilt,
        -spring.maxTilt,
        spring.maxTilt,
      );
      const follow = 1 - Math.exp(-dt / 0.1);
      pitch += (tilt - pitch) * follow;
      roll += (tilt * 0.35 - roll) * follow;
      const strength = mobile ? 0.5 : 1;
      return {
        x: wind(0) * hover.horizontal * strength,
        y: position + wind(1) * hover.vertical * strength,
        pitch: pitch + wind(2) * hover.tilt * strength,
        yaw: wind(3) * hover.yaw * strength,
        roll: roll + wind(4) * hover.tilt * strength,
        velocity,
        acceleration,
        offset: position - base,
        time,
        command: target,
        driveProgress: command.progress,
      };
    },
  };
  return motion;
}
