/**
 * QuasarOS WebGL2 Single-Ray Volume Picking Fragment & Vertex Shaders (GLSL ES 3.00)
 *
 * Implements GPU-accelerated raymarching pick pass for a single viewport ray (uRayOrigin, uRayDir).
 * Raymarches the resident 3D volume texture to detect the first opaque voxel hit (scalar > opacity threshold),
 * writing out to a 1x1 RGBA32F (or float/half-float) offscreen framebuffer:
 *   gl_FragColor / fragColor = vec4(hitU, hitV, hitW, scalarValue)
 *
 * If ray misses or hits only masked/nodata/land voxels, writes vec4(0.0, 0.0, 0.0, 0.0) with mask code 0.
 */

export const VOLUME_PICKING_VERT_GLSL = /* glsl */ `#version 300 es
precision highp float;

out vec2 vUv;

// Fullscreen Triangle Vertex Shader
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

export const VOLUME_PICKING_FRAG_GLSL = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler3D;
precision highp usampler3D;

in vec2 vUv;
out vec4 fragColor;

// Uniform block for picking pass matching WebGL2 std140 layout
layout(std140) uniform VolumePickingUniforms {
    vec3 uRayOrigin;
    float uStepSize;

    vec3 uRayDir;
    uint uMaxSteps;

    vec3 uClipMin;
    float uOpacityThreshold;

    vec3 uClipMax;
    float uScalarScale;

    float uScalarOffset;
    uint uHasValidityMask;
    uint uIsFloatScalar;
    uint uLodLevel;
};

// Texture bindings
uniform sampler3D uVolumeTextureFloat; // r16f or r32f
uniform usampler3D uVolumeTextureUint; // r16ui quantized
uniform usampler3D uMaskTexture;       // r8ui validity mask

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
        return texture(uVolumeTextureFloat, coord).r * uScalarScale + uScalarOffset;
    } else {
        vec3 dims = vec3(textureSize(uVolumeTextureUint, 0));
        return sampleTrilinearUint(uVolumeTextureUint, coord, dims, uScalarScale, uScalarOffset);
    }
}

// Sample validity mask (1u = valid ocean data, 0u = land/nodata/halo)
uint sampleValidityMask(vec3 coord) {
    vec3 dims = vec3(textureSize(uMaskTexture, 0));
    ivec3 texCoord = ivec3(clamp(coord * dims, vec3(0.0), dims - vec3(1.0)));
    return texelFetch(uMaskTexture, texCoord, 0).r;
}

void main() {
    fragColor = vec4(0.0, 0.0, 0.0, 0.0);

    vec3 origin = uRayOrigin;
    vec3 dir = normalize(uRayDir);

    vec3 boxMin = max(vec3(0.0), uClipMin);
    vec3 boxMax = min(vec3(1.0), uClipMax);

    RayIntersection intersect = intersectAABB(origin, dir, boxMin, boxMax);
    if (!intersect.hit) {
        return;
    }

    float tStart = max(0.0, intersect.tNear);
    float tEnd = intersect.tFar;
    if (tStart >= tEnd || tEnd < 0.0) {
        return;
    }

    float currentT = tStart;
    float dt = uStepSize;
    uint maxSteps = uMaxSteps;

    for (uint i = 0u; i < maxSteps; i++) {
        if (currentT > tEnd) {
            break;
        }

        vec3 pos = origin + currentT * dir;

        if (all(greaterThanEqual(pos, boxMin)) && all(lessThanEqual(pos, boxMax))) {
            // Check mask if present
            if (uHasValidityMask == 1u) {
                uint maskVal = sampleValidityMask(pos);
                if (maskVal == 0u) {
                    currentT += dt;
                    continue;
                }
            }

            float physicalVal = sampleScalar(pos);

            // Raw normalized value check against opacity threshold
            float rawSample = (physicalVal - uScalarOffset) / max(uScalarScale, 1e-6);
            if (rawSample > uOpacityThreshold || physicalVal > uOpacityThreshold) {
                // First valid hit encountered: output [u, v, w, scalar]
                fragColor = vec4(pos.x, pos.y, pos.z, physicalVal);
                return;
            }
        }

        currentT += dt;
    }
}
`;

