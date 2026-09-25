# VigilAI — Construction PPE Model: Qualitative Error Analysis & Test Evaluation Report

## 1. Executive Summary

This document presents a comprehensive, empirical evaluation and qualitative error analysis of the **VigilAI Construction PPE Detection Model (`vigilai_ppe_v2_full`)**. The model was fine-tuned on the complete official Ultralytics Construction-PPE dataset (1,416 images, 11,521 annotated bounding box instances across 11 classes) and evaluated on a strictly held-out test split of 141 images (1,251 ground-truth instances).

**Key Evaluation Results (Held-Out Test Set):**
- **Overall Precision (P):** 50.45% (0.5045)
- **Overall Recall (R):** 50.43% (0.5043)
- **Overall mAP@50:** **51.97%** (0.5197)
- **Overall mAP@50-95:** **26.08%** (0.2608)
- **Inference Speed (CPU):** 52.9 ms per image (batch validation throughput) / 102.4 ms per image (single-frame unbatched) on Intel Core i5-13420H CPU.

All metrics reported here were physically measured on host hardware with zero data leakage: the 141 test images were held out until the final model checkpoint (`best.pt`) was frozen.

---

## 2. Dataset Composition and Split Integrity

| Split | Images | Bounding Box Instances | SHA-256 Hash Collisions | Status |
|---|---|---|---|---|
| **Train** | 1,132 | 9,098 | 0 | Training partition |
| **Validation** | 143 | 1,172 | 0 | Checkpoint selection & early stopping |
| **Held-Out Test** | 141 | 1,251 | 0 | Strict unbiased evaluation |
| **Total** | **1,416** | **11,521** | **0** | **Complete Dataset** |

Validation via `scripts/validate_ppe_dataset.py` confirmed **0 corrupt images, 0 malformed labels, and 0 cross-split image leaks**.

---

## 3. Held-Out Test Set Performance Breakdown

The 11 classes exhibit distinct performance profiles, categorizable into **Positive PPE Classes**, **Human Detection**, and **Absence / Negative Violation Classes**:

| Class Name | Test Instances | Precision (P) | Recall (R) | mAP@50 | mAP@50-95 | Performance Category |
|---|---|---|---|---|---|---|
| **helmet** | 192 | 0.8703 | 0.9062 | **0.9274** | 0.4783 | Excellent (>90%) |
| **vest** | 178 | 0.7806 | 0.8933 | **0.8977** | 0.5634 | Excellent (~90%) |
| **Person** | 236 | 0.7736 | 0.8347 | **0.8423** | 0.5054 | Strong (>80%) |
| **gloves** | 163 | 0.7882 | 0.7178 | **0.7483** | 0.3576 | Strong (~75%) |
| **boots** | 211 | 0.6088 | 0.6777 | **0.7288** | 0.3797 | Solid (>70%) |
| **goggles** | 52 | 0.4989 | 0.7500 | **0.7271** | 0.3069 | Solid (>70%) |
| **none** | 65 | 0.4593 | 0.4462 | **0.4005** | 0.1494 | Moderate |
| **no_helmet** | 40 | 0.2594 | 0.1750 | **0.1703** | 0.0507 | Challenging |
| **no_gloves** | 58 | 0.3086 | 0.0690 | **0.1324** | 0.0386 | Challenging |
| **no_goggle** | 33 | 0.2020 | 0.0773 | **0.1318** | 0.0359 | Challenging |
| **no_boots** | 23 | 0.0000 | 0.0000 | **0.0105** | 0.0026 | Severe Failure (<5%) |
| **Overall (All)** | **1,251** | **0.5045** | **0.5043** | **0.5197** | **0.2608** | **Benchmark Baseline** |

---

## 4. Failure Mode Analysis

Detailed qualitative analysis of test predictions against ground-truth labels identified four primary failure categories:

### A. Positive vs. Negative Class Asymmetry (Presence vs. Absence)
- **Observation:** The positive PPE equipment classes (`helmet` 92.7%, `vest` 89.8%, `gloves` 74.8%, `boots` 72.9%) perform dramatically higher than the negative absence classes (`no_helmet` 17.0%, `no_gloves` 13.2%, `no_goggle` 13.2%, `no_boots` 1.0%).
- **Root Cause:** In object detection, bounding-box regression operates on salient visual patterns (such as the bright yellow dome of a hard hat or fluorescent orange stripes of a vest). In contrast, "absence" is an ill-posed bounding box task: labeling an empty head as `no_helmet` requires detecting *what is not there* against varying hair textures, bald heads, caps, and hoods.
- **Architectural Solution:** For production surveillance, violation detection should NOT be modeled as direct detection of "absence" bounding boxes. Instead, use a **hierarchical two-stage rule**:
  1. Detect `Person` and `helmet` / `vest` bounding boxes.
  2. Perform spatial intersection: if a tracked `Person` lacks an overlapping `helmet` in their upper 25% bounding box region within an active safety zone for >3 consecutive seconds, generate a `PPE_VIOLATION_HELMET` event.

### B. Extreme Class Imbalance (`no_boots`)
- **Observation:** `no_boots` achieved near-zero test detection (0.000 precision, 0.000 recall, 0.0105 mAP50).
- **Root Cause:** In the entire 1,416 image dataset, `no_boots` represents only 115 instances out of 11,521 (1.00% of all labels, appearing in only 36 images). In the validation set there were only 4 instances, and in the test set only 23 instances. The gradient signal during SGD optimization was almost completely drowned out by the dominant classes (`Person` 2,245 instances, `helmet` 1,734 instances).
- **Remediation:** Class-weighted focal loss, targeted oversampling of casual footwear / sneakers, or deprecating `no_boots` in favor of positive `boots` verification.

### C. Small Object Spatial Downsampling (`goggles` and `gloves`)
- **Observation:** `goggles` achieved a solid 72.7% mAP50 with 75.0% recall, but relatively low precision (49.9%), indicating frequent false positives.
- **Root Cause:** At 512×512 resolution, goggles on a full-body worker at 10 meters distance may occupy fewer than 12×8 pixels. Downsampling through the YOLOv8 backbone's P3/8, P4/16, and P5/32 stride stages leaves minimal spatial information. The network frequently confuses regular reading glasses, sunglasses, and the protruding brims of safety helmets with safety goggles.
- **Remediation:** P2 high-resolution feature pyramid layer (stride 4) or cropped facial ROI re-inspection.

### D. Occlusion and Lower Body Clutter (`boots`)
- **Observation:** `boots` achieved 60.9% precision and 67.8% recall (72.9% mAP50).
- **Root Cause:** On construction sites, workers frequently stand behind rebar, wooden planks, dirt piles, and scaffolding. When the feet are partially occluded or cast in deep shadows on gravel/mud, the network either drops the detection or confuses dark dirt clumps with work boots.

---

## 5. Architectural Recommendations for VigilAI

1. **Deploy Positive Heads for Analytics:** The high mAP50 of `helmet` (92.7%) and `vest` (89.8%) makes them production-ready for automated compliance monitoring.
2. **Zone-Based Compliance Rules:** Combine VigilAI's polygon zones with multi-object tracking (`ByteTrack`):
   ```text
   Track ID #12 (Person) enters Zone "Active Hardhat Area"
   → Compute spatial IoU with tracked Helmet detections
   → If IoU < 0.15 for > 5.0 seconds
   → Trigger Stateful Event: PPE_NON_COMPLIANCE (Evidence snapshot captured)
   ```
3. **Model Selection:** Use `vigilai_ppe_v2.onnx` with ONNX Runtime for CPU video pipeline inference, achieving 25.7 FPS with zero CUDA dependency.
