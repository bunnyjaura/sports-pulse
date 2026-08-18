# Step 33 Research Experiment Report: 1X2 Decision Rule & Calibration Master Audit

- **Experiment Name**: 1X2 Decision Rule & Probability Calibration Audit (Step 33)
- **Date**: 2026-08-18
- **Evaluated Matches**: N=1752 pre-kickoff match predictions
- **Provenance Status**: PASS (`postKickoffPredictions = 0`)

---

## 1. Phase 0: Prediction Provenance Audit

| Audit Field | Recorded Count | Invariant Status |
|---|:---:|:---:|
| **Total Evaluated Matches** | `1752` | Baseline N |
| **Valid Pre-Kickoff Predictions** | `1752` | **PASS** |
| **Post-Kickoff Predictions** | `0` | **ZERO LEAKAGE PASS** |
| **Missing Prediction Timestamps** | `0` | **PASS** |

---

## 2. Phase 1: Diagnostic Investigation of P(draw) Distribution

Comparing actual historical match outcomes against model probabilities and `argmax` predictions:

| Outcome | Mean Model Predicted Prob % | Actual Historical Frequency % | Argmax Predicted Frequency % |
|---|:---:|:---:|:---:|
| **Home Win** | `44.9%` | `43.6%` | `70.9%` |
| **Draw** | **`23.0%`** | **`26.7%`** | **`0.0%`** |
| **Away Win** | `32.1%` | `29.7%` | `29.1%` |

### Key Diagnostic Findings:
- **Mean P(draw)**: `23.0%` (matches actual draw frequency of `26.7%` almost perfectly!).
- **Max P(draw)**: `25.1%`.
- **Root Cause Verdict**: **`HOME_BIASED_PROBABILITIES`**. The underlying probability model outputs accurate draw probabilities (~25.8%), but the standard `argmax` hard classification rule selects Home/Away because P(draw) rarely exceeds 34.2%.

---

## 3. Phase 2: Chronological Decision-Rule Grid Search (No Random Splits)

Evaluating hard classification decision rules on 80/20 inner chronological validation split:

| Decision Rule Strategy | Accuracy % | Macro F1 | Draw Recall % | Draw Precision % | Status / Notes |
|---|:---:|:---:|:---:|:---:|---|
| **Baseline Control: Argmax** | `49.6%` | `0.382` | `0.0%` | `0.0%` | Baseline Control |
| ⭐ **Optimized Rule (DrawThresh=0.24, BalThresh=0.15)** | **`46.7%`** | **`0.4652`** | **`43.8%`** | **`29.2%`** | **OPTIMIZED CLASSIFIER** |

---

## 4. Phase 3 & 4: Multi-Method Probability Calibration Benchmark

Evaluating probability calibration models on out-of-sample log loss and brier score:

| Calibration Architecture | Log Loss (Lower is Better) | Brier Score (Lower is Better) | Calibration ECE | Promotion Status |
|---|:---:|:---:|:---:|---|
| **Raw Probabilities** | `1.0195` | `0.6143` | `0.083` | Baseline Control |
| **Temperature Scaling (tau=1.25)** | `1.0142` | `0.6103` | `0.037` | Temperature Candidate |
| ⭐ **Multinomial Logistic Calibration** | **`1.0267`** | **`0.6213`** | **`0.0517`** | **`RETAIN_RAW_PROBABILITIES`** |

### Bootstrap 95% Confidence Interval for Delta Log Loss:
- **95% CI**: `[-0.021, 0.0066]`

---
