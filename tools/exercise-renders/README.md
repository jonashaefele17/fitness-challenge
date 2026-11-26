# Exercise and device renders

Offline tool that produces the catalogue images (device types and exercises). It is not part of
the app bundle: the app only shows the exported WebP files from Supabase Storage.

## How it works

- `figur3d.js` loads an anatomical muscle model, binds it to a small hand-built skeleton, poses
  it from hand/foot targets and colours muscle groups (primary / secondary).
- `geraete3d.js` builds the gym devices from simple shapes (cable tower, Technogym machines …).
- `render.html` holds one entry per exercise (pose, device, camera, muscles) and renders stills.
- `server.py` serves the folder and stores rendered PNGs in `ausgabe/`.
- `export.py` crops them and writes `supabase/catalog-images/**.webp`.

## Rendering

1. Download the model files into `modell/` (not committed, about 2.7 MB):
   `muscles.glb` and `skin.glb` from
   `https://github.com/alex-chan/movement-lab/tree/main/web/public/models`.
2. `python tools/exercise-renders/server.py 8767`
3. Open in a browser (WebGL needed):
   - exercises: `http://localhost:8767/render.html?standbild=1&groesse=1024&speichern=1&transparent=1`
   - devices: add `&nurgeraet=1&uebung=<ids>` (ids of the entries that stand for a device)
4. `python tools/exercise-renders/export.py` (needs Pillow)
5. `node scripts/upload-catalog-images.mjs` uploads them to the `catalog` bucket.

Other parameters: `uebung=a,b` (only these), `bilder=9` (motion phases instead of one still),
`kamera=x,y,z,tx,ty,tz` (inspection camera).

## Licence of the model

The anatomy model derives from Z-Anatomy (https://www.z-anatomy.com/, CC BY-SA 4.0), which builds
on BodyParts3D (© The Database Center for Life Science, CC BY-SA 2.1 Japan). The simplified GLB
files come from the Movement Lab project. Images rendered from it must keep this attribution;
a modified model has to stay under the same licence. The code in this folder is our own.
