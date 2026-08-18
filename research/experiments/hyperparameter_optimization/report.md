# Step 12 Research Experiment Report: Hyperparameter Optimization

- **Experiment Name**: Hyperparameter Optimization with Strict Walk-Forward Validation (Step 12)
- **Date**: 2026-08-18
- **Dataset**: Multi-Season Premier League Historical Matches (N=1140 matches)
- **Validation**: 5-Fold Nested Expanding Window Walk-Forward Evaluation
- **Baseline Engine**: CatBoost + Dixon-Coles 50/50 Ensemble (Default Hyperparameters)

---

## 1. Leakage Test Verification

- **Outer test never influences hyperparameter selection**: PASSED
- **Inner-validation selection strictly pre-kickoff**: PASSED
- **Time decay uses historical age relative to cutoff**: PASSED
- **Selected hyperparameters frozen before outer test**: PASSED
- **Deterministic results with fixed random seeds**: PASSED

---

## 2. Search Space & Candidate Configurations

- **CatBoost Search Space**:
  - `depth`: [3, 4, 5, 6]
  - `learning_rate`: [0.01, 0.03, 0.05, 0.08]
  - `iterations`: [150, 200, 300]
  - `l2_leaf_reg`: [3, 5, 10]
- **Dixon-Coles Time Decay Search Space**:
  - `xi`: [0.0, 0.0005, 0.001, 0.002, 0.005]
- **Ensemble Blend Weight Search Space**:
  - `w_cb`: [0.25, 0.40, 0.50, 0.60, 0.75]

---

## 3. Best Configurations & Metrics Per Outer Fold

| Fold | Inner Val CatBoost Loss | Inner Val Dixon-Coles Loss | Selected CatBoost Params | Selected DC $\xi$ | Selected Blend Weight ($w_{\text{CB}}$) | Outer Test Baseline Log Loss | Outer Test Optimized Log Loss | Outer Test Brier Score |
|:---:|:---:|:---:|---|:---:|:---:|:---:|:---:|:---:|
| **Fold 1** | 1.0101 | 1.0308 | `depth=5, lr=0.01, iters=150, l2=5` | 0.0005 | 0.50 | **0.943** | 0.946 | 0.558 |
| **Fold 2** | 0.9990 | 1.0103 | `depth=5, lr=0.01, iters=300, l2=3` | 0.0000 | 0.60 | **0.902** | 0.906 | 0.528 |
| **Fold 3** | 0.9644 | 0.9238 | `depth=3, lr=0.03, iters=200, l2=3` | 0.0000 | 0.25 | **1.014** | 1.017 | 0.611 |
| **Fold 4** | 0.9724 | 0.9734 | `depth=3, lr=0.03, iters=200, l2=3` | 0.0020 | 0.50 | 1.007 | **1.004** | 0.602 |
| **Fold 5** | 0.9781 | 0.9928 | `depth=3, lr=0.03, iters=200, l2=3` | 0.0050 | 0.75 | **0.962** | 0.965 | 0.575 |

---

## 4. Global Out-of-Sample Performance Summary

| Architecture / Engine | Out-of-Sample Log Loss (Lower is Better) | Brier Score (Lower is Better) | ECE Calibration Error | Accuracy % | Macro F1 | Fold Log Loss Std Dev | Paired Bootstrap 95% CI vs Baseline | Result |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Baseline Engine (Default Params)** | **`0.965`** | **`0.574`** | `0.023` | **`53.9%`** | `0.403` | `±0.042` | `[0.000, 0.000]` | **Baseline** |
| **Optimized Engine (Nested Tuning)** | `0.967` | `0.575` | **`0.012`** | `53.7%` | `0.400` | **`±0.040`** | `[-0.0074, +0.0037]` | Degraded |

---

## 5. Synthesis & Diagnosis of Hyperparameter Overfitting

1. **Inner Validation Instability**:
   - Hyperparameter tuning on small inner validation splits ($N \approx 170$) produced parameter instability across folds (CatBoost depth switching between 3 and 5; Dixon-Coles $\xi$ shifting between 0.0 and 0.005; blend weight $w_{\text{CB}}$ oscillating between 0.25 and 0.75).
2. **Out-of-Sample Degradation**:
   - Fitting these fluctuating inner-validation parameters on the full outer training sets degraded out-of-sample Log Loss on 4 out of 5 test folds (`0.967` vs `0.965`).
3. **Statistical Significance**:
   - The paired 1000-sample bootstrap 95% confidence interval spans zero (`[-0.0074, +0.0037]`), with a $26.7\%$ probability of beating the baseline.
4. **Mandatory Rule Compliance**:
   - Under the mandatory experiment rules, hyperparameter optimization must be **REJECTED** in favor of keeping the robust, default baseline configuration.

---

## 6. Final Decision & Required Summary Output

BEST CATBOOST CONFIGURATION:
depth=4, learning_rate=0.03, iterations=200, l2_leaf_reg=5 (Default Baseline)

BEST DIXON-COLES CONFIGURATION:
xi=0.001 (Default Baseline)

BEST ENSEMBLE WEIGHT:
50% CatBoost + 50% Dixon-Coles (Default Baseline)

BASELINE OOS LOG LOSS / BRIER:
Log Loss = 0.965, Brier = 0.574

OPTIMIZED OOS LOG LOSS / BRIER:
Log Loss = 0.967, Brier = 0.575

CALIBRATION CHANGE:
ECE improved slightly from 0.023 to 0.012

FOLD STABILITY:
Std Dev Log Loss = ±0.040 across 5 walk-forward folds

BOOTSTRAP CI:
[-0.0074, +0.0037] (Spans zero)

WHETHER OPTIMIZATION IS STATISTICALLY CONVINCING:
NO

RECOMMENDATION:
REJECT OPTIMIZATION AND KEEP EXISTING CATBOOST + DIXON-COLES BASELINE UNCHANGED

PRODUCTION FILES MODIFIED:
NONE
