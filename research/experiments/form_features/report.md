# Research Experiment Report: Dynamic Rolling Form Features

- **Experiment Name**: Dynamic Rolling Form Features Isolation Experiment
- **Date**: 2026-08-18
- **Dataset**: Premier League Historical Matches (2022-2025, N=1140 matches)
- **Validation**: 5-Fold Expanding Window Walk-Forward Evaluation
- **Target Model**: `HistGradientBoostingClassifier(max_iter=100, max_depth=4, random_state=42)`

---

## 1. Executive Summary

This research experiment isolated the predictive impact of dynamically calculated historical rolling form features (global form over 3, 5, 10 matches and home/away venue-specific form over 5 matches) when added to the production baseline (`EloDiff` + Bookmaker Odds).

### Key Finding:
Adding raw rolling form features degraded both **Log Loss** and **Brier Score** across out-of-sample walk-forward folds due to tree dimensionality expansion and probability overconfidence.

- **Baseline Log Loss**: `1.099` | **Experiment A Log Loss**: `1.221` (+0.122 degradation)
- **Baseline Brier Score**: `0.626` | **Experiment A Brier Score**: `0.694` (+0.068 degradation)

**Recommendation**: **REJECT**. Do NOT promote these raw rolling form features to the production pipeline without prior feature selection, dimensionality reduction, or probability calibration.

---

## 2. Automated Leakage Verification Tests

7 automated unit tests were executed in `test_leakage.py` to ensure mathematical and chronological rigor:

| # | Leakage Test Case | Status |
|---|---|---|
| **1** | Current match is excluded from rolling history | ✅ **PASS** |
| **2** | Future matches beyond target date are excluded | ✅ **PASS** |
| **3** | Rolling windows use exact chronological order | ✅ **PASS** |
| **4** | Home-form history contains only previous home matches | ✅ **PASS** |
| **5** | Away-form history contains only previous away matches | ✅ **PASS** |
| **6** | Match result becomes available only after match finishes | ✅ **PASS** |
| **7** | Fold test data never influences training features | ✅ **PASS** |

---

## 3. Experiment A — Baseline vs. Rolling Global Form

- **Baseline Features**: `['EloDiff', 'B365H', 'B365D', 'B365A']`
- **Experiment A Features**: Baseline + 36 Rolling Global Form & Difference Features (Points, Goals Scored, Goals Conceded, Goal Difference across 3, 5, 10 match windows).

### Fold-by-Fold Results (Experiment A)

| Fold | Baseline LogLoss | Exp A LogLoss | Baseline Brier | Exp A Brier | Baseline Acc % | Exp A Acc % | Baseline Macro F1 | Exp A Macro F1 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Fold 1** | **0.973** | 1.216 | **0.574** | 0.693 | **53.5%** | 48.2% | **0.464** | 0.389 |
| **Fold 2** | **1.245** | 1.291 | **0.654** | 0.702 | **43.9%** | 43.9% | 0.371 | **0.378** |
| **Fold 3** | **1.061** | 1.314 | **0.631** | 0.748 | **48.2%** | 43.0% | **0.393** | 0.339 |
| **Fold 4** | **1.098** | 1.202 | **0.644** | 0.686 | **44.7%** | 43.0% | **0.408** | 0.364 |
| **Fold 5** | 1.119 | **1.083** | **0.628** | 0.643 | **51.8%** | 43.9% | **0.454** | 0.354 |

---

## 4. Experiment B — Rolling Global Form vs. Rolling Global + Venue Form

- **Experiment B Features**: Experiment A + 6 Venue Form Features (`h_pts_home_5`, `h_gf_home_5`, `h_ga_home_5`, `a_pts_away_5`, `a_gf_away_5`, `a_ga_away_5`).

### Fold-by-Fold Results (Experiment B)

| Fold | Exp A LogLoss | Exp B LogLoss | Exp A Brier | Exp B Brier | Exp A Acc % | Exp B Acc % | Exp A Macro F1 | Exp B Macro F1 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Fold 1** | **1.216** | 1.238 | **0.693** | 0.722 | **48.2%** | 48.2% | **0.389** | 0.382 |
| **Fold 2** | **1.291** | 1.329 | **0.702** | 0.741 | 43.9% | **44.7%** | 0.378 | **0.381** |
| **Fold 3** | 1.314 | **1.299** | **0.748** | 0.749 | **43.0%** | 43.0% | 0.339 | **0.344** |
| **Fold 4** | **1.202** | 1.283 | **0.686** | 0.728 | **43.0%** | 43.0% | **0.364** | 0.364 |
| **Fold 5** | 1.083 | **1.075** | 0.643 | **0.637** | 43.9% | **46.5%** | 0.354 | **0.399** |

---

## 5. Global Out-of-Sample Results (Combined Predictions)

| Configuration | Log Loss (Lower is Better) | Brier Score (Lower is Better) | Accuracy % | Macro F1 | Decision |
|---|---|---|---|---|---|
| **Baseline** | **`1.099`** | **`0.626`** | **`48.4%`** | **`0.419`** | **Reference** |
| **Experiment A (Global Form)** | `1.221` | `0.694` | `44.4%` | `0.368` | ❌ **Degraded** |
| **Experiment B (Venue Form)** | `1.245` | `0.715` | `45.1%` | `0.378` | ❌ **Degraded** |

---

## 6. Fold Stability & Analysis

- Across 4 out of 5 folds, adding global rolling form features increased out-of-sample Log Loss and Brier Score.
- Adding venue-specific form features further increased Log Loss from `1.221` to `1.245`.
- **Root Cause**: `HistGradientBoostingClassifier` split criteria overfit to noise in raw rolling goals/points counts on small match histories without probability calibration.

---

## 7. Recommendation

**REJECT**. Do NOT modify production files (`train_ensemble.py`). The production baseline (`EloDiff` + Bookmaker Odds) remains superior in out-of-sample Log Loss and Brier Score.
