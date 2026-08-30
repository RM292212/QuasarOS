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

// Fetch scalar value at normalized coordinate [0, 1]^3
fn sampleScalar(coord: vec3<f32>) -> f32 {
  if (uniforms.isFloatScalar == 1u) {
    // Continuous hardware trilinear interpolation for float textures
    let sampleVal = textureSampleLevel(scalarTexture, linearSampler, coord, 0.0).r;
    return sampleVal;
  } else {
    // Point-sampled quantized uint texture with uniform scale/offset decoding
    let dims = vec3<f32>(textureDimensions(scalarTextureUint, 0));
    let texCoord = vec3<i32>(clamp(coord * dims, vec3<f32>(0.0), dims - vec3<f32>(1.0)));
    let rawUint = textureLoad(scalarTextureUint, texCoord, 0).r;
    let decoded = f32(rawUint) * uniforms.scalarScale + uniforms.scalarOffset;
    return decoded;
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
  let totalDist = tFar - tNear;

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

    // Check categorical empty-space skipping via validity mask
    if (uniforms.useValidityMask == 1u) {
      let maskVal = sampleValidityMask(currentPos);
      if (maskVal == 0u) {
        // Invalid sample / land / missing value -> skip TF lookup
        currentT += dt;
        stepCount += 1u;
        continue;
      }
    }

    // Sample scalar field
    let scalarValue = sampleScalar(currentPos);

    // Evaluate transfer function
    let sampleColor = sampleTransferFunction(scalarValue);

    // Step-size-corrected opacity: alpha_corr = 1.0 - (1.0 - alpha)^(dt / dt_ref)
    let sampleAlpha = clamp(sampleColor.a, 0.0, 1.0);
    let alphaCorr = 1.0 - pow(max(1.0 - sampleAlpha, 0.0), dt / dtRef);

    if (alphaCorr > 0.001) {
      // Front-to-back accumulation
      let weight = (1.0 - accumulatedColor.a) * alphaCorr;
      accumulatedColor = vec4<f32>(
        accumulatedColor.rgb + sampleColor.rgb * weight,
        accumulatedColor.a + weight
      );

      // Early Ray Termination
      if (accumulatedColor.a >= uniforms.earlyTerminationAlpha) {
        accumulatedColor.a = 1.0;
        break;
      }
    }

    currentT += dt;
    stepCount += 1u;
  }

  if (accumulatedColor.a <= 0.001) {
    discard;
  }

  return accumulatedColor;
}
`;
