"""Reproducible, original small surface images for the first-room pilot.

No photographs or third-party assets are required. WebP files are committed so
players never run this build step. Sizes match their on-screen footprint.
"""
from pathlib import Path
import json
import math
import random
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'textures'
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(529)
manifest = []

def save(name, image, quality=75):
    path = OUT / (name + '.webp')
    image.convert('RGB').save(path, 'WEBP', quality=quality, method=6)
    manifest.append({'name': name, 'file': './assets/textures/' + path.name,
                     'width': image.width, 'height': image.height,
                     'bytes': path.stat().st_size})

def wood(size, base=(119, 96, 70)):
    w, h = size
    image = Image.new('RGB', size, base)
    pixels = image.load()
    grain = [rng.uniform(-8, 8) for _ in range(w)]
    for y in range(h):
        for x in range(w):
            wave = math.sin(x * .26 + math.sin(y / 94) * .8) * 3
            value = grain[x] + wave + rng.uniform(-2.5, 2.5)
            pixels[x, y] = tuple(max(0, min(255, int(v + value))) for v in base)
    draw = ImageDraw.Draw(image, 'RGBA')
    for _ in range(13):
        x, y = rng.randrange(w), rng.randrange(h)
        draw.ellipse((x - 2, y - 18, x + 3, y + 18), outline=(48, 35, 22, 25))
    for _ in range(30):
        x, y = rng.randrange(w), rng.randrange(h)
        draw.line((x, y, x + 1, min(h, y + rng.randrange(5, 40))), fill=(220, 196, 151, 24))
    return image

save('wood', wood((512, 512)), 76)
save('light-wood', wood((256, 256), (178, 161, 122)), 74)

tatami = Image.new('RGB', (512, 512), (184, 188, 140))
p = tatami.load()
for y in range(512):
    for x in range(512):
        noise = rng.uniform(-3, 3)
        weave = (5 if y % 4 == 0 else -4 if y % 2 == 0 else 0)
        weave += -3 if x % 6 == 0 else 0
        value = noise + weave - (x + y) / 128
        p[x, y] = tuple(int(v + value) for v in (184, 188, 140))
d = ImageDraw.Draw(tatami)
for x in (0, 502):
    d.rectangle((x, 0, x + 9, 511), fill=(98, 108, 76))
    d.line((x + 1, 0, x + 1, 511), fill=(124, 134, 91))
    for y in range(5, 512, 19):
        d.line((x + 2, y, x + 7, y), fill=(188, 190, 141), width=2)
save('tatami', tatami, 82)

plaster = Image.new('RGB', (256, 256), (206, 203, 179))
p = plaster.load()
for y in range(256):
    for x in range(256):
        n = rng.uniform(-3, 3)
        p[x, y] = tuple(int(v + n) for v in (206, 203, 179))
stains = Image.new('RGBA', plaster.size)
d = ImageDraw.Draw(stains)
for _ in range(19):
    x, y = rng.randrange(256), rng.randrange(256)
    r = rng.randrange(5, 24)
    d.ellipse((x-r, y-r, x+r, y+r), fill=(103, 104, 74, rng.randrange(3, 12)))
plaster = Image.alpha_composite(plaster.convert('RGBA'), stains.filter(ImageFilter.GaussianBlur(12)))
save('plaster', plaster, 68)

paper = Image.new('RGB', (256, 512), (238, 235, 212))
d = ImageDraw.Draw(paper, 'RGBA')
for _ in range(1600):
    x, y = rng.randrange(256), rng.randrange(512)
    d.line((x,y,x+2,y+4), fill=(110, 107, 80, 9))
save('washi', paper, 68)
shoji = paper.convert('RGBA')
bamboo = Image.new('RGBA', shoji.size)
d = ImageDraw.Draw(bamboo)
for i in range(3):
    x = 32 + i * 86
    d.line((x, 512, x-17, 0), fill=(104, 131, 86, 53), width=4)
    for y in range(35, 500, 76):
        for side in (-1, 1):
            d.polygon([(x-5,y), (x+side*42,y-31), (x+side*24,y-3)], fill=(113, 139, 91, 48))
shoji = Image.alpha_composite(shoji, bamboo.filter(ImageFilter.GaussianBlur(4)))
d = ImageDraw.Draw(shoji, 'RGBA')
for y in (7, 108, 209, 310, 411, 509):
    d.rectangle((0,y+3,255,y+7), fill=(63, 61, 37, 30))
    d.rectangle((0,y,255,y+4), fill=(189, 173, 128, 255))
    d.line((0,y,255,y), fill=(226, 211, 167, 255))
for x in (32, 96, 160, 224):
    d.rectangle((x+2,0,x+5,511), fill=(63, 61, 37, 28))
    d.rectangle((x,0,x+2,511), fill=(186, 170, 126, 255))
    d.line((x,0,x,511), fill=(220, 205, 162, 255))
save('shoji', shoji, 80)

front = wood((512, 128))
d = ImageDraw.Draw(front, 'RGBA')
d.rectangle((0,0,511,127), outline=(53,42,25,180), width=4)
d.line((4,5,507,5), fill=(204,181,130,135), width=2)
for x in (20, 484):
    d.rectangle((x-6,5,x+6,122), fill=(55,58,46,255))
    for y in (17,110):
        d.ellipse((x-2,y-2,x+2,y+2), fill=(135,132,97,255))
for x in (126, 386):
    d.rounded_rectangle((x-25,43,x+25,80), radius=4, fill=(48,52,40,255))
    d.arc((x-19,62,x+19,111), 0, 330, fill=(33,36,27,220), width=6)
    d.arc((x-19,58,x+19,107), 0, 330, fill=(83,86,62,255), width=4)
    for xx in (x-19,x+19):
        d.ellipse((xx-2,52,xx+2,56), fill=(149,144,106,255))
save('drawer-front', front, 83)

# One padded atlas lets differently coloured surfaces share a single GPU material.
# The source images remain reproducible; only this atlas is downloaded by the game.
atlas = Image.new('RGB', (1024, 1024), (160, 157, 118))
tiles = {
    'wood': (6, 6, 244, 500), 'light-wood': (262, 6, 244, 244),
    'plaster': (262, 262, 244, 244), 'tatami': (518, 6, 500, 500),
    'shoji': (6, 518, 244, 500), 'washi': (262, 518, 244, 500),
    'drawer-front': (518, 518, 500, 116),
}
layout = {}
for name, (x, y, w, h) in tiles.items():
    tile = Image.open(OUT / (name + '.webp')).convert('RGB').resize((w,h), Image.Resampling.LANCZOS)
    atlas.paste(tile, (x,y))
    atlas.paste(tile.crop((0,0,1,h)).resize((6,h)), (x-6,y))
    atlas.paste(tile.crop((w-1,0,w,h)).resize((6,h)), (x+w,y))
    atlas.paste(tile.crop((0,0,w,1)).resize((w,6)), (x,y-6))
    atlas.paste(tile.crop((0,h-1,w,h)).resize((w,6)), (x,y+h))
    for dx,dy,sx,sy in [(-6,-6,0,0),(w,-6,w-1,0),(-6,h,0,h-1),(w,h,w-1,h-1)]:
        atlas.paste(tile.crop((sx,sy,sx+1,sy+1)).resize((6,6)),(x+dx,y+dy))
    layout[name]={'x':x,'y':y,'width':w,'height':h}
atlas_path=OUT/'surface-atlas.webp'
atlas.save(atlas_path,'WEBP',quality=82,method=6)
atlas_info={'file':'./assets/textures/surface-atlas.webp','width':1024,'height':1024,
            'bytes':atlas_path.stat().st_size,'padding':6,'tiles':layout}
data={'textures':manifest,'sourceTotalBytes':sum(t['bytes'] for t in manifest),
      'totalBytes':atlas_info['bytes'],'atlas':atlas_info}
(OUT / 'manifest.json').write_text(json.dumps(data, indent=2), encoding='utf-8')
(OUT / 'atlas-layout.js').write_text('export const textureAtlas = '+json.dumps(atlas_info)+';\n',encoding='utf-8')
print(json.dumps(data,indent=2))
