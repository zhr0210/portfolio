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
  uniform float uOpacity;
  uniform float uExposure;
  void main() {
    vec3 color = texture2D(uImage, uUV.xy + vUv * uUV.zw).rgb;
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
  float glyphField(vec2 pixel, float level) {
    vec2 cellSize = vec2(uFontSize * 0.62, uFontSize * 1.5) / exp2(level);
    vec2 cell = floor(pixel / cellSize), inside = fract(pixel / cellSize);
    float code = floor(texture2D(uCode, (mod(cell, vec2(128,64)) + 0.5) / vec2(128,64)).r * 255.0 + 0.5);
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
    vec2 baseCell = vec2(uFontSize * 0.62, uFontSize * 1.5);
    float rows = ceil(uFrameSize.y / baseCell.y);
    float row = floor(pixel.y / baseCell.y);
    // Scan left to right, one row at a time, starting at the upper-left corner.
    float readingOrder = (row + pixel.x / uFrameSize.x) / rows;
    float swept = smoothstep(readingOrder - 0.004, readingOrder + 0.004, uScan * 1.015)
      * smoothstep(0.0, 0.004, uScan);
    float binaryGrain = step(0.5, grain(floor(pixel / 1.7), uProgress * 96.0));
    float pixelMorph = smoothstep(0.45, 1.0, uSplit);
    vec3 codeColor = mix(vec3(0.77, 0.82, 0.82), vec3(binaryGrain), pixelMorph);
    float codeAlpha = mix(glyph, 1.0, pixelMorph);
    vec3 color = mix(vec3(1.0), codeColor, swept);
    float alpha = mix(uWhite, codeAlpha, swept);
    if (uProgress < uStageDenoise.x) {
      gl_FragColor = vec4(color, alpha);
      #include <colorspace_fragment>
      return;
    }

    float spatial = fbm(vUv * 6.0 + uSeed * 0.001);
    float q = clamp(uDenoise + (spatial - 0.5) * 0.19 * sin(uDenoise * 3.14159265), 0.0, 1.0);
    vec2 flow = vec2(noise(vUv * 12.0 + q * 3.0), noise(vUv.yx * 11.0 - q * 2.0)) - 0.5;
    vec2 imageUV = clamp(vUv + flow * 0.06 * pow(1.0 - q, 2.0), 0.0, 1.0);
    imageUV = uPosterUV.xy + imageUV * uPosterUV.zw;
    vec3 coarse = texture2D(uPoster, imageUV, (1.0 - q) * 6.5).rgb;
    vec3 sharp = texture2D(uPoster, uPosterUV.xy + vUv * uPosterUV.zw).rgb;
    vec3 structure = mix(coarse, sharp, smoothstep(0.35, 1.0, q));
    float multiscale = grain(floor(pixel / 1.7), uProgress * 96.0) - 0.5;
    multiscale += (fbm(vUv * 70.0 + q * 1.8) - 0.5) * 0.5;
    float signal = sin(q * 1.57079633);
    float residual = pow(1.0 - q, 1.35) * uNoiseStrength;
    vec3 reconstruction = clamp(structure * signal + vec3(0.5 * (1.0 - signal) + multiscale * 2.0 * residual), 0.0, 1.0);
    reconstruction = mix(vec3(binaryGrain), reconstruction, smoothstep(0.0, 0.13, q));
    float denoising = step(uStageDenoise.x, uProgress);
    color = mix(color, reconstruction, denoising);
    alpha = mix(alpha, 1.0, denoising);
    // At the endpoint all perturbation terms are zero and this is the exact cover UV.
    color = mix(color, sharp, step(uStageDenoise.y, uProgress));
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;
