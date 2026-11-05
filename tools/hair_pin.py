"""Stabilises the town hair layers: one hair shape per direction, pinned to body_m1's head in every frame.
Why: each frame of the original hair strips was cut from a separately redrawn PixelLab frame, so the hair changed shape and
size from frame to frame (flicker in motion). Now:
  - reference = the idle_<dir> frame with the most hair pixels (the fullest, cleanest cut);
  - head anchor of a body frame = (centre of the top 6 rows, top row) of body_m1's figure;
  - every idle_<dir> and walk_<dir> frame gets the reference shape moved by (frame anchor - reference anchor).
usage: hair_pin.py <chars2 dir>"""
import sys, os, glob
from PIL import Image
C = sys.argv[1]; F = 64
def frames(im, n): return [im.crop((i * F, 0, (i + 1) * F, F)) for i in range(n)]
def anchor(fr):
    bb = fr.getbbox(); a = fr.getchannel("A"); xs = [x for y in range(bb[1], bb[1] + 6) for x in range(F) if a.getpixel((x, y))]
    return ((min(xs) + max(xs)) / 2, bb[1])
for hd in sorted(glob.glob(f"{C}/hair/*")):
    h = os.path.basename(hd)
    for d in ("down", "up", "left", "right"):
        idle = Image.open(f"{hd}/idle_{d}.png").convert("RGBA"); fi = frames(idle, idle.width // F)
        counts = [sum(1 for v in f.getchannel("A").get_flattened_data() if v) for f in fi]
        ri = max(range(len(fi)), key=lambda i: counts[i]); ref = fi[ri]
        bidle = Image.open(f"{C}/body/body_m1/idle_{d}.png").convert("RGBA")
        ax0, ay0 = anchor(frames(bidle, bidle.width // F)[ri])
        for anim in ("idle", "walk"):
            body = Image.open(f"{C}/body/body_m1/{anim}_{d}.png").convert("RGBA"); n = body.width // F
            out = Image.new("RGBA", body.size, (0, 0, 0, 0))
            for i, bf in enumerate(frames(body, n)):
                ax, ay = anchor(bf); dx, dy = round(ax - ax0), ay - ay0
                c = Image.new("RGBA", (F, F), (0, 0, 0, 0)); c.paste(ref, (dx, dy), ref); out.paste(c, (i * F, 0))
            out.save(f"{hd}/{anim}_{d}.png")
        print(h, d, "ref idle frame", ri, "px", counts[ri])
