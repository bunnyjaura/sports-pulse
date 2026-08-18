# Step 9 Research Experiment Report: Probability Ensemble

- **Experiment Name**: Out-of-Sample Probability Ensemble Experiment (Step 9)
- **Date**: 2026-08-18
- **Dataset**: Multi-Season Premier League Historical Matches (N=1140 matches)
- **Validation**: 5-Fold Expanding Window Walk-Forward Evaluation
- **Weight Optimization**: Expanding historical out-of-sample log-loss constrained optimization ($\sum w_k = 1, w_k \ge 0$).

---

## 1. Standalone Base Models

| Model Candidate | Out-of-Sample Log Loss (Lower is Better) | Brier Score (Lower is Better) | ECE Calibration Error | Accuracy % | Macro F1 | Status |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Market Benchmark** | **`0.939`** | **`0.556`** | `0.011` | **`56.5%`** | `0.423` | Market Control |
| **CatBoost Raw** | **`0.958`** | **`0.568`** | `0.014` | `54.6%` | `0.418` | Base Candidate |
| **Dixon-Coles Raw** | **`0.964`** | **`0.574`** | `0.012` | `54.9%` | `0.413` | Base Candidate |
| **XGBoost Raw** | `0.980` | `0.580` | `0.024` | `53.5%` | `0.429` | Base Candidate |
| **LightGBM + Platt** | `0.992` | `0.589` | **`0.006`** | `53.3%` | `0.397` | Base Candidate |

---

## 2. Fixed Ensembles

| Ensemble Combination | Out-of-Sample Log Loss | Brier Score | ECE Calibration Error | Accuracy % | Macro F1 | Result vs Standalone |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **CatBoost (50%) + Dixon-Coles (50%)** | **`0.954`** | **`0.565`** | `0.013` | `54.7%` | `0.408` | ⭐ **Beats Standalone CatBoost & DC** |
| **CatBoost (33.3%) + DC (33.3%) + XGBoost (33.3%)** | `0.956` | `0.567` | `0.014` | `54.6%` | `0.414` | Strong Football Trio |
| **Equal-Weight 4-Model Football** | `0.961` | `0.570` | `0.011` | `54.6%` | `0.414` | 4-Model Baseline |
| **Market (50%) + CatBoost (50%)** | `0.946` | `0.560` | `0.014` | `55.4%` | `0.413` | Worse than Pure Market |
| **Market (50%) + Dixon-Coles (50%)** | `0.946` | `0.561` | `0.009` | `55.4%` | `0.415` | Worse than Pure Market |
| **Market (33.3%) + CatBoost (33.3%) + DC (33.3%)** | `0.947` | `0.561` | `0.012` | `55.3%` | `0.413` | Worse than Pure Market |

---

## 3. Expanding Window Optimized Ensembles

| Optimized Ensemble | Weights (Expanding Folds Avg) | Out-of-Sample Log Loss | Brier Score | ECE Calibration Error | Accuracy % | Macro F1 |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Optimized Football-Only** | $45\%$ CatBoost, $40\%$ DC, $10\%$ XGB, $5\%$ LGB | `0.958` | `0.568` | **`0.004`** | `54.7%` | `0.416` |
| **Optimized Market + Football** | $83\%$ Market, $11\%$ DC, $6\%$ CatBoost | `0.943` | `0.558` | `0.011` | `56.5%` | `0.424` |

---

## 4. Fold-by-Fold Detailed Breakdown

| Fold | Test Window | Model / Ensemble | Log Loss | Brier Score | ECE | Accuracy % |
|:---:|:---:|---|:---:|:---:|:---:|:---:|
| **Fold 1** | $2023\text{-}12\text{-}30 \rightarrow 2024\text{-}04\text{-}06$ | Market | 0.885 | 0.517 | 0.027 | 59.6% |
| | | CatBoost | 0.913 | 0.535 | 0.020 | 60.5% |
| | | Dixon-Coles | 0.928 | 0.550 | 0.009 | 57.9% |
| | | **CatBoost + DC (50/50)** | **0.913** | **0.536** | **0.048** | **57.9%** |
| | | Market + CatBoost + DC | 0.902 | 0.528 | 0.034 | 58.8% |
| **Fold 2** | $2024\text{-}04\text{-}06 \rightarrow 2024\text{-}09\text{-}14$ | Market | 0.877 | 0.508 | 0.047 | 63.2% |
| | | CatBoost | 0.906 | 0.526 | 0.020 | 60.5% |
| | | Dixon-Coles | 0.898 | 0.522 | 0.046 | 63.2% |
| | | **CatBoost + DC (50/50)** | **0.894** | **0.518** | **0.025** | **60.5%** |
| | | Market + CatBoost + DC | 0.886 | 0.514 | 0.038 | 62.3% |
| **Fold 3** | $2024\text{-}09\text{-}15 \rightarrow 2024\text{-}12\text{-}14$ | Market | 0.988 | 0.590 | 0.014 | 49.1% |
| | | CatBoost | 0.998 | 0.598 | 0.051 | 45.6% |
| | | Dixon-Coles | 1.016 | 0.610 | 0.033 | 49.1% |
| | | **CatBoost + DC (50/50)** | **1.000** | **0.598** | **0.027** | **48.2%** |
| | | Market + CatBoost + DC | 0.994 | 0.595 | 0.015 | 47.4% |
| **Fold 4** | $2024\text{-}12\text{-}14 \rightarrow 2025\text{-}02\text{-}26$ | Market | 0.998 | 0.599 | 0.037 | 50.9% |
| | | CatBoost | 1.028 | 0.618 | 0.058 | 50.9% |
| | | Dixon-Coles | 1.010 | 0.606 | 0.049 | 48.2% |
| | | **CatBoost + DC (50/50)** | **1.013** | **0.608** | **0.046** | **50.0%** |
| | | Market + CatBoost + DC | 1.007 | 0.605 | 0.050 | 50.9% |
| **Fold 5** | $2025\text{-}02\text{-}26 \rightarrow 2025\text{-}05\text{-}25$ | Market | 0.948 | 0.563 | 0.024 | 59.6% |
| | | CatBoost | 0.946 | 0.561 | 0.017 | 55.3% |
| | | Dixon-Coles | 0.967 | 0.579 | 0.016 | 56.1% |
| | | **CatBoost + DC (50/50)** | **0.948** | **0.565** | **0.014** | **57.0%** |
| | | Market + CatBoost + DC | 0.947 | 0.563 | 0.026 | 57.0% |

---

## 5. Model Error Correlations ($P(\text{Home})$ Predictions)

| Model Pair | Correlation ($r$) | Diversity Interpretation |
|---|:---:|---|
| **CatBoost vs Dixon-Coles** | **`0.882`** | High complementary diversity (Tree Model vs Goal Model) |
| **CatBoost vs Market** | `0.976` | Strong market alignment |
| **Dixon-Coles vs Market** | `0.897` | Moderate market alignment |
| **XGBoost vs LightGBM** | `0.951` | Redundant tree representations |

---

## 6. Synthesis & Final Questions

- **BEST STANDALONE**: **CatBoost Raw** (Log Loss: `0.958`, Brier: `0.568`)
- **BEST FOOTBALL-ONLY ENSEMBLE**: **CatBoost (50%) + Dixon-Coles (50%)** (Log Loss: **`0.954`**, Brier: **`0.565`**)
- **BEST MARKET+FOOTBALL ENSEMBLE**: **Optimized Market + Football** (Log Loss: `0.943`, Brier: `0.558`)
- **BEST GLOBAL LOG LOSS**: **Market Benchmark (`0.939`)**
- **BEST GLOBAL BRIER**: **Market Benchmark (`0.556`)**
- **MOST STABLE ENSEMBLE**: **CatBoost + Dixon-Coles (50/50)** (Fold Log Loss: $0.954 \pm 0.047$)
- **OPTIMIZED WEIGHTS**: $45\%$ CatBoost, $40\%$ Dixon-Coles, $10\%$ XGBoost, $5\%$ LightGBM
- **DOES FOOTBALL ADD INFORMATION BEYOND MARKET?**: **NO** (Combining football models with market odds yields Log Loss `0.943` vs pure market odds `0.939`).

---

## 7. Recommendation (Rule 26)

**`KEEP FOR NEXT STAGE`**

- **Ensemble Candidate**: **CatBoost (50%) + Dixon-Coles (50%)** is the **#1 Football-Only Model Engine** with out-of-sample **Log Loss `0.954`** and **Brier Score `0.565`**, outperforming every single standalone ML and Poisson model tested.
- **Production Status**: Production files (`train_ensemble.py`) remain untouched. Results are archived in `research/experiments/ensemble/` (`leakage_tests.py`, `ensemble_optimizer.py`, `evaluation.py`, `run_experiment.py`, `results.json`, `report.md`).
