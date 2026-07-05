#!/usr/bin/env python3
"""
animate_building.py <input_video> <building_type> [--fps 12] [--no-pingpong]
Pipeline v2: ffmpeg frame extraction -> optional ping-pong -> rembg (shared
session, full source resolution) -> temporal alpha stabilization -> 256x256
resize -> animated WebP encode.
Output: questmaster/public/buildings/<building_type>-sm.webp

v2 changes (2026-07-04):
- Output 192x192, not 64x64. Leaflet stretches the image across the building's
  geo-bounds footprint, which on a 3x retina iPhone can be several hundred
  device pixels — 64px source was the cause of the blur.
- Temporal stabilization. rembg infers the mask independently per frame, so
  static regions (the building base, faint ground shading) flickered. The
  static test keys off *source-video RGB* variance, NOT alpha variance: a
  faint ground sketch never moves in the video, but rembg's alpha guess for
  it swings wildly — alpha variance would misclassify exactly the pixels
  that flicker worst. Pixels with stable source RGB get median-locked alpha
  AND RGB (no flicker, and identical static regions compress much better);
  only genuinely moving pixels (swinging sign) keep per-frame values, with
  alpha smoothed over a loop-aware 3-frame window.
- Trims to a short centered window of the source clip (default 2.5s) instead
  of the whole clip, before ping-ponging. First attempt at 256px kept the full
  ~6s clip (71 raw frames -> 140 after pingpong) and crashed iOS Safari's
  WebKit renderer to solid black when the Map tab mounted it — every building
  icon carries an unconditional CSS `filter: drop-shadow(...)` (index.css), and
  filters force per-frame re-compositing on an animated image; at 256px/140
  frames that's ~36MB of decoded pixels continuously re-filtered, which is a
  known WebKit GPU-compositor crash trigger. Motion clips are usually several
  repeated cycles anyway, so a short window still captures one full swing.
"""
import argparse, subprocess, tempfile, glob, os
import numpy as np
from PIL import Image
from rembg import remove, new_session

SIZE = 192
RGB_STD_THRESH = 8.0  # source RGB std-dev (0-255) below which a pixel is static

def probe_duration(video_path):
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=noprint_wrappers=1:nokey=1', video_path],
        check=True, capture_output=True, text=True,
    )
    return float(out.stdout.strip())

def extract_frames(video_path, out_dir, fps, window):
    args = ['ffmpeg', '-y']
    if window:
        duration = probe_duration(video_path)
        start = max(0, (duration - window) / 2)
        args += ['-ss', f'{start:.3f}', '-t', f'{window:.3f}']
    args += ['-i', video_path, '-vf', f'fps={fps}', f'{out_dir}/frame_%03d.png']
    subprocess.run(args, check=True, capture_output=True)
    return sorted(glob.glob(f'{out_dir}/frame_*.png'))

def pingpong(frame_paths):
    if len(frame_paths) < 3:
        return frame_paths
    return frame_paths + frame_paths[-2:0:-1]

def remove_backgrounds(frame_paths, session):
    src, out = [], []
    for p in frame_paths:
        img = Image.open(p)
        src.append(np.array(img.convert('RGB')))
        # alpha_matting=True is required here (unlike the static /add-building-icon
        # pipeline) — default rembg does a fairly binary cutout that strips soft/
        # translucent regions (window glow halos, smoke wisps) along with the real
        # background. Confirmed via direct A/B test 2026-07-01.
        img = remove(
            img, session=session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=5,
        )
        out.append(np.array(img.convert('RGBA')))
    return np.stack(src), np.stack(out)  # (T,H,W,3), (T,H,W,4)

def stabilize(src, stack):
    rgb_std = src.astype(np.float32).std(axis=0).max(axis=-1)  # (H, W)
    static = rgb_std < RGB_STD_THRESH
    alpha = stack[..., 3].astype(np.float32)
    med_rgba = np.median(stack.astype(np.float32), axis=0)
    # loop-aware 3-frame rolling average for the moving pixels' alpha
    smoothed = (np.roll(alpha, 1, axis=0) + alpha + np.roll(alpha, -1, axis=0)) / 3.0
    fixed_alpha = np.where(static[None, :, :], med_rgba[None, ..., 3], smoothed)
    stack[..., 3] = np.clip(fixed_alpha, 0, 255).astype(np.uint8)
    med_rgb = np.clip(med_rgba[..., :3], 0, 255).astype(np.uint8)
    stack[..., :3] = np.where(static[None, :, :, None], med_rgb[None], stack[..., :3])
    return stack, static.mean() * 100

def encode_webp(stack, dst, fps):
    frames = [Image.fromarray(f).resize((SIZE, SIZE), Image.LANCZOS) for f in stack]
    frames[0].save(
        dst, 'WEBP', save_all=True, append_images=frames[1:],
        duration=round(1000 / fps), loop=0, method=6, quality=80,
        minimize_size=True,
    )

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input_video')
    ap.add_argument('building_type')
    ap.add_argument('--fps', type=int, default=12)
    ap.add_argument('--no-pingpong', action='store_true')
    ap.add_argument('--window', type=float, default=2.5,
                     help='seconds of source clip to use, centered (0 = whole clip)')
    ap.add_argument('--out-dir', default='questmaster/public/buildings')
    args = ap.parse_args()

    dst = os.path.join(args.out_dir, f'{args.building_type}-sm.webp')
    with tempfile.TemporaryDirectory() as tmp:
        frame_paths = extract_frames(args.input_video, tmp, args.fps, args.window)
        if not args.no_pingpong:
            frame_paths = pingpong(frame_paths)
        session = new_session()
        src, stack = remove_backgrounds(frame_paths, session)
        stack, pct_static = stabilize(src, stack)
        encode_webp(stack, dst, args.fps)

    n = Image.open(dst).n_frames
    kb = os.path.getsize(dst) // 1024
    print(f'Saved: {dst} ({n} frames @ {args.fps}fps, {SIZE}x{SIZE}, {kb}KB, '
          f'{pct_static:.1f}% pixels on locked matte)')

if __name__ == '__main__':
    main()
