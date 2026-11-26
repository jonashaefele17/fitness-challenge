"""Crops the transparent renders in ausgabe/ and writes them as WebP into supabase/catalog-images/.

Usage (from the repo root):  python tools/exercise-renders/export.py
File names are the storage paths the catalogue migration refers to.
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "ausgabe")
OUT = os.path.join(HERE, "..", "..", "supabase", "catalog-images")

# render id -> file name (device image: <id>_geraet.png, exercise image: <id>_bild.png)
DEVICE_TYPES = {
    "kurzhanteln": "kurzhanteln", "trizepsdruecken": "kabelturm", "brustpresse": "brustpresse",
    "butterfly": "butterfly", "latzug": "latzug", "rudern": "ruderzug",
    "rudermaschine": "rudermaschine", "seitheben": "seithebe-maschine", "beinpresse": "beinpresse",
    "beinstrecker": "beinstrecker", "beinbeuger": "beinbeuger",
    "adduktoren": "adduktoren-maschine", "abduktoren": "abduktoren-maschine",
}
EXERCISES = {
    "schraegbank": "schraegbankdruecken-mit-kurzhanteln", "bizepscurls": "bizepscurls-mit-kurzhanteln",
    "trizepsdruecken": "trizepsdruecken-am-kabel", "trizeps_ueberkopf": "trizepsstrecken-ueber-kopf-am-kabel",
    "bizepscurls_kabel": "bizepscurls-am-kabel", "seitheben_kabel": "seitheben-am-kabel",
    "brustpresse": "brustpresse", "butterfly": "butterfly", "reverse_butterfly": "reverse-butterfly",
    "latzug": "latzug", "latzug_eng": "latzug-eng", "rudern": "enges-rudern-sitzend",
    "rudermaschine": "rudern-an-der-maschine", "seitheben": "seitheben-an-der-maschine",
    "beinpresse": "beinpresse", "beinstrecker": "beinstrecken", "beinbeuger": "beinbeugen",
    "adduktoren": "adduktoren", "abduktoren": "abduktoren",
}


def export(source: str, target: str) -> None:
    image = Image.open(source).convert("RGBA")
    box = image.split()[3].point(lambda a: 255 if a > 10 else 0).getbbox()
    image = image.crop(box)
    width, height = image.size
    side = int(max(width, height) * 1.08)  # square with a little air around the subject
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(image, ((side - width) // 2, (side - height) // 2))
    os.makedirs(os.path.dirname(target), exist_ok=True)
    square.resize((640, 640), Image.LANCZOS).save(target, quality=84, method=6)


for render_id, name in DEVICE_TYPES.items():
    export(os.path.join(SRC, f"{render_id}_geraet.png"), os.path.join(OUT, "device-types", f"{name}.webp"))
for render_id, name in EXERCISES.items():
    export(os.path.join(SRC, f"{render_id}_bild.png"), os.path.join(OUT, "exercises", f"{name}.webp"))
print(f"exported {len(DEVICE_TYPES) + len(EXERCISES)} images")
