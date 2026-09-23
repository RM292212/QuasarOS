/**
 * QuasarOS WebGL2 GLSL ES 3.00 Scientific Volume Raymarching Shaders
 *
 * Implements:
 * 1. Full-screen quad / proxy geometry vertex stage (#version 300 es).
 * 2. Smits-Kay ray-AABB intersection with normalized [0, 1]^3 ocean domain.
 * 3. Analytical 6-plane clipping box evaluation in normalized coordinates.
 * 4. Categorical empty space skipping using usampler3D validity mask (0u = invalid/nodata/halo).
 * 5. Continuous 50-level Copernicus depth LUT sampling with piece-wise linear interpolation.
 * 6. Dual scalar sampling: r16f (sampled as float) or r16ui (quantized with affine scale/offset de-quantization).
 * 7. Manual trilinear filtering fallback for scalar textures when hardware filtering is unavailable.
 * 8. 256x1 Transfer Function lookup (sampler2D).
 * 9. Front-to-back compositing with Beer-Lambert step-size-corrected opacity:
 *    alpha_corr = 1.0 - pow(1.0 - alpha_sample, dt / dt_ref)
 * 10. Early Ray Termination (accumulated alpha >= earlyTerminationAlpha, default 0.95/0.99).
 */

export const VOLUME_RAYMARCH_VERT_GLSL = /* glsl */ `#version 300 es
precision highp float;

out vec2 vUv;

// Fullscreen Triangle Vertex Shader (generates [-1, 1] NDC without vertex buffers)
void main() {
    uint vertexIndex = uint(gl_VertexID);
    vec2 uv = vec2(
        float((vertexIndex << 1u) & 2u),
        float(vertexIndex & 2u)
    );
    vUv = uv;
    gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const VOLUME_RAYMARCH_FRAG_GLSL = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler3D;
precision highp usampler3D;
precision highp sampler2D;

in vec2 vUv;
out vec4 fragColor;

// Uniform block matching WebGL2 standard 16-byte alignment (std140: 160 bytes header + 64 * 16 bytes = 1,184 bytes total)
layout(std140) uniform VolumeRaymarchUniforms {
    mat4 uInverseViewProjection;
    vec3 uCameraPosition;
    float uStepSize;

    vec3 uClipMin;
    float uReferenceStepSize;

    vec3 uClipMax;
    float uEarlyTerminationAlpha;

    // Scalar Domain & Quantization Decoding: value = rawUint * scalarScale + scalarOffset
    float uScalarOffset;
    float uScalarScale;
    float uScalarMin;
    float uScalarMax;

    // Depth LUT & Feature Flags
    uint uDepthLevelCount;
    uint uIsFloatScalar;    // 1u if r16f/r32f, 0u if quantized r16ui
    uint uUseValidityMask;  // 1u to skip samples where mask == 0u
    uint uMaxSteps;

    // Viewport dimensions [width, height, 1/width, 1/height]
    vec4 uViewport;

    // Depth LUT Array (up to 64 levels, matching 50 Copernicus ocean levels)
    // vec4-aligned in std140 layout
    vec4 uDepthLutEntries[64];
};

// Texture bindings
uniform sampler3D uScalarTextureFloat; // r16f or r32f
uniform usampler3D uScalarTextureUint; // r16ui quantized
uniform usampler3D uMaskTexture;       // r8ui validity mask
uniform sampler2D uTransferFunction;   // 256x1 rgba8 transfer function colormap

struct RayIntersection {
    bool hit;
    float tNear;
    float tFar;
};

// Smits-Kay slab algorithm for AABB intersection in [0, 1]^3
RayIntersection intersectAABB(vec3 rayOrigin, vec3 rayDir, vec3 boxMin, vec3 boxMax) {
    RayIntersection result;
    result.hit = false;
    result.tNear = 0.0;
    result.tFar = 0.0;

    vec3 invDir = 1.0 / rayDir;
    vec3 t0 = (boxMin - rayOrigin) * invDir;
    vec3 t1 = (boxMax - rayOrigin) * invDir;

    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);

    float tNear = max(max(tmin.x, tmin.y), tmin.z);
    float tFar = min(min(tmax.x, tmax.y), tmax.z);

    if (tNear <= tFar && tFar > 0.0) {
        result.hit = true;
        result.tNear = max(0.0, tNear);
        result.tFar = tFar;
    }
    return result;
}

// Convert normalized vertical coordinate w in [0, 1] to physical depth using piecewise linear interpolation
float evaluateNormalizedDepthToPhysical(float normW) {
    if (uDepthLevelCount < 2u) {
        return normW;
    }
    float maxIdx = float(uDepthLevelCount - 1u);
    float continuousIndex = clamp(normW * maxIdx, 0.0, maxIdx);
    int lowerIdx = int(floor(continuousIndex));
    int upperIdx = min(int(uDepthLevelCount) - 1, lowerIdx + 1);
    float frac = continuousIndex - float(lowerIdx);

    float zLower = uDepthLutEntries[lowerIdx].x;
    float zUpper = uDepthLutEntries[upperIdx].x;
    return mix(zLower, zUpper, frac);
}

// Software 8-tap trilinear interpolation for quantized uint scalar textures
float sampleTrilinearUint(usampler3D tex, vec3 coord, vec3 texSize, float scale, float offset) {
    vec3 pos = coord * texSize - 0.5;
    vec3 i0 = floor(pos);
    vec3 f = fract(pos);
    ivec3 c000 = ivec3(i0);

    float v000 = float(texelFetch(tex, c000 + ivec3(0,0,0), 0).r) * scale + offset;
    float v100 = float(texelFetch(tex, c000 + ivec3(1,0,0), 0).r) * scale + offset;
    float v010 = float(texelFetch(tex, c000 + ivec3(0,1,0), 0).r) * scale + offset;
    float v110 = float(texelFetch(tex, c000 + ivec3(1,1,0), 0).r) * scale + offset;
    float v001 = float(texelFetch(tex, c000 + ivec3(0,0,1), 0).r) * scale + offset;
    float v101 = float(texelFetch(tex, c000 + ivec3(1,0,1), 0).r) * scale + offset;
    float v011 = float(texelFetch(tex, c000 + ivec3(0,1,1), 0).r) * scale + offset;
    float v111 = float(texelFetch(tex, c000 + ivec3(1,1,1), 0).r) * scale + offset;

    float v00 = mix(v000, v100, f.x);
    float v10 = mix(v010, v110, f.x);
    float v01 = mix(v001, v101, f.x);
    float v11 = mix(v011, v111, f.x);

    float v0 = mix(v00, v10, f.y);
    float v1 = mix(v01, v11, f.y);

    return mix(v0, v1, f.z);
}

// Fetch scalar value at normalized coordinate [0, 1]^3
float sampleScalar(vec3 coord) {
    if (uIsFloatScalar == 1u) {
        // Hardware filtered or manual sampler
        return texture(uScalarTextureFloat, coord).r;
    } else {
        // De-quantize uint texture with trilinear interpolation
        vec3 dims = vec3(textureSize(uScalarTextureUint, 0));
        return sampleTrilinearUint(uScalarTextureUint, coord, dims, uScalarScale, uScalarOffset);
    }
}

// Sample validity mask (1u = valid ocean data, 0u = land/nodata/halo)
uint sampleValidityMask(vec3 coord) {
    vec3 dims = vec3(textureSize(uMaskTexture, 0));
    ivec3 texCoord = ivec3(clamp(coord * dims, vec3(0.0), dims - vec3(1.0)));
    return texelFetch(uMaskTexture, texCoord, 0).r;
}

// Evaluate Transfer function LUT sampling (1D clamped normalized scalar mapped to 256x1 RGBA)
vec4 sampleTransferFunction(float scalarValue) {
    if (scalarValue < uScalarMin || scalarValue > uScalarMax) {
        return vec4(0.0);
    }
    float range = uScalarMax - uScalarMin;
    float normalizedScalar = clamp((scalarValue - uScalarMin) / max(range, 1e-6), 0.0, 1.0);
    vec2 uv = vec2(normalizedScalar, 0.5);
    return texture(uTransferFunction, uv);
}

void main() {
    // 1. Reconstruct world-space ray from fragment coordinates
    vec4 ndc = vec4(
        (gl_FragCoord.x * uViewport.z) * 2.0 - 1.0,
        (gl_FragCoord.y * uViewport.w) * 2.0 - 1.0,
        1.0,
        1.0
    );

    vec4 worldFar = uInverseViewProjection * ndc;
    vec3 rayDir = normalize((worldFar.xyz / worldFar.w) - uCameraPosition);
    vec3 rayOrigin = uCameraPosition;

    // 2. Intersect with normalized [0, 1]^3 ocean volume bounding box
    vec3 boxMin = max(vec3(0.0), uClipMin);
    vec3 boxMax = min(vec3(1.0), uClipMax);

    RayIntersection intersect = intersectAABB(rayOrigin, rayDir, boxMin, boxMax);
    if (!intersect.hit) {
        discard;
    }

    // 3. Setup Raymarching parameters
    float dt = uStepSize;
    float dtRef = max(uReferenceStepSize, 1e-6);
    float tNear = intersect.tNear;
    float tFar = intersect.tFar;

    vec4 accumulatedColor = vec4(0.0);
    float currentT = tNear;
    uint stepCount = 0u;

    // 4. Ray-march through volume with front-to-back compositing
    while (currentT <= tFar && stepCount < uMaxSteps) {
        vec3 currentPos = rayOrigin + rayDir * currentT;

        // Check analytical bounding box clipping
        if (any(lessThan(currentPos, boxMin)) || any(greaterThan(currentPos, boxMax))) {
            currentT += dt;
            stepCount += 1u;
            continue;
        }

        // Check categorical empty-space skipping via validity mask (0u = land / nodata)
        if (uUseValidityMask == 1u) {
            uint maskVal = sampleValidityMask(currentPos);
            if (maskVal == 0u) {
                // Adaptive Empty-Space Leaping (1.5x step expansion)
                currentT += dt * 1.5;
                stepCount += 1u;
                continue;
            }
        }

        // Sample scalar field
        float scalarValue = sampleScalar(currentPos);

        // Sentinel check: if missing/fill value (e.g. <= -900.0)
        if (scalarValue <= -900.0) {
            // Adaptive Empty-Space Leaping (1.5x step expansion)
            currentT += dt * 1.5;
            stepCount += 1u;
            continue;
        }

        // Evaluate transfer function
        vec4 sampleColor = sampleTransferFunction(scalarValue);

        // Beer-Lambert step-size opacity correction: A_i = 1 - (1 - A_sample)^(dt / dt_ref)
        float sampleAlpha = clamp(sampleColor.a, 0.0, 1.0);
        float alphaCorr = 1.0 - pow(max(1.0 - sampleAlpha, 0.0), dt / dtRef);

        // If alpha is negligible (|dA| < epsilon), leap with 1.5x step
        if (alphaCorr <= 0.001) {
            currentT += dt * 1.5;
            stepCount += 1u;
            continue;
        }

        // Discrete front-to-back alpha compositing:
        // C_dst = C_dst + (1 - A_dst) * C_src * A_src
        // A_dst = A_dst + (1 - A_dst) * A_src
        float weight = (1.0 - accumulatedColor.a) * alphaCorr;
        accumulatedColor = vec4(
            accumulatedColor.rgb + sampleColor.rgb * weight,
            accumulatedColor.a + weight
        );

        // Early Ray Termination (accumulated opacity >= threshold, e.g. 0.98)
        if (accumulatedColor.a >= uEarlyTerminationAlpha) {
            accumulatedColor.a = 1.0;
            break;
        }

        currentT += dt;
        stepCount += 1u;
    }

    if (accumulatedColor.a <= 0.001) {
        discard;
    }

    // Un-premultiply RGB so that gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA) blends correctly with clearColor
    vec3 straightColor = clamp(accumulatedColor.rgb / max(accumulatedColor.a, 1e-5), 0.0, 1.0);
    fragColor = vec4(straightColor, accumulatedColor.a);
}
`;
