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
    float level = uSplit * uLevels;
    float glyph = mix(glyphField(pixel, floor(level)), glyphField(pixel, floor(level) + 1.0),
      smoothstep(0.0, 1.0, fract(level)));
    vec2 cells = baseCells();
    vec2 cell = min(floor(pixel * cells / uFrameSize), cells - 1.0);
    // Replace complete character cells left-to-right, then move to the next row.
    float readingOrder = cell.y * cells.x + cell.x;
    float swept = clamp(uScan * (cells.x * cells.y + 1.0) - readingOrder, 0.0, 1.0);
    float binaryGrain = step(0.5, grain(floor(pixel / 1.15), uProgress * 96.0));
    // Let the small child glyphs stay legible before the final pixel-sized subdivision.
    float pixelMorph = smoothstep(0.78, 1.0, uSplit);
    vec3 codeColor = mix(vec3(0.77, 0.82, 0.82), vec3(binaryGrain), pixelMorph);
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
    float steps = max(2.0, uDenoiseSteps) - 1.0;
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
