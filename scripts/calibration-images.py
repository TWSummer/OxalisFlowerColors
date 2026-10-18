"""Prepare unchanged photo previews for manual review; never predicts labels."""
import json, pathlib, urllib.request, time, sys, math
from PIL import Image, ImageOps, ImageDraw, ImageFont
root=pathlib.Path(__file__).resolve().parents[1]/'review-work'/'calibration-2026-10'
photos=root/'originals'; sheets=root/'sheets'; crops=root/'crops'
for p in (photos,sheets,crops): p.mkdir(exist_ok=True,parents=True)
manifest=json.loads((root/'manifest.json').read_text())
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20)
mode=sys.argv[1] if len(sys.argv)>1 else 'download'
if mode=='download':
    for i,o in enumerate(manifest['observations']):
        for p in o['photos']:
            dest=photos/f"{p['id']}.jpg"
            if not dest.exists():
                url=p['url'].replace('/square.','/original.')
                with urllib.request.urlopen(url,timeout=60) as response: dest.write_bytes(response.read())
                time.sleep(.25)
        print(i+1,o['observation_id'],flush=True)
elif mode=='sheets':
    for i,o in enumerate(manifest['observations']):
        if any(not (photos/f"{p['id']}.jpg").exists() for p in o['photos']): continue
        cell=620; n=len(o['photos']); cols=min(n,2); rows=math.ceil(n/cols)
        canvas=Image.new('RGB',(cell*cols,cell*rows),'#dddddd'); draw=ImageDraw.Draw(canvas)
        for j,p in enumerate(o['photos']):
            im=ImageOps.exif_transpose(Image.open(photos/f"{p['id']}.jpg")).convert('RGB')
            thumb=ImageOps.contain(im,(cell,cell-48))
            x=(j%cols)*cell; y=(j//cols)*cell
            canvas.paste(thumb,(x+(cell-thumb.width)//2,y+48+(cell-48-thumb.height)//2))
            draw.text((x+8,y+5),f"#{i+1:03d} obs {o['observation_id']} / photo {p['id']}",font=font,fill='black')
            draw.text((x+8,y+27),f"Source preview {im.width} x {im.height}",font=font,fill='black')
        canvas.save(sheets/f'{i+1:03d}.jpg',quality=92)
    print('Created',len(manifest['observations']),'observation sheets')
elif mode=='crops':
    # Coordinates are manually selected after inspecting the unenhanced sheets.
    decisions=json.loads((root/'decisions.json').read_text())
    chosen=[d for d in decisions if d.get('crop')]
    for start in range(0,len(chosen),12):
        items=chosen[start:start+12]; canvas=Image.new('RGB',(1200,math.ceil(len(items)/3)*370),'#eeeeee'); draw=ImageDraw.Draw(canvas)
        for j,d in enumerate(items):
            p=photos/f"{d['photo_id']}.jpg"; im=ImageOps.exif_transpose(Image.open(p)).convert('RGB')
            x,y,w=d['crop']; crop=im.crop((x,y,x+w,y+w)).resize((300,300),Image.Resampling.LANCZOS)
            crop.save(crops/f"{d['index']:03d}.jpg",quality=95)
            dx=(j%3)*400; dy=(j//3)*370
            canvas.paste(crop,(dx+50,dy+60)); draw.text((dx+10,dy+6),f"#{d['index']:03d} / {d['photo_id']}",font=font,fill='black'); draw.text((dx+10,dy+30),f"{w} source pixels -> 300px",font=font,fill='black')
        canvas.save(crops/f'contact-{start//12+1:02d}.jpg',quality=95)
    print('Prepared',len(chosen),'normalized crops')
