"""
VigilAi — Comprehensive PPE Dataset Validation & Class Distribution Analysis

Validates the Ultralytics Construction-PPE dataset across train, val, and test splits:
- Corrupt/unreadable images
- Missing label files & empty annotations
- Malformed labels (invalid class IDs, zero-area boxes, out-of-bounds coords)
- Cross-split data leakage (SHA-256 image hashes)
- Per-class instance and image distribution analysis
Outputs: benchmarks/ppe_dataset_report.json
"""

import hashlib
import json
import os
from collections import Counter, defaultdict
from pathlib import Path

import cv2
import yaml

DATASET_ROOT = Path(__file__).resolve().parent.parent / "datasets"
CONFIG_FILE = DATASET_ROOT / "data.yaml"
OUTPUT_REPORT = Path(__file__).resolve().parent.parent / "benchmarks" / "ppe_dataset_report.json"

CLASS_NAMES = {
    0: "helmet",
    1: "gloves",
    2: "vest",
    3: "boots",
    4: "goggles",
    5: "none",
    6: "Person",
    7: "no_helmet",
    8: "no_goggle",
    9: "no_gloves",
    10: "no_boots"
}


def compute_file_hash(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def validate_ppe_dataset():
    print("=" * 80)
    print("  VigilAI — Full PPE Dataset Validation & Integrity Audit")
    print("=" * 80)

    splits = ["train", "val", "test"]
    split_stats = {}
    image_hashes = {}  # hash -> (split, filename)
    leakage_records = []
    corrupt_files = []
    invalid_labels = []
    unlabeled_images = []
    empty_label_files = []

    total_images_all = 0
    total_labels_all = 0
    total_instances_all = 0

    per_class_instances_global = Counter()
    per_class_images_global = Counter()

    for split in splits:
        img_dir = DATASET_ROOT / "images" / split
        lbl_dir = DATASET_ROOT / "labels" / split

        img_files = sorted(list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.png")) + list(img_dir.glob("*.jpeg")))
        lbl_files = sorted(list(lbl_dir.glob("*.txt")))

        split_images_count = len(img_files)
        split_labels_count = len(lbl_files)
        total_images_all += split_images_count
        total_labels_all += split_labels_count

        split_instances_count = 0
        per_class_instances_split = Counter()
        per_class_images_split = Counter()

        print(f"\nAnalyzing split '{split}': {split_images_count} images, {split_labels_count} label files...")

        # Map labels by stem
        lbl_map = {f.stem: f for f in lbl_files}

        for img_path in img_files:
            # 1. Verify image readability & integrity
            try:
                img = cv2.imread(str(img_path))
                if img is None:
                    corrupt_files.append({"file": str(img_path), "reason": "cv2.imread returned None"})
                    continue
                h_img, w_img = img.shape[:2]
                if h_img <= 0 or w_img <= 0:
                    corrupt_files.append({"file": str(img_path), "reason": f"Invalid dimensions {w_img}x{h_img}"})
                    continue
            except Exception as e:
                corrupt_files.append({"file": str(img_path), "reason": str(e)})
                continue

            # 2. Check duplicate/leakage across splits via SHA-256
            f_hash = compute_file_hash(img_path)
            if f_hash in image_hashes:
                prev_split, prev_name = image_hashes[f_hash]
                leakage_records.append({
                    "split_a": prev_split,
                    "file_a": prev_name,
                    "split_b": split,
                    "file_b": img_path.name,
                    "hash": f_hash
                })
            else:
                image_hashes[f_hash] = (split, img_path.name)

            # 3. Verify corresponding label
            stem = img_path.stem
            if stem not in lbl_map:
                unlabeled_images.append({"split": split, "image": img_path.name})
                continue

            lbl_path = lbl_map[stem]
            try:
                with open(lbl_path, "r", encoding="utf-8") as lf:
                    lines = [line.strip() for line in lf if line.strip()]
            except Exception as e:
                invalid_labels.append({"file": str(lbl_path), "reason": f"Cannot read label: {e}"})
                continue

            if not lines:
                empty_label_files.append({"split": split, "file": lbl_path.name})
                continue

            seen_classes_in_image = set()

            for line_idx, line in enumerate(lines):
                parts = line.split()
                if len(parts) < 5:
                    invalid_labels.append({
                        "file": str(lbl_path),
                        "line": line_idx + 1,
                        "content": line,
                        "reason": f"Expected >= 5 fields, got {len(parts)}"
                    })
                    continue

                try:
                    cls_id = int(parts[0])
                    xc, yc, w, h = map(float, parts[1:5])
                except ValueError as e:
                    invalid_labels.append({
                        "file": str(lbl_path),
                        "line": line_idx + 1,
                        "content": line,
                        "reason": f"Type conversion failed: {e}"
                    })
                    continue

                # Class validation
                if cls_id not in CLASS_NAMES:
                    invalid_labels.append({
                        "file": str(lbl_path),
                        "line": line_idx + 1,
                        "content": line,
                        "reason": f"Invalid class ID {cls_id} not in 0-10"
                    })
                    continue

                # Geometry checks
                if w <= 0 or h <= 0:
                    invalid_labels.append({
                        "file": str(lbl_path),
                        "line": line_idx + 1,
                        "content": line,
                        "reason": f"Non-positive box width/height ({w}, {h})"
                    })
                    continue

                if xc < 0 or xc > 1.0 or yc < 0 or yc > 1.0:
                    invalid_labels.append({
                        "file": str(lbl_path),
                        "line": line_idx + 1,
                        "content": line,
                        "reason": f"Center coordinate outside [0, 1]: ({xc}, {yc})"
                    })
                    continue

                # Calculate box bounds
                x1 = xc - w / 2
                y1 = yc - h / 2
                x2 = xc + w / 2
                y2 = yc + h / 2

                # Allow minor floating point epsilon beyond [0, 1]
                if x1 < -0.05 or y1 < -0.05 or x2 > 1.05 or y2 > 1.05:
                    invalid_labels.append({
                        "file": str(lbl_path),
                        "line": line_idx + 1,
                        "content": line,
                        "reason": f"Box boundaries excessively exceed frame: [{x1:.2f}, {y1:.2f}, {x2:.2f}, {y2:.2f}]"
                    })
                    continue

                split_instances_count += 1
                total_instances_all += 1
                per_class_instances_split[cls_id] += 1
                per_class_instances_global[cls_id] += 1
                seen_classes_in_image.add(cls_id)

            for c in seen_classes_in_image:
                per_class_images_split[c] += 1
                per_class_images_global[c] += 1

        split_stats[split] = {
            "images_count": split_images_count,
            "labels_count": split_labels_count,
            "instances_count": split_instances_count,
            "per_class_instances": {CLASS_NAMES[k]: v for k, v in sorted(per_class_instances_split.items())},
            "per_class_images": {CLASS_NAMES[k]: v for k, v in sorted(per_class_images_split.items())},
        }

    # Summary Report
    report = {
        "dataset_name": "Ultralytics Construction-PPE",
        "dataset_source": "https://github.com/ultralytics/assets/releases/download/v0.0.0/construction-ppe.zip",
        "license": "GNU Affero General Public License v3.0 (AGPL-3.0)",
        "classes": CLASS_NAMES,
        "summary": {
            "total_images": total_images_all,
            "total_labels": total_labels_all,
            "total_annotated_instances": total_instances_all,
            "corrupt_images_count": len(corrupt_files),
            "invalid_labels_count": len(invalid_labels),
            "unlabeled_images_count": len(unlabeled_images),
            "empty_label_files_count": len(empty_label_files),
            "cross_split_leakage_pairs_count": len(leakage_records),
            "final_usable_images": total_images_all - len(corrupt_files),
        },
        "per_class_distribution_overall": {
            CLASS_NAMES[k]: {
                "class_id": k,
                "instance_count": per_class_instances_global[k],
                "image_count": per_class_images_global[k],
                "instance_percentage": round((per_class_instances_global[k] / total_instances_all) * 100, 2) if total_instances_all > 0 else 0,
            }
            for k in sorted(CLASS_NAMES.keys())
        },
        "split_breakdown": split_stats,
        "corrupt_files": corrupt_files,
        "invalid_labels": invalid_labels[:50],  # truncated sample if any
        "leakage_records": leakage_records,
    }

    OUTPUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("\n" + "=" * 80)
    print("  VALIDATION SUMMARY REPORT")
    print("=" * 80)
    print(f"Total Images:              {total_images_all}")
    print(f"Total Labels:              {total_labels_all}")
    print(f"Total Bounding Boxes:      {total_instances_all}")
    print(f"Corrupt Images:            {len(corrupt_files)}")
    print(f"Invalid Labels:            {len(invalid_labels)}")
    print(f"Unlabeled Images:          {len(unlabeled_images)}")
    print(f"Cross-Split Leaks:         {len(leakage_records)}")
    print(f"Final Usable Dataset Size: {report['summary']['final_usable_images']}")
    print("-" * 80)
    print(f"{'Class ID':<8} | {'Class Name':<12} | {'Instances':<10} | {'Images':<8} | {'% of Total':<10}")
    print("-" * 80)
    for k in sorted(CLASS_NAMES.keys()):
        cname = CLASS_NAMES[k]
        inst = per_class_instances_global[k]
        imgs = per_class_images_global[k]
        pct = (inst / total_instances_all * 100) if total_instances_all > 0 else 0
        print(f"{k:<8} | {cname:<12} | {inst:<10} | {imgs:<8} | {pct:<9.2f}%")
    print("=" * 80)
    print(f"Report saved to: {OUTPUT_REPORT}")
    return report


if __name__ == "__main__":
    validate_ppe_dataset()
