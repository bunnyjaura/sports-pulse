# Step 6 Research Experiment Report: Model Benchmarking

- **Experiment Name**: Gradient Boosting Architecture Benchmarking (Step 6)
- **Date**: 2026-08-18
- **Dataset**: Multi-Season Premier League Historical Matches (N=1140 matches)
- **Features Used**: `['EloDiff', 'B365H', 'B365D', 'B365A']`
- **Validation**: 5-Fold Expanding Window Walk-Forward Evaluation

---

## 1. Global Out-of-Sample Benchmark Summary

| Model / Benchmark | Status | Out-of-Sample Log Loss (Lower is Better) | Brier Score (Lower is Better) | Out-of-Sample Accuracy % | Macro F1 | Fold Log Loss Std Dev |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Market Benchmark** *(Normalized Bookie Odds)* | `AVAILABLE` | **`0.939`** | **`0.556`** | **`56.5%`** | `0.423` | `±0.050` |
| **Model D — CatBoost** | `AVAILABLE` | **`0.958`** | **`0.568`** | **`54.6%`** | `0.418` | `±0.048` |
| **Model C — XGBoost** | `AVAILABLE` | **`0.980`** | **`0.580`** | **`53.5%`** | `0.429` | **`±0.036`** |
| **Model B — LightGBM** | `AVAILABLE` | **`1.001`** | **`0.589`** | **`53.2%`** | **`0.448`** | `±0.047` |
| **Model A — HistGB** *(Production Control)* | `AVAILABLE` | `1.099` | `0.626` | `48.4%` | `0.419` | `±0.088` |

---

## 2. Fold-by-Fold Detailed Breakdown

| Fold | Test Window | Model / Benchmark | Log Loss | Brier Score | Accuracy % | Macro F1 |
|:---:|:---:|---|:---:|:---:|:---:|:---:|
| **Fold 1** | $2023\text{-}12\text{-}30 \rightarrow 2024\text{-}04\text{-}06$ | Market | 0.885 | 0.517 | 59.6% | 0.452 |
| | | HistGB | 0.973 | 0.574 | 53.5% | 0.464 |
| | | LightGBM | 0.926 | 0.540 | 60.5% | 0.531 |
| | | XGBoost | 0.927 | 0.545 | 58.8% | 0.492 |
| | | CatBoost | **0.913** | **0.535** | **60.5%** | **0.493** |
| **Fold 2** | $2024\text{-}04\text{-}06 \rightarrow 2024\text{-}09\text{-}14$ | Market | 0.877 | 0.508 | 63.2% | 0.470 |
| | | HistGB | 1.245 | 0.654 | 43.9% | 0.371 |
| | | LightGBM | 1.009 | 0.579 | 54.4% | 0.458 |
| | | XGBoost | 0.969 | 0.560 | 57.9% | 0.465 |
| | | CatBoost | **0.906** | **0.526** | **60.5%** | **0.448** |
| **Fold 3** | $2024\text{-}09\text{-}15 \rightarrow 2024\text{-}12\text{-}14$ | Market | 0.988 | 0.590 | 49.1% | 0.364 |
| | | HistGB | 1.061 | 0.631 | 48.2% | 0.393 |
| | | LightGBM | 1.006 | 0.608 | 47.4% | 0.401 |
| | | XGBoost | **0.993** | 0.602 | 45.6% | 0.344 |
| | | CatBoost | 0.998 | **0.598** | **45.6%** | **0.342** |
| **Fold 4** | $2024\text{-}12\text{-}14 \rightarrow 2025\text{-}02\text{-}26$ | Market | 0.998 | 0.599 | 50.9% | 0.377 |
| | | HistGB | 1.098 | 0.644 | 44.7% | 0.408 |
| | | LightGBM | 1.074 | 0.638 | 46.5% | 0.370 |
| | | XGBoost | 1.038 | 0.621 | 50.0% | 0.396 |
| | | CatBoost | **1.028** | **0.618** | **50.9%** | **0.380** |
| **Fold 5** | $2025\text{-}02\text{-}26 \rightarrow 2025\text{-}05\text{-}25$ | Market | 0.948 | 0.563 | 59.6% | 0.442 |
| | | HistGB | 1.119 | 0.628 | 51.8% | 0.454 |
| | | LightGBM | 0.991 | 0.579 | 57.0% | 0.477 |
| | | XGBoost | 0.972 | 0.574 | 55.3% | 0.441 |
| | | CatBoost | **0.946** | **0.561** | **55.3%** | **0.406** |

---

## 3. Model Stability & Error Correlation Matrix

### Model Stability Across Folds:
- **XGBoost**: Most stable overall (`mean Log Loss 0.980 ± 0.036`).
- **CatBoost**: Best overall Log Loss (`mean Log Loss 0.958 ± 0.048`).
- **LightGBM**: Strong performance (`mean Log Loss 1.001 ± 0.047`).
- **HistGB**: Least stable (`mean Log Loss 1.099 ± 0.088`).

### Full Error Correlation Matrix ($P(\text{Home})$ Predictions):
| Model | Market | HistGB | LightGBM | XGBoost | CatBoost |
|---|:---:|:---:|:---:|:---:|:---:|
| **Market** | 1.000 | 0.774 | 0.891 | 0.923 | 0.976 |
| **HistGB** | 0.774 | 1.000 | 0.922 | 0.915 | 0.817 |
| **LightGBM** | 0.891 | 0.922 | 1.000 | 0.983 | 0.931 |
| **XGBoost** | 0.923 | 0.915 | 0.983 | 1.000 | 0.960 |
| **CatBoost** | 0.976 | 0.817 | 0.931 | 0.960 | 1.000 |

---

## 4. Key Findings

1. **ALL 3 Alternative Tree Architectures Beat Existing HistGB Baseline**:
   - **CatBoost**: `0.958` Log Loss ($12.8\%$ improvement) | `0.568` Brier | `54.6%` Accuracy.
   - **XGBoost**: `0.980` Log Loss ($10.8\%$ improvement) | `0.580` Brier | `53.5%` Accuracy.
   - **LightGBM**: `1.001` Log Loss ($8.9\%$ improvement) | `0.589` Brier | `53.2%` Accuracy.
   - **HistGB (Control)**: `1.099` Log Loss | `0.626` Brier | `48.4%` Accuracy.
2. **Complementary Model Diversity**:
   - High correlation between XGBoost and LightGBM (`r = 0.983`).
   - Strong diversity between HistGB and CatBoost (`r = 0.817`) and LightGBM (`r = 0.922`), providing an ideal foundation for probability ensembling in Step 9.

---

## 5. Recommendation

**`CANDIDATE FOR FURTHER VALIDATION`**

- **CatBoost**, **XGBoost**, and **LightGBM** all outperform `HistGradientBoostingClassifier` across the walk-forward folds.
- **Production Status**: In strict adherence to Rule 19, **no changes were made to production files (`train_ensemble.py`)**. The production pipeline remains untouched until formal promotion in later steps.
