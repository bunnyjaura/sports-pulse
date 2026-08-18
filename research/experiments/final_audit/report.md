# Step 13 Research Experiment & Audit Report: Final Probability Engine & Production Readiness

- **Experiment / Audit Name**: Final Probability Engine + Production Readiness Audit (Step 13)
- **Date**: 2026-08-18
- **Model Version**: `football-ensemble-v1`
- **Validated Architecture**: CatBoost (50%) + Dixon-Coles (50%) Ensemble Engine
- **Dataset**: Multi-Season Premier League Historical Matches (N=1140 matches)
- **Validation Protocol**: 5-Fold Expanding Window Walk-Forward Evaluation

---

## 1. Complete Architecture Audit

- **Core Engine**:
  $$\text{P}_{\text{final}} = 0.50 \times \text{P}_{\text{CatBoost}} + 0.50 \times \text{P}_{\text{DixonColes}}$$
- **CatBoost Classifier**:
  - `iterations=200, depth=4, learning_rate=0.03, l2_leaf_reg=5, random_seed=42`
  - Input Feature: Pre-match `EloDiff`
- **Dixon-Coles Model**:
  - `xi=0.001` (Time-decay weighted Poisson scoreline matrix)
  - Home advantage parameter $\gamma \approx 0.23$

---

## 2. Audit Suite Verification

- **Leakage Audit (`leakage_tests.py`)**: **PASS** (Zero future data leakage, pre-kickoff information rule strictly enforced).
- **Probability Audit (`probability_tests.py`)**: **PASS** ($0 \le P \le 1, \sum P = 1.0$, class order `[0, 1, 2] -> [Home, Draw, Away]` explicitly mapped, zero NaN/Inf).
- **Reproducibility Audit (`reproducibility_tests.py`)**: **PASS** (Model version `football-ensemble-v1` yields $100\%$ deterministic output across re-runs).

---

## 3. Global Out-of-Sample Benchmark Comparison across 5 Walk-Forward Folds

| Model / Benchmark | Model Version / Features | Out-of-Sample Log Loss (Lower is Better) | Brier Score (Lower is Better) | ECE Calibration Error | Accuracy % | Macro F1 |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Market Benchmark** | Bookie Closing Odds | **`0.939`** | **`0.556`** | **`0.011`** | **`56.5%`** | `0.423` |
| **Approved Football Ensemble** | **`football-ensemble-v1`** | **`0.965`** | **`0.574`** | `0.023` | `53.9%` | `0.401` |
| **Dixon-Coles Alone** | Goal-based Model | `0.964` | `0.574` | `0.012` | `54.9%` | `0.413` |
| **CatBoost Alone** | Tree ML Model | `0.982` | `0.584` | `0.026` | `54.0%` | `0.403` |
| **Historical Class Frequency** | Past Training Prior | `1.077` | `0.653` | `0.050` | `42.3%` | `0.333` |
| **Always Home Baseline** | Naive Home Win | `2.667` | `1.120` | `0.577` | `42.3%` | `0.198` |

---

## 4. Production Readiness & Minimum Integration

- **Audit Checks**: All Leakage, Probability, and Reproducibility tests **PASSED**.
- **Production Status**: **READY**.
- **Production Changes Made**: Minimal update to `train_ensemble.py` to instantiate the validated `football-ensemble-v1` prediction engine (CatBoost 50% + Dixon-Coles 50% Ensemble).

---

## 5. Required Output Summary

FINAL STATUS:
PASS

FOOTBALL-ONLY ENGINE:
CatBoost 50% + Dixon-Coles 50%

FINAL OOS LOG LOSS:
0.965

FINAL OOS BRIER:
0.574

FINAL OOS ECE:
0.023

FINAL OOS ACCURACY:
53.9%

MARKET LOG LOSS:
0.939

LEAKAGE TESTS:
PASS

PROBABILITY TESTS:
PASS

REPRODUCIBILITY:
PASS

PRODUCTION READINESS:
READY
