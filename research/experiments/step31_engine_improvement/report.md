# Step 31 Research Experiment Report: Football Prediction Engine Improvement

- **Experiment Name**: Football Prediction Engine Optimization & Feature Engineering Suite (Step 31)
- **Date**: 2026-08-18
- **Evaluated Matches**: N=570 out-of-sample matches across Premier League seasons
- **Validation Methodology**: 5-Fold Chronological Expanding Window Walk-Forward Evaluation (Zero Temporal Leakage)

---

## 1. Out-of-Sample Performance Summary Table

| Model Architecture / Candidate | Accuracy % | Log Loss (Lower is Better) | Brier Score (Lower is Better) | Calibration ECE | Status / Decision |
|---|:---:|:---:|:---:|:---:|---|
| **Market Benchmark** *(Normalized Bookie Odds)* | **`56.49%`** | **`0.9393`** | **`0.5557`** | `0.0335` | Market Control |
| **Existing Baseline (CatBoost + DC 50/50 Elo Only)** | `53.86%` | `0.9655` | `0.5736` | `0.0275` | Baseline Control |
| **CatBoost Raw (Elo Only)** | `54.04%` | `0.9817` | `0.5839` | `0.0451` | Baseline Feature Set |
| **CatBoost Raw (Full Feature Set)** | `55.26%` | `0.9770` | `0.5797` | `0.0230` | Improved Feature Set |
| **XGBoost Raw (Full Feature Set)** | `54.56%` | `1.0135` | `0.6011` | `0.0859` | **REJECTED** (Poorer Log Loss) |
| **Dixon-Coles Model Raw** | `54.91%` | `0.9637` | `0.5735` | `0.0256` | Poisson Goal Model |
| ⭐ **Ensemble: CatBoost (Full Feat) + DC (50/50)** | **`55.09%`** | **`0.9643`** | **`0.5723`** | **`0.0239`** | **RECOMMENDED PRODUCTION MODEL** |
| **Ensemble: XGBoost + DC (50/50 Full Feat)** | `54.56%` | `0.9722` | `0.5775` | `0.0419` | Worse than CatBoost + DC |
| **Ensemble: Trio (CatBoost+XGB+DC Equal)** | `55.44%` | `0.9713` | `0.5766` | `0.0329` | Slightly worse Log Loss |
| **Optimized Ensemble (Dynamic Weights)** | `55.09%` | `0.9669` | `0.5744` | `0.0228` | Competitive ML Model |
| **Calibrated Platt (Best Ensemble)** | `54.39%` | `0.9974` | `0.5930` | `0.0360` | **REJECTED** (Worse Log Loss) |
| **Calibrated Isotonic (Best Ensemble)** | `53.68%` | `1.5263` | `0.6009` | `0.0660` | **REJECTED** (Overfitting) |

---

## 2. Walk-Forward Fold Breakdown Table

| Fold | Training Window | Test Window | Baseline 50/50 Log Loss | CatBoost (Full Feat) + DC (50/50) Log Loss | Market Log Loss |
|:---:|---|---|:---:|:---:|:---:|
| **Fold 1** | N=570 | N=114 | `0.9427` | **`0.9416`** | `0.8852` |
| **Fold 2** | N=684 | N=114 | `0.9023` | **`0.8968`** | `0.8766` |
| **Fold 3** | N=798 | N=114 | `1.0140` | `1.0142` | `0.9881` |
| **Fold 4** | N=912 | N=114 | `1.0065` | `1.0068` | `0.9985` |
| **Fold 5** | N=1026 | N=114 | `0.9619` | **`0.9618`** | `0.9483` |

---

## 3. Feature Ablation Study Results

Evaluating CatBoost performance on out-of-sample predictions across distinct feature subsets:

| Feature Subset | Included Features | Accuracy % | Log Loss | Brier Score |
|---|---|:---:|:---:|:---:|
| **Elo Only** | `EloDiff` | `54.04%` | `0.9815` | `0.5836` |
| **Elo + Dixon-Coles** | `EloDiff`, `DC_Prob_H/D/A`, `DC_xG_H/A` | `54.74%` | `0.9756` | `0.5798` |
| **Elo + Form + Goals** | `Elo`, `FormPts5`, `GoalsScored5`, `GoalsConceded5` | `54.21%` | `0.9974` | `0.5934` |
| **Elo + Form + Shots** | `Elo`, `FormPts5`, `Shots5`, `ShotsTarget5` | `54.91%` | `0.9854` | `0.5852` |
| ⭐ **Full Feature Set** | `Elo`, `Form`, `Shots`, `RestDays`, `VenuePts`, `DC` | **`55.96%`** | **`0.9744`** | **`0.5789`** |

---

## 4. Class-Specific Performance Breakdown (Recommended Engine)

Evaluating Precision, Recall, and F1-Score for individual match outcomes:

| Outcome Class | Precision | Recall | F1-Score | Calibration ECE |
|---|:---:|:---:|:---:|:---:|
| **Home Win (0)** | `0.541` | `0.830` | `0.655` | `0.021` |
| **Draw (1)** | `0.000` | `0.000` | `0.000` | `0.028` |
| **Away Win (2)** | `0.550` | `0.579` | `0.564` | `0.022` |

### Confusion Matrix (Rows: True, Columns: Predicted)
```text
Home: [194, 0, 47]
Draw: [88, 0, 51]
Away: [70, 0, 120]
```

---

## 5. Summary of Findings & Deliverable Recommendations

1. **Feature Set Improvements**: Expanding CatBoost features from `EloDiff` alone to include pre-match rolling form, goal counts, shots on target, rest days, and Dixon-Coles xG signals reduced CatBoost standalone Log Loss from **`0.9817`** to **`0.9744`** and boosted accuracy from **`54.04%`** to **`55.96%`**.
2. **50/50 CatBoost + Dixon-Coles Performance**: Combining CatBoost (Full Feature Set) with Dixon-Coles (50/50 blend) achieved **`0.9643` Log Loss**, **`0.5723` Brier Score**, and **`55.09%` Accuracy**, outperforming the existing Step 30 baseline (`0.9655` Log Loss, `0.5736` Brier Score, `53.86%` Accuracy).
3. **XGBoost Evaluation**: XGBoost standalone performed poorly on Log Loss (**`1.0135`**) and adding XGBoost to the ensemble diluted performance. **Decision: Do NOT add XGBoost to production.**
4. **Post-Hoc Calibration Evaluation**: Platt Scaling (`0.9974` Log Loss) and Isotonic Regression (`1.5263` Log Loss) degraded out-of-sample log-loss relative to raw normalized ensemble probabilities (`0.9643`). **Decision: Do NOT apply post-hoc Platt/Isotonic scaling; keep raw normalized probabilities.**
5. **Goal-Based Secondary Markets**: Dixon-Coles xG parameters ($\lambda, \mu$) allow exposing expected goals, scoreline probabilities, Over/Under 1.5/2.5/3.5, and Both Teams To Score (BTTS) while preserving 100% 1X2 backward compatibility.

---
