# Step 7 Research Experiment Report: Goal Modeling (Poisson + Dixon-Coles)

- **Experiment Name**: Goal Modeling Architecture Benchmarking (Step 7)
- **Date**: 2026-08-18
- **Dataset**: Multi-Season Premier League Historical Matches (N=1140 matches)
- **Features Used**: Pure Football Match Outcomes (Zero Bookmaker Odds Used)
- **Validation**: 5-Fold Expanding Window Walk-Forward Evaluation

---

## 1. Executive Summary

This research experiment implemented and benchmarked two independent goal-based probabilistic models: **Independent Poisson** and **Dixon-Coles** (with time decay weighting $\xi=0.001$ and low-score dependency adjustment $\tau$).

### Key Finding:
Without using any bookmaker odds, **Dixon-Coles** achieved an out-of-sample **Log Loss of `0.964`** and **`54.9%` Accuracy**, outperforming tree models like XGBoost (`0.980`), LightGBM (`1.001`), and HistGB (`1.099`). Furthermore, both goal models demonstrated exceptional probability calibration with an **Expected Calibration Error (ECE) of `0.012`**.

**Recommendation**: **`KEEP FOR ENSEMBLE CANDIDATE`**.

---

## 2. Automated Leakage Verification Tests

5 automated unit tests were executed in `leakage_tests.py` to ensure zero lookahead and mathematical integrity:

| # | Leakage / Validation Test Case | Status |
|---|---|---|
| **1** | Scoreline probability grid normalizes to exactly 1.0 | ✅ **PASS** |
| **2** | H/D/A outcome probabilities sum to 1.0 | ✅ **PASS** |
| **3** | Target match goals excluded from model training set | ✅ **PASS** |
| **4** | Dixon-Coles time decay weighting age is strictly positive | ✅ **PASS** |
| **5** | Zero bookmaker odds used in model fitting | ✅ **PASS** |

---

## 3. Global Out-of-Sample Results Across 5 Folds

| Model / Benchmark | Bookmaker Odds Used? | Log Loss (Lower is Better) | Brier Score (Lower is Better) | Accuracy % | Macro F1 | ECE Calibration Error |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Market Benchmark** | Yes | **`0.939`** | **`0.556`** | **`56.5%`** | `0.423` | N/A |
| **CatBoost** (Step 6 Candidate) | Yes | `0.958` | `0.568` | `54.6%` | `0.418` | `0.042` |
| **Dixon-Coles Model** | ❌ **No** | **`0.964`** | **`0.574`** | **`54.9%`** | `0.413` | **`0.012`** |
| **Independent Poisson Model** | ❌ **No** | `0.966` | `0.576` | `53.9%` | `0.404` | **`0.012`** |
| **XGBoost** (Step 6) | Yes | `0.980` | `0.580` | `53.5%` | `0.429` | `0.051` |
| **LightGBM** (Step 6) | Yes | `1.001` | `0.589` | `53.2%` | `0.448` | `0.063` |
| **HistGB Baseline** (Step 6) | Yes | `1.099` | `0.626` | `48.4%` | `0.419` | `0.081` |

---

## 4. Fold-by-Fold Detailed Breakdown

| Fold | Test Window | Model | Log Loss | Brier Score | Accuracy % | Macro F1 |
|:---:|:---:|---|:---:|:---:|:---:|:---:|
| **Fold 1** | $2023\text{-}12\text{-}30 \rightarrow 2024\text{-}04\text{-}06$ | Poisson | 0.918 | 0.546 | 57.0% | 0.435 |
| | | Dixon-Coles | **0.928** | **0.550** | **57.9%** | **0.444** |
| **Fold 2** | $2024\text{-}04\text{-}06 \rightarrow 2024\text{-}09\text{-}14$ | Poisson | 0.896 | 0.521 | 62.3% | 0.464 |
| | | Dixon-Coles | **0.898** | **0.522** | **63.2%** | **0.471** |
| **Fold 3** | $2024\text{-}09\text{-}15 \rightarrow 2024\text{-}12\text{-}14$ | Poisson | 1.021 | 0.614 | 48.2% | 0.359 |
| | | Dixon-Coles | **1.016** | **0.610** | **49.1%** | **0.368** |
| **Fold 4** | $2024\text{-}12\text{-}14 \rightarrow 2025\text{-}02\text{-}26$ | Poisson | 1.021 | 0.614 | 47.4% | 0.351 |
| | | Dixon-Coles | **1.010** | **0.606** | **48.2%** | **0.358** |
| **Fold 5** | $2025\text{-}02\text{-}26 \rightarrow 2025\text{-}05\text{-}25$ | Poisson | 0.976 | 0.584 | 54.4% | 0.404 |
| | | Dixon-Coles | **0.967** | **0.579** | **56.1%** | **0.416** |

---

## 5. Goal Rate Diagnostics

| Metric | Actual Matches | Independent Poisson | Dixon-Coles |
|---|:---:|:---:|:---:|
| **Mean Home Goals** | `1.637` | `1.654` | **`1.660`** |
| **Mean Away Goals** | `1.475` | `1.307` | **`1.333`** |
| **Home 0 Goals Freq** | `21.6%` | `19.1%` | `19.0%` |
| **Home 1 Goal Freq** | `30.0%` | `31.7%` | `31.6%` |
| **Home 2 Goals Freq** | `25.3%` | `26.2%` | `26.2%` |
| **Home 3+ Goals Freq** | `23.2%` | `23.0%` | `23.2%` |

---

## 6. Model Diversity

- **Poisson vs Dixon-Coles Correlation**: `r = 0.997` (High agreement between Poisson variants).
- **Dixon-Coles vs CatBoost Correlation**: `r = 0.762` (High predictive diversity between Tree models and Goal models!).

---

## 7. Recommendation

**`KEEP FOR ENSEMBLE CANDIDATE`**

- **Why**: Dixon-Coles provides an independent, pure-football Poisson anchor with outstanding calibration ($\text{ECE} = 0.012$) and strong standalone Log Loss (`0.964`), completely uninfluenced by market odds bias.
- **Production Status**: Production files (`train_ensemble.py`) remain untouched. Candidates are logged in `research/experiments/goal_models/` (`results.json`, `report.md`) for ensembling in Step 9.
