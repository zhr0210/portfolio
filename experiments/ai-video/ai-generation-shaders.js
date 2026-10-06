export const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const referenceShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uImage;
  uniform vec4 uUV;
  uniform vec2 uParallax;
  uniform float uOpacity;
  uniform float uExposure;
  void main() {
    vec3 color = texture2D(uImage, uUV.xy + (vUv + uParallax) * uUV.zw).rgb;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luma), color, 0.82) * uExposure;
    gl_FragColor = vec4(color, uOpacity);
  }
`;

export const compositeShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uAccumulation;
  void main() {
    vec4 accumulated = texture2D(uAccumulation, vUv);
    gl_FragColor = vec4(accumulated.rgb / max(accumulated.a, 0.00001), accumulated.a);
    #include <colorspace_fragment>
  }
`;

export const generationShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uPoster;
  uniform sampler2D uGlyphs;
  uniform sampler2D uCode;
  uniform vec2 uCodeSize;
  uniform sampler2D uSequenceAtlas;
  uniform sampler2D uSequenceFlow;
  uniform float uHasSequence;
  uniform float uHasSequenceFlow;
  uniform float uSequenceBaked;
  uniform vec2 uSequenceGrid;
  uniform vec2 uSequenceTileSize;
  uniform vec4 uSequenceCrop;
  uniform float uSequenceFrameCount;
  uniform float uSequencePosterFrame;
  uniform float uSequenceSteps[64];
  uniform float uSequenceFlowRange;
  uniform float uSequenceFlowStrength;
  uniform float uSequenceRegionLag;
  uniform float uHasSolver;
  uniform sampler2D uSolverAtlas;
  uniform sampler2D uSolverSource;
  uniform vec2 uSolverGrid;
  uniform vec2 uSolverTileSize;
  uniform float uSolverSteps;
  uniform vec4 uPosterUV;
  uniform vec2 uFrameSize;
  uniform float uProgress;
  uniform float uWhite;
  uniform float uScan;
  uniform float uSplit;
  uniform float uDenoise;
  uniform float uFontSize;
  uniform float uLevels;
  uniform float uNoiseStrength;
  uniform float uDenoiseSteps;
  uniform float uDenoiseBlur;
  uniform float uDenoiseWarp;
  uniform float uSeed;
  uniform vec2 uStageDenoise;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031 + uSeed * 0.000013);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    return noise(p) * 0.57 + noise(p * 2.03 + 7.0) * 0.28 + noise(p * 4.09 + 13.0) * 0.15;
  }
  // A progress-derived clock: same progress always chooses the same two samples.
  float grain(vec2 cell, float clock) {
    float tick = floor(clock), f = fract(clock);
    return mix(hash(cell + tick * vec2(19.17, 47.23)),
      hash(cell + (tick + 1.0) * vec2(19.17, 47.23)), smoothstep(0.0, 1.0, f));
  }
  vec2 baseCells() {
    return max(floor(uFrameSize / vec2(uFontSize * 0.62, uFontSize * 1.5)), vec2(1.0));
  }
  float glyphField(vec2 pixel, float level) {
    vec2 cellSize = uFrameSize / baseCells() / exp2(level);
    vec2 cell = floor(pixel / cellSize), inside = fract(pixel / cellSize);
    float code = floor(texture2D(uCode, (mod(cell, uCodeSize) + 0.5) / uCodeSize).r * 255.0 + 0.5);
    float tick = floor(uProgress * 160.0);
    float jitter = hash(cell + tick * 3.19);
    if (level > 0.0 || (jitter > 0.83 && code > 0.0))
      code = 1.0 + floor(hash(cell + tick * 7.13 + level * 29.0) * 94.0);
    vec2 atlas = vec2(mod(code,16.0), floor(code / 16.0));
    vec2 uv = vec2((atlas.x + inside.x) / 16.0, 1.0 - (atlas.y + inside.y) / 6.0);
    return texture2D(uGlyphs, uv, -8.0).a;
  }
  vec2 sequenceAtlasUV(float index, vec2 imageUV) {
    vec2 slot = vec2(mod(index, uSequenceGrid.x),
      uSequenceGrid.y - 1.0 - floor(index / uSequenceGrid.x));
    vec2 edge = 0.5 / uSequenceTileSize;
    return (slot + clamp(imageUV, edge, 1.0 - edge)) / uSequenceGrid;
  }
  vec3 sequenceImage(float index, vec2 imageUV) {
    vec3 result = vec3(0.0);
    if (abs(index - uSequencePosterFrame) < 0.5) {
      vec2 displayUV = (imageUV - uSequenceCrop.xy) / uSequenceCrop.zw;
      result = texture2D(uPoster, uPosterUV.xy + clamp(displayUV, 0.0, 1.0) * uPosterUV.zw).rgb;
    } else {
      result = texture2D(uSequenceAtlas, sequenceAtlasUV(index, imageUV)).rgb;
    }
    return result;
  }
  vec3 reconstructSequence(vec2 pixel, float raw, float binaryGrain) {
    if (uSequenceBaked > 0.5) {
      // Every integer step is a baked image. Do not add residual grain, local
      // timing offsets, or another warp on top of the authored trajectory.
      float iteration = raw * (uSequenceFrameCount - 1.0);
      float index = floor(iteration);
      vec2 imageUV = uSequenceCrop.xy + vUv * uSequenceCrop.zw;
      vec3 previous = texture2D(uSequenceAtlas, sequenceAtlasUV(index, imageUV)).rgb;
      vec3 next = texture2D(uSequenceAtlas, sequenceAtlasUV(
        min(index + 1.0, uSequenceFrameCount - 1.0), imageUV)).rgb;
      vec3 prediction = previous + smoothstep(0.0, 1.0, fract(iteration)) * (next - previous);
      // Restore only the cover's fine-detail residual toward the end, keeping
      // full-resolution completion aligned with the exported low-res endpoint.
      vec3 sharp = texture2D(uPoster, uPosterUV.xy + vUv * uPosterUV.zw).rgb;
      vec3 low = texture2D(uSequenceAtlas, sequenceAtlasUV(uSequencePosterFrame, imageUV)).rgb;
      prediction += (sharp - low) * smoothstep(0.72, 1.0, raw);
      return clamp(prediction, 0.0, 1.0);
    }
    float maxStep = max(1.0, uDenoiseSteps);
    float iteration = raw * maxStep;
    float preview = (floor(iteration) + smoothstep(0.0, 1.0, fract(iteration))) / maxStep;
    float spatial = fbm(vUv * 5.0 + uSeed * 0.001) - 0.5;
    float local = clamp(preview + spatial * uSequenceRegionLag / maxStep * sin(preview * 3.14159265), 0.0, 1.0);
    int from = 0;
    for (int i = 0; i < 63; i++) {
      if (float(i + 1) >= uSequenceFrameCount) break;
      if (local > uSequenceSteps[i + 1]) from = i + 1;
    }
    from = min(from, int(uSequenceFrameCount) - 2);
    int to = from + 1;
    float blend = smoothstep(uSequenceSteps[from], uSequenceSteps[to], local);
    vec2 imageUV = uSequenceCrop.xy + vUv * uSequenceCrop.zw;
    vec4 motion = vec4(0.0);
    if (uHasSequenceFlow > 0.5) {
      vec4 encoded = texture2D(uSequenceFlow, sequenceAtlasUV(float(from), imageUV));
      motion = (encoded - 128.0 / 255.0) / (96.0 / 255.0)
        * uSequenceFlowRange * uSequenceFlowStrength;
    }
    // Bidirectional correspondences bring each provisional form toward the next one.
    vec3 previous = sequenceImage(float(from), imageUV + motion.zw * blend);
    vec3 next = sequenceImage(float(to), imageUV + motion.xy * (1.0 - blend));
    vec3 prediction = mix(previous, next, blend);
    // Each simulated iteration recomputes a fixed-seed residual; no frame-history feedback.
    float residual = (grain(floor(pixel / 1.15), iteration) - 0.5)
      * 0.18 * uNoiseStrength * pow(1.0 - preview, 2.3);
    prediction = clamp(prediction + vec3(residual), 0.0, 1.0);
    return mix(vec3(binaryGrain), prediction, smoothstep(0.0, 3.0, iteration));
  }
  vec3 iterationField(float step, vec2 imageUV) {
    vec2 slot = vec2(mod(step, uSolverGrid.x), uSolverGrid.y - 1.0 - floor(step / uSolverGrid.x));
    vec2 edge = 0.5 / uSolverTileSize;
    // Half-texel bounds keep neighboring cached iterations out of the sample.
    vec2 uv = (slot + clamp(imageUV, edge, 1.0 - edge)) / uSolverGrid;
    return texture2D(uSolverAtlas, uv).rgb;
  }
  vec3 reconstructIterations(float raw, float binaryGrain) {
    float iteration = raw * uSolverSteps;
    float step = floor(iteration), fraction = smoothstep(0.0, 1.0, fract(iteration));
    vec2 imageUV = uPosterUV.xy + vUv * uPosterUV.zw;
    vec3 previous = iterationField(step, imageUV);
    vec3 correction = iterationField(min(step + 1.0, uSolverSteps), imageUV) - previous;
    // Integrate a fraction of the *computed next correction*, not authored pictures.
    vec3 prediction = previous + fraction * correction;
    // The solver works at a bounded resolution; the original cover provides only
    // the late high-frequency residual. At step 50 the sum equals the original.
    vec3 sharp = texture2D(uPoster, imageUV).rgb;
    vec3 low = texture2D(uSolverSource, imageUV).rgb;
    prediction += (sharp - low) * smoothstep(0.6, 1.0, raw);
    prediction = clamp(prediction, 0.0, 1.0);
    return mix(vec3(binaryGrain), prediction, smoothstep(0.0, 1.5, iteration));
  }
  void main() {
    vec2 pixel = vec2(vUv.x, 1.0 - vUv.y) * uFrameSize;
    // Uniform branches skip expensive noise and image sampling in the earlier stages.
    if (uScan == 0.0 && uSplit == 0.0 && uDenoise == 0.0) {
      gl_FragColor = vec4(vec3(1.0), uWhite);
      #include <colorspace_fragment>
      return;
    }
    if (uProgress >= uStageDenoise.y) {
      gl_FragColor = vec4(texture2D(uPoster, uPosterUV.xy + vUv * uPosterUV.zw).rgb, 1.0);
      #include <colorspace_fragment>
      return;
    }
    float binaryGrain = step(0.5, grain(floor(pixel / 1.15), uProgress * 96.0));
    if (uHasSolver > 0.5 && uProgress >= uStageDenoise.x) {
      float raw = clamp((uProgress - uStageDenoise.x) / (uStageDenoise.y - uStageDenoise.x), 0.0, 1.0);
      gl_FragColor = vec4(reconstructIterations(raw, binaryGrain), 1.0);
      #include <colorspace_fragment>
      return;
    }
    if (uHasSequence > 0.5 && uProgress >= uStageDenoise.x) {
      float raw = clamp((uProgress - uStageDenoise.x) / (uStageDenoise.y - uStageDenoise.x), 0.0, 1.0);
      gl_FragColor = vec4(reconstructSequence(pixel, raw, binaryGrain), 1.0);
      #include <colorspace_fragment>
      return;
    }
    float level = uSplit * uLevels;
    float glyph = mix(glyphField(pixel, floor(level)), glyphField(pixel, floor(level) + 1.0),
      smoothstep(0.0, 1.0, fract(level)));
    vec2 cells = baseCells();
    vec2 cell = min(floor(pixel * cells / uFrameSize), cells - 1.0);
    // Replace complete character cells left-to-right, then move to the next row.
    float readingOrder = cell.y * cells.x + cell.x;
    float swept = clamp(uScan * (cells.x * cells.y + 1.0) - readingOrder, 0.0, 1.0);
    // Let the small child glyphs stay legible before the final pixel-sized subdivision.
    float pixelMorph = smoothstep(0.78, 1.0, uSplit);
    vec3 noiseColor = vec3(binaryGrain);
    if (uHasSequence > 0.5 && uSequenceBaked > 0.5 && uSplit > 0.0) {
      // End the character subdivision in the authored initial noise image,
      // so the sequence starts directly at frame zero without a noise overlay.
      vec2 imageUV = uSequenceCrop.xy + vUv * uSequenceCrop.zw;
      noiseColor = texture2D(uSequenceAtlas, sequenceAtlasUV(0.0, imageUV)).rgb;
    }
    vec3 codeColor = mix(vec3(0.77, 0.82, 0.82), noiseColor, pixelMorph);
    float codeAlpha = mix(glyph, 1.0, pixelMorph);
    vec3 color = mix(vec3(1.0), codeColor, swept);
    float alpha = mix(uWhite, codeAlpha, swept);
    if (uProgress < uStageDenoise.x) {
      gl_FragColor = vec4(color, alpha);
      #include <colorspace_fragment>
      return;
    }

    // Simulate FLUX per-step preview pacing: composition forms early, details converge later.
    // This samples the configured cover; it is not an inference model or a clock-driven GIF.
    float raw = clamp((uProgress - uStageDenoise.x) / (uStageDenoise.y - uStageDenoise.x), 0.0, 1.0);
    float steps = max(1.0, uDenoiseSteps);
    float frame = raw * steps;
    float preview = (floor(frame) + smoothstep(0.0, 1.0, fract(frame))) / steps;
    float spatial = fbm(vUv * 5.0 + uSeed * 0.001);
    float q = clamp(preview + (spatial - 0.5) * 0.15 * sin(preview * 3.14159265), 0.0, 1.0);
    vec2 flow = vec2(fbm(vUv * 9.0 + preview * 2.0), fbm(vUv.yx * 8.0 - preview * 2.0)) - 0.5;
    vec2 imageUV = clamp(vUv + flow * uDenoiseWarp * pow(1.0 - q, 2.6), 0.0, 1.0);
    imageUV = uPosterUV.xy + imageUV * uPosterUV.zw;
    vec3 coarse = texture2D(uPoster, imageUV, pow(1.0 - q, 1.7) * uDenoiseBlur).rgb;
    vec3 sharp = texture2D(uPoster, uPosterUV.xy + vUv * uPosterUV.zw).rgb;
    vec3 structure = mix(coarse, sharp, smoothstep(0.42, 0.98, q));
    vec2 grainCell = floor(pixel / 1.15);
    float clock = uProgress * 96.0;
    float fine = grain(grainCell, clock) - 0.5;
    float clustered = fbm(vUv * 65.0 + preview * 2.0) - 0.5;
    vec3 chroma = vec3(grain(grainCell + 13.0, clock), grain(grainCell + 37.0, clock), grain(grainCell + 71.0, clock)) - 0.5;
    vec3 residual = (vec3(fine * 1.25 + clustered * 0.4) + chroma * 0.16)
      * pow(1.0 - q, 3.4) * uNoiseStrength;
    float signal = smoothstep(0.01, 0.28, q);
    vec3 reconstruction = clamp(mix(vec3(0.48), structure, signal) + residual, 0.0, 1.0);
    reconstruction = mix(vec3(binaryGrain), reconstruction, smoothstep(0.0, 0.08, q));
    // Residual, displacement and blur all reach zero at the exact cover UV.
    gl_FragColor = vec4(reconstruction, 1.0);
    #include <colorspace_fragment>
  }
`;
