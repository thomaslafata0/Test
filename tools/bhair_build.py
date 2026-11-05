"""Battle hair layers for chars2: cut each hairstyle from a PixelLab state of battle body_m1 (north-east rotation),
recolour it to the pack's three hair shades, and pin it to the head in every battle frame by matching the head shape.
usage: bhair_build.py <rotations dir> <chars2 dir>"""
import sys, colorsys, json
from PIL import Image
R, C = sys.argv[1], sys.argv[2]; F = 96
HAIR = [(0x4a, 0x2c, 0x1a), (0x7a, 0x4a, 0x2a), (0xb0, 0x7a, 0x4a)]
STYLES = ['hair_short', 'hair_cropped', 'hair_long_tied', 'hair_shaved', 'hair_mohawk', 'hair_bob']
ANIMS = ['idle', 'attack', 'charge', 'hit', 'defend', 'death']
def px(im): return im.load()
def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
def outline(c): return max(c[:3]) < 26
def is_skin_pink(c): return c[3] > 0 and c[0] > 150 and c[0] > c[1] + 15 and c[1] > c[2] - 5
def is_skin_grey(c): return c[3] > 0 and abs(c[0] - c[1]) < 12 and abs(c[1] - c[2]) < 12 and c[0] > 95
def hairish(c):
    # Hair browns have red/green under ~1.72; the pink skin ramp (incl. its shadow #74403a) sits at ~1.8 and is brighter.
    if c[3] == 0: return False
    r, g, b = c[:3]
    if max(r, g, b) < 26: return True
    return g > 0 and r / g < 1.72 and r > g > b * 0.9 and max(r, g, b) < 140
body = Image.open(f'{R}/body_north-east.png').convert('RGBA'); bp = px(body)
# head mask of the reference body: skin pixels in the top 12 rows of the figure
top = body.getbbox()[1]
def mask_of(im, test, y0=0, y1=F):
    p = px(im); return {(x, y) for y in range(y0, min(y1, im.height)) for x in range(im.width) if test(p[x, y])}
headT = mask_of(body, is_skin_pink, top, top + 12)
def rot(pts, k):
    out = set(pts)
    for _ in range(k): out = {(-y, x) for x, y in out}
    mx, my = min(x for x, _ in out), min(y for _, y in out)
    return {(x - mx, y - my) for x, y in out}, (mx, my)
hmx, hmy = min(x for x, _ in headT), min(y for _, y in headT)
head0 = {(x - hmx, y - hmy) for x, y in headT}
templates = {k: rot(head0, k)[0] for k in (0, 1, 3)}
def locate(frame, prev=None):
    sk = mask_of(frame, is_skin_grey)
    best = None
    for k, T in templates.items():
        w = max(x for x, _ in T) + 1; h = max(y for _, y in T) + 1
        for oy in range(-2, F - h + 2):
            for ox in range(-2, F - w + 2):
                hit = sum(1 for (x, y) in T if (x + ox, y + oy) in sk)
                score = hit / len(T) - (0.15 if k else 0)
                if best is None or score > best[0]: best = (score, k, ox, oy)
    return best
def cut_hair(style):
    im = Image.open(f'{R}/{style}_north-east.png').convert('RGBA'); p = px(im)
    out = Image.new('RGBA', (F, F)); o = px(out)
    for y in range(F):
        for x in range(F):
            c, b = p[x, y], bp[x, y]
            if c[3] == 0 or not hairish(c): continue
            if c[:3] == b[:3] and b[3]: continue
            if y > top + 34: continue
            o[x, y] = c
    # keep dark pixels only next to hair colour, then only the blobs that reach the head
    q = px(out)
    dark = [(x, y) for y in range(F) for x in range(F) if q[x, y][3] and outline(q[x, y])]
    for x, y in dark:
        if not any(0 <= x + dx < F and 0 <= y + dy < F and q[x + dx, y + dy][3] and not outline(q[x + dx, y + dy]) for dx in (-1, 0, 1) for dy in (-1, 0, 1)): q[x, y] = (0, 0, 0, 0)
    seen, keep = set(), set()
    for y in range(F):
        for x in range(F):
            if q[x, y][3] and (x, y) not in seen:
                comp, st = [], [(x, y)]; seen.add((x, y))
                while st:
                    a, b = st.pop(); comp.append((a, b))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            u, v = a + dx, b + dy
                            if 0 <= u < F and 0 <= v < F and (u, v) not in seen and q[u, v][3]: seen.add((u, v)); st.append((u, v))
                if min(b for _, b in comp) <= top + 10 and len(comp) >= 6: keep.update(comp)
    for y in range(F):
        for x in range(F):
            if (x, y) not in keep: q[x, y] = (0, 0, 0, 0)
    # despeck: drop pixels with fewer than 2 neighbours, and lone dark pixels not touching hair colour
    for _ in range(2):
        q = px(out); kill = []
        for y in range(F):
            for x in range(F):
                if q[x, y][3] == 0: continue
                n = sum(1 for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and 0 <= x + dx < F and 0 <= y + dy < F and q[x + dx, y + dy][3])
                if n < 2: kill.append((x, y))
        for k in kill: q[k] = (0, 0, 0, 0)
    # recolour to the pack ramp by brightness; outline stays near-black
    q = px(out); L = [lum(q[x, y]) for y in range(F) for x in range(F) if q[x, y][3] and not outline(q[x, y])]
    L.sort(); t1, t2 = (L[len(L) // 3], L[2 * len(L) // 3]) if L else (80, 120)
    for y in range(F):
        for x in range(F):
            c = q[x, y]
            if not c[3]: continue
            l = lum(c)
            q[x, y] = (7, 8, 10, 255) if outline(c) else (*(HAIR[0] if l < t1 else HAIR[1] if l < t2 else HAIR[2]), 255)
    return out
def rotimg(im, k):
    return im.rotate(90 * k, expand=False) if k else im
report = {}; LOC = {}
BODIES = ['body_m1', 'body_m2', 'body_f1', 'body_f2']
import os
for st in STYLES:
    hair = cut_hair(st)
    pts = [(x - hmx, y - hmy, hair.getpixel((x, y))) for y in range(F) for x in range(F) if hair.getpixel((x, y))[3]]
    report[st] = {'px': len(pts), 'bbox': hair.getbbox()}
    for bd in BODIES:
        os.makedirs(f'{C}/hair/{st}/battle/{bd}', exist_ok=True)
        for a in ANIMS:
            strip = Image.open(f'{C}/body/{bd}/battle/{a}.png').convert('RGBA'); n = strip.width // F
            out = Image.new('RGBA', strip.size)
            for i in range(n):
                key = (bd, a, i)
                if key not in LOC: LOC[key] = locate(strip.crop((i * F, 0, (i + 1) * F, F)))
                sc, k, ox, oy = LOC[key]
                hp, hx = list(pts), set(head0)
                for _ in range(k): hp = [(-y, x, c) for x, y, c in hp]; hx = {(-y, x) for x, y in hx}
                if k:
                    mx, my = min(x for x, _ in hx), min(y for _, y in hx); hp = [(x - mx, y - my, c) for x, y, c in hp]
                for x, y, c in hp:
                    X, Y = x + ox, y + oy
                    if 0 <= X < F and 0 <= Y < F: out.putpixel((i * F + X, Y), c)
            out.save(f'{C}/hair/{st}/battle/{bd}/{a}.png')
    print(st, report[st])
print(json.dumps({f'{b}:{a}{i}': [round(v[0], 2), v[1], v[2], v[3]] for (b, a, i), v in LOC.items()}))
