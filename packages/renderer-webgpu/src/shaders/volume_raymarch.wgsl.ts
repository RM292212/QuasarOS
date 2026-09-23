/**
 * QuasarOS WebGPU WGSL Volume Raymarching Shader
 *
 * Implements:
 * 1. Full-screen quad / proxy geometry vertex stage.
 * 2. Smits-Kay ray-AABB intersection with normalized [0, 1]^3 ocean domain.
 * 3. Analytical 6-plane clipping box evaluation in normalized coordinates.
 * 4. Categorical empty space skipping using r8uint validity mask (0u = invalid/nodata).
 * 5. Non-uniform depth LUT sampling across Copernicus 31 ocean depth levels (0.494m to 453.938m).
 * 6. Dual scalar sampling: r16float (half-float) or r16uint (quantized with uniform scale/offset).
 * 7. 256x1 Colormap Transfer Function lookup (rgba8unorm).
 * 8. Front-to-back compositing with step-size-corrected opacity:
 *    alpha_corr = 1.0 - pow(1.0 - alpha_sample, dt / dt_ref)
 * 9. Early Ray Termination (accumulated alpha >= 0.99).
 */

export const VOLUME_RAYMARCH_WGSL = /* wgsl */ `
struct VolumeRaymarchUniforms {
  // Transformation matrices
  inverseViewProjection: mat4x4<f32>,
  cameraPosition: vec3<f32>,
  stepSize: f32,

  // Clipping Box in normalized volume coordinates [0, 1]^3
  clipMin: vec3<f32>,
  referenceStepSize: f32,

  clipMax: vec3<f32>,
  earlyTerminationAlpha: f32,

  // Scalar Domain & Quantization Decoding
  // value = rawUint * scalarScale + scalarOffset
  scalarOffset: f32,
  scalarScale: f32,
  scalarMin: f32,
  scalarMax: f32,

  // Depth LUT parameters
  depthLevelCount: u32,
  isFloatScalar: u32, // 1u if r16float/r32float, 0u if quantized r16uint
  useValidityMask: u32, // 1u to skip samples where mask == 0u
  maxSteps: u32,

  // Viewport dimensions [width, height, 1/width, 1/height]
  viewport: vec4<f32>,
};

struct DepthLutBuffer {
  levels: array<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: VolumeRaymarchUniforms;
@group(0) @binding(1) var scalarTexture: texture_3d<f32>; // Handles r16float or sampled f32
@group(0) @binding(2) var scalarTextureUint: texture_3d<u32>; // Handles r16uint quantized
@group(0) @binding(3) var maskTexture: texture_3d<u32>; // r8uint validity mask
@group(0) @binding(4) var<storage, read> depthLut: DepthLutBuffer;
@group(0) @binding(5) var transferFunctionTexture: texture_2d<f32>; // 256x1 rgba8unorm
@group(0) @binding(6) var linearSampler: sampler;
@group(0) @binding(7) var pointSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Fullscreen Triangle Vertex Shader (generates [-1, 1] NDC without vertex buffer)
@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  // Vertex positions for a fullscreen triangle: (-1, -1), (3, -1), (-1, 3)
  let uv = vec2<f32>(
    f32((vertexIndex << 1u) & 2u),
    f32(vertexIndex & 2u)
  );
  output.uv = uv;
  output.position = vec4<f32>(uv * 2.0 - 1.0, 0.0, 1.0);
  return output;
}

struct RayIntersection {
  hit: bool,
  tNear: f32,
  tFar: f32,
};

// Smits-Kay slab algorithm for AABB intersection
fn intersectAABB(rayOrigin: vec3<f32>, rayDir: vec3<f32>, boxMin: vec3<f32>, boxMax: vec3<f32>) -> RayIntersection {
  var result: RayIntersection;
  result.hit = false;

  let invDir = 1.0 / rayDir;
  let t0 = (boxMin - rayOrigin) * invDir;
  let t1 = (boxMax - rayOrigin) * invDir;

  let tmin = min(t0, t1);
  let tmax = max(t0, t1);

  let tNear = max(max(tmin.x, tmin.y), tmin.z);
  let tFar = min(min(tmax.x, tmax.y), tmax.z);

  if (tNear <= tFar && tFar > 0.0) {
    result.hit = true;
    result.tNear = max(0.0, tNear);
    result.tFar = tFar;
  }
  return result;
}

// Convert normalized vertical coordinate w in [0, 1] to continuous depth index via Depth LUT
fn evaluateNormalizedDepthToPhysical(w: vec3<f32>) -> f32 {
  let levelCount = uniforms.depthLevelCount;
  if (levelCount < 2u) {
    return w.z;
  }
  let maxIdx = f32(levelCount - 1u);
  let continuousIndex = clamp(w.z * maxIdx, 0.0, maxIdx);
  let lowerIdx = u32(floor(continuousIndex));
  let upperIdx = min(levelCount - 1u, lowerIdx + 1u);
  let frac = continuousIndex - f32(lowerIdx);

  let zLower = depthLut.levels[lowerIdx];
  let zUpper = depthLut.levels[upperIdx];
  return mix(zLower, zUpper, frac);
}

// Software 8-tap trilinear interpolation for quantized uint scalar textures
fn sampleTrilinearUint(coord: vec3<f32>) -> f32 {
  let dims = vec3<f32>(textureDimensions(scalarTextureUint, 0));
  let pos = coord * dims - vec3<f32>(0.5);
  let i0 = floor(pos);
  let f = fract(pos);
  let c000 = vec3<i32>(clamp(i0, vec3<f32>(0.0), dims - vec3<f32>(1.0)));
  let cMax = vec3<i32>(dims - vec3<f32>(1.0));

  let c100 = clamp(c000 + vec3<i32>(1, 0, 0), vec3<i32>(0), cMax);
  let c010 = clamp(c000 + vec3<i32>(0, 1, 0), vec3<i32>(0), cMax);
  let c110 = clamp(c000 + vec3<i32>(1, 1, 0), vec3<i32>(0), cMax);
  let c001 = clamp(c000 + vec3<i32>(0, 0, 1), vec3<i32>(0), cMax);
  let c101 = clamp(c000 + vec3<i32>(1, 0, 1), vec3<i32>(0), cMax);
  let c011 = clamp(c000 + vec3<i32>(0, 1, 1), vec3<i32>(0), cMax);
  let c111 = clamp(c000 + vec3<i32>(1, 1, 1), vec3<i32>(0), cMax);

  let v000 = f32(textureLoad(scalarTextureUint, c000, 0).r) * uniforms.scalarScale + uniforms.scalarOffset;
  let v100 = f32(textureLoad(scalarTextureUint, c100, 0).r) * uniforms.scalarScale + uniforms.scalarOffset;
  let v010 = f32(textureLoad(scalarTextureUint, c010, 0).r) * uniforms.scalarScale + uniforms.scalarOffset;
  let v110 = f32(textureLoad(scalarTextureUint, c110, 0).r) * uniforms.scalarScale + uniforms.scalarOffset;
  let v001 = f32(textureLoad(scalarTextureUint, c001, 0).r) * uniforms.scalarScale + uniforms.scalarOffset;
  let v101 = f32(textureLoad(scalarTextureUint, c101, 0).r) * uniforms.scalarScale + uniforms.scalarOffset;
  let v011 = f32(textureLoad(scalarTextureUint, c011, 0).r) * uniforms.scalarScale + uniforms.scalarOffset;
  let v111 = f32(textureLoad(scalarTextureUint, c111, 0).r) * uniforms.scalarScale + uniforms.scalarOffset;

  let v00 = mix(v000, v100, f.x);
  let v10 = mix(v010, v110, f.x);
  let v01 = mix(v001, v101, f.x);
  let v11 = mix(v011, v111, f.x);

  let v0 = mix(v00, v10, f.y);
  let v1 = mix(v01, v11, f.y);

  return mix(v0, v1, f.z);
}

// Fetch scalar value at normalized coordinate [0, 1]^3
fn sampleScalar(coord: vec3<f32>) -> f32 {
  if (uniforms.isFloatScalar == 1u) {
    // Continuous hardware trilinear interpolation for float textures
    return textureSampleLevel(scalarTexture, linearSampler, coord, 0.0).r;
  } else {
    // Software 8-tap trilinear interpolation with scale/offset decoding
    return sampleTrilinearUint(coord);
  }
}

// Sample validity mask (1u = valid ocean data, 0u = land/nodata/halo)
fn sampleValidityMask(coord: vec3<f32>) -> u32 {
  let dims = vec3<f32>(textureDimensions(maskTexture, 0));
  let texCoord = vec3<i32>(clamp(coord * dims, vec3<f32>(0.0), dims - vec3<f32>(1.0)));
  return textureLoad(maskTexture, texCoord, 0).r;
}

// Evaluate Transfer Function LUT (256x1 RGBA)
fn sampleTransferFunction(scalarValue: f32) -> vec4<f32> {
  if (scalarValue < uniforms.scalarMin || scalarValue > uniforms.scalarMax) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  let range = uniforms.scalarMax - uniforms.scalarMin;
  let normalizedScalar = clamp((scalarValue - uniforms.scalarMin) / max(range, 1e-6), 0.0, 1.0);
  let uv = vec2<f32>(normalizedScalar, 0.5);
  return textureSampleLevel(transferFunctionTexture, linearSampler, uv, 0.0);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // 1. Reconstruct world-space ray from fragment coordinates
  let ndc = vec4<f32>(
    (input.position.x * uniforms.viewport.z) * 2.0 - 1.0,
    (1.0 - (input.position.y * uniforms.viewport.w)) * 2.0 - 1.0,
    1.0,
    1.0
  );

  let worldFar = uniforms.inverseViewProjection * ndc;
  let rayDir = normalize((worldFar.xyz / worldFar.w) - uniforms.cameraPosition);
  let rayOrigin = uniforms.cameraPosition;

  // 2. Intersect with normalized [0, 1]^3 ocean volume bounding box
  let boxMin = max(vec3<f32>(0.0), uniforms.clipMin);
  let boxMax = min(vec3<f32>(1.0), uniforms.clipMax);

  let intersect = intersectAABB(rayOrigin, rayDir, boxMin, boxMax);
  if (!intersect.hit) {
    discard;
  }

  // 3. Setup Raymarching parameters
  let dt = uniforms.stepSize;
  let dtRef = max(uniforms.referenceStepSize, 1e-6);
  let tNear = intersect.tNear;
  let tFar = intersect.tFar;

  var accumulatedColor = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  var currentT = tNear;
  var stepCount = 0u;

  // 4. Ray-march through volume with front-to-back compositing
  while (currentT <= tFar && stepCount < uniforms.maxSteps) {
    let currentPos = rayOrigin + rayDir * currentT;

    // Check analytical bounding box clipping
    if (any(currentPos < boxMin) || any(currentPos > boxMax)) {
      currentT += dt;
      stepCount += 1u;
      continue;
    }

    // Check categorical empty-space skipping via validity mask (0u = land / nodata)
    if (uniforms.useValidityMask == 1u) {
      let maskVal = sampleValidityMask(currentPos);
      if (maskVal == 0u) {
        // Adaptive Empty-Space Leaping (1.5x step expansion)
        currentT += dt * 1.5;
        stepCount += 1u;
        continue;
      }
    }

    // Sample scalar field
    let scalarValue = sampleScalar(currentPos);

    // Sentinel check: if missing/fill value (e.g. <= -900.0)
    if (scalarValue <= -900.0) {
      // Adaptive Empty-Space Leaping (1.5x step expansion)
      currentT += dt * 1.5;
      stepCount += 1u;
      continue;
    }

    // Evaluate transfer function
    let sampleColor = sampleTransferFunction(scalarValue);

    // Beer-Lambert step-size opacity correction: A_i = 1 - (1 - A_sample)^(dt / dt_ref)
    let sampleAlpha = clamp(sampleColor.a, 0.0, 1.0);
    let alphaCorr = 1.0 - pow(max(1.0 - sampleAlpha, 0.0), dt / dtRef);

    // If alpha is negligible (|dA| < epsilon), leap with 1.5x step
    if (alphaCorr <= 0.001) {
      currentT += dt * 1.5;
      stepCount += 1u;
      continue;
    }

    // Discrete front-to-back alpha compositing:
    // C_dst = C_dst + (1 - A_dst) * C_src * A_src
    // A_dst = A_dst + (1 - A_dst) * A_src
    let weight = (1.0 - accumulatedColor.a) * alphaCorr;
    accumulatedColor = vec4<f32>(
      accumulatedColor.rgb + sampleColor.rgb * weight,
      accumulatedColor.a + weight
    );

    // Early Ray Termination (accumulated opacity >= earlyTerminationAlpha, threshold >= 0.98)
    if (accumulatedColor.a >= uniforms.earlyTerminationAlpha) {
      accumulatedColor.a = 1.0;
      break;
    }

    currentT += dt;
    stepCount += 1u;
  }

  if (accumulatedColor.a <= 0.001) {
    discard;
  }

  // Un-premultiply RGB so that pipeline srcFactor 'src-alpha' blends correctly with target
  let straightColor = clamp(accumulatedColor.rgb / max(accumulatedColor.a, 1e-5), vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(straightColor, accumulatedColor.a);
}
`;
