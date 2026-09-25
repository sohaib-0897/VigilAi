"""
VigilAI — Download and Prepare Construction PPE Dataset for Fine-Tuning

Dataset: Ultralytics Construction-PPE
License: AGPL-3.0 (Open Source Computer Vision)
Classes: helmet, gloves, vest, boots, goggles, none, Person, no_helmet, no_goggle, no_gloves, no_boots
Source: https://github.com/ultralytics/assets/releases/download/v0.0.0/construction-ppe.zip
"""

import os
import shutil
import urllib.request
import zipfile
from pathlib import Path

DATASET_URL = "https://github.com/ultralytics/assets/releases/download/v0.0.0/construction-ppe.zip"
ROOT_DIR = Path(__file__).resolve().parent.parent
DATASETS_DIR = ROOT_DIR / "datasets"
ZIP_PATH = DATASETS_DIR / "construction-ppe.zip"
EXTRACT_DIR = DATASETS_DIR / "construction-ppe"
MINI_DIR = DATASETS_DIR / "construction-ppe-mini"


def prepare_dataset():
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Download zip if not present
    if not ZIP_PATH.exists() and not EXTRACT_DIR.exists():
        print(f"Downloading Construction PPE dataset from: {DATASET_URL}...")
        urllib.request.urlretrieve(DATASET_URL, ZIP_PATH)
        print(f"Downloaded to {ZIP_PATH} ({ZIP_PATH.stat().st_size / (1024 * 1024):.1f} MB)")

    # 2. Extract if not already extracted
    if not EXTRACT_DIR.exists() and ZIP_PATH.exists():
        print("Extracting construction-ppe.zip...")
        with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
            zip_ref.extractall(DATASETS_DIR)
        print("Extracted successfully.")

    # Locate images and labels
    # Zip may extract directly to datasets/construction-ppe or datasets/images
    base_src = EXTRACT_DIR if EXTRACT_DIR.exists() else DATASETS_DIR
    train_imgs = list((base_src / "images" / "train").glob("*.jpg")) + list((base_src / "images" / "train").glob("*.png"))
    val_imgs = list((base_src / "images" / "val").glob("*.jpg")) + list((base_src / "images" / "val").glob("*.png"))

    if not train_imgs:
        # Search recursively
        train_imgs = list(DATASETS_DIR.glob("**/images/train/*.jpg")) + list(DATASETS_DIR.glob("**/images/train/*.png"))
        val_imgs = list(DATASETS_DIR.glob("**/images/val/*.jpg")) + list(DATASETS_DIR.glob("**/images/val/*.png"))

    print(f"Found {len(train_imgs)} train images, {len(val_imgs)} val images in source dataset.")

    # 3. Create reproducible mini split for fast CPU fine-tuning (50 train, 15 val)
    mini_train_img_dir = MINI_DIR / "images" / "train"
    mini_train_lbl_dir = MINI_DIR / "labels" / "train"
    mini_val_img_dir = MINI_DIR / "images" / "val"
    mini_val_lbl_dir = MINI_DIR / "labels" / "val"

    for d in [mini_train_img_dir, mini_train_lbl_dir, mini_val_img_dir, mini_val_lbl_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # Copy 50 train images + labels
    for img_path in sorted(train_imgs)[:50]:
        dest_img = mini_train_img_dir / img_path.name
        shutil.copy2(img_path, dest_img)
        # Find corresponding label
        lbl_name = img_path.stem + ".txt"
        lbl_candidate = img_path.parent.parent.parent / "labels" / "train" / lbl_name
        if lbl_candidate.exists():
            shutil.copy2(lbl_candidate, mini_train_lbl_dir / lbl_name)

    # Copy 15 val images + labels
    for img_path in sorted(val_imgs)[:15]:
        dest_img = mini_val_img_dir / img_path.name
        shutil.copy2(img_path, dest_img)
        lbl_name = img_path.stem + ".txt"
        lbl_candidate = img_path.parent.parent.parent / "labels" / "val" / lbl_name
        if lbl_candidate.exists():
            shutil.copy2(lbl_candidate, mini_val_lbl_dir / lbl_name)

    # Create data.yaml
    yaml_content = f"""# Ultralytics Construction-PPE Curated Split for VigilAI Fine-Tuning
# License: AGPL-3.0
path: {MINI_DIR.as_posix()}
train: images/train
val: images/val

nc: 11
names:
  0: helmet
  1: gloves
  2: vest
  3: boots
  4: goggles
  5: none
  6: Person
  7: no_helmet
  8: no_goggle
  9: no_gloves
  10: no_boots
"""

    yaml_path = MINI_DIR / "data.yaml"
    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write(yaml_content)

    print(f"Mini dataset ready at: {MINI_DIR}")
    print(f"Config generated at: {yaml_path}")
    print(f"Train images: {len(list(mini_train_img_dir.glob('*.*')))}")
    print(f"Val images: {len(list(mini_val_img_dir.glob('*.*')))}")


if __name__ == "__main__":
    prepare_dataset()
