/**
 * QuasarOS WebGPU Single-Ray Volume Picking Compute Shader (WGSL)
 *
 * Implements GPU-accelerated raymarching pick pass for a single viewport ray (x, y).
 * Raymarches the resident 3D volume texture to detect the first opaque voxel hit (alpha > threshold),
 * writing out:
 * - Hit normalized coordinate [u, v, w] in [0, 1]^3
 * - Sampled scalar value (f32 unquantized physical value)
 * - Mask code and hit flag (0 = miss, 1 = valid hit, 2 = masked/invalid)
 *
 * Storage buffer layout (32 bytes):
 *   hit_u: f32 (4 bytes)
 *   hit_v: f32 (4 bytes)
 *   hit_w: f32 (4 bytes)
 *   scalar_value: f32 (4 bytes)
 *   mask_code: u32 (4 bytes)
 *   hit_flag: u32 (4 bytes)
 *   padding_0: u32 (4 bytes)
 *   padding_1: u32 (4 bytes)
 */

export const VOLUME_PICKING_WGSL = /* wgsl */ `
struct PickUniforms {
  ray_origin: vec3<f32>,
  step_size: f32,
  ray_dir: vec3<f32>,
  max_steps: u32,
  clip_min: vec3<f32>,
  opacity_threshold: f32,
  clip_max: vec3<f32>,
  scalar_scale: f32,
  scalar_offset: f32,
  has_validity_mask: u32,
  lod_level: u32,
  padding: f32,
};

struct PickOutput {
  hit_u: f32,
  hit_v: f32,
  hit_w: f32,
  scalar_value: f32,
  mask_code: u32,
  hit_flag: u32,
  padding_0: u32,
  padding_1: u32,
};

@group(0) @binding(0) var<uniform> uniforms: PickUniforms;
@group(0) @binding(1) var volume_texture: texture_3d<f32>;
@group(0) @binding(2) var volume_sampler: sampler;
@group(0) @binding(3) var<storage, read_write> pick_output: PickOutput;

fn intersect_aabb(origin: vec3<f32>, dir: vec3<f32>, box_min: vec3<f32>, box_max: vec3<f32>) -> vec2<f32> {
  let inv_dir = 1.0 / dir;
  let t0 = (box_min - origin) * inv_dir;
  let t1 = (box_max - origin) * inv_dir;
  let tmin = min(t0, t1);
  let tmax = max(t0, t1);
  let t_enter = max(max(tmin.x, tmin.y), tmin.z);
  let t_exit = min(min(tmax.x, tmax.y), tmax.z);
  return vec2<f32>(t_enter, t_exit);
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  pick_output.hit_u = 0.0;
  pick_output.hit_v = 0.0;
  pick_output.hit_w = 0.0;
  pick_output.scalar_value = 0.0;
  pick_output.mask_code = 0u;
  pick_output.hit_flag = 0u;

  let origin = uniforms.ray_origin;
  let dir = normalize(uniforms.ray_dir);

  let box_min = max(vec3<f32>(0.0, 0.0, 0.0), uniforms.clip_min);
  let box_max = min(vec3<f32>(1.0, 1.0, 1.0), uniforms.clip_max);

  let t_hit = intersect_aabb(origin, dir, box_min, box_max);
  let t_start = max(0.0, t_hit.x);
  let t_end = t_hit.y;

  if (t_start >= t_end || t_end < 0.0) {
    return;
  }

  var current_t = t_start;
  let step_size = uniforms.step_size;
  let max_steps = uniforms.max_steps;

  for (var i = 0u; i < max_steps; i = i + 1u) {
    if (current_t > t_end) {
      break;
    }

    let pos = origin + current_t * dir;

    if (all(pos >= box_min) && all(pos <= box_max)) {
      let raw_sample = textureSampleLevel(volume_texture, volume_sampler, pos, 0.0).r;
      let physical_val = raw_sample * uniforms.scalar_scale + uniforms.scalar_offset;

      if (raw_sample > uniforms.opacity_threshold) {
        pick_output.hit_u = pos.x;
        pick_output.hit_v = pos.y;
        pick_output.hit_w = pos.z;
        pick_output.scalar_value = physical_val;
        pick_output.mask_code = 1u;
        pick_output.hit_flag = 1u;
        return;
      }
    }

    current_t = current_t + step_size;
  }
}
`;
