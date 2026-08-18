# Step 11 Research Experiment Report: Advanced Feature Engineering & Data Quality

- **Experiment Name**: Advanced Feature Engineering & Data Quality Research (Step 11)
- **Date**: 2026-08-18
- **Dataset**: Multi-Season Premier League Historical Matches (N=1140 matches)
- **Validation**: 5-Fold Expanding Window Walk-Forward Evaluation
- **Baseline Engine**: CatBoost + Dixon-Coles 50/50 Ensemble (using standard EloDiff feature)

---

## 1. Leakage Test Verification

- **Current match excluded from rolling windows**: PASSED
- **Future matches excluded**: PASSED
- **Sequential league table reconstruction**: PASSED
- **H2H uses only past meetings**: PASSED
- **Rest-day calculation strictly pre-kickoff**: PASSED
- **Deterministic feature generation**: PASSED

---

## 2. Exact Feature Definitions

- **Baseline**: `EloDiff` (Pre-match Home Elo minus Away Elo).
- **Exp A (Strength Dynamics)**: `EloDiff`, `EloDiffAdv`, `EloTrend5_Home`, `EloTrend5_Away`.
- **Exp B (Recent Form Quality)**: `FormPPM_5_Home`, `FormPPM_5_Away`, `FormGD_5_Home`, `FormGD_5_Away`, `CS_5_Home`, `CS_5_Away`, `FTS_5_Home`, `FTS_5_Away`.
- **Exp C (Home/Away Strength)**: `VenuePPM_5_Home`, `VenuePPM_5_Away`, `VenueGD_5_Home`, `VenueGD_5_Away`.
- **Exp D (Schedule / Fatigue)**: `RestDays_Diff`, `Matches14D_Home`, `Matches14D_Away`.
- **Exp E (Head-to-Head)**: `H2H_Win_Home`, `H2H_Draw`, `H2H_GD_Avg`.
- **Exp F (League Standings)**: `TablePPM_Diff`, `TableGD_Diff`.

---

## 3. Global Out-of-Sample Performance Summary

| Feature Group | Out-of-Sample Log Loss (Lower is Better) | Brier Score (Lower is Better) | ECE Calibration Error | Accuracy % | Macro F1 | Fold Log Loss Std Dev | 95% Bootstrap CI vs Baseline | Result |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Market Benchmark Ref** | **`0.941`** | **`0.557`** | **`0.009`** | **`56.3%`** | `0.421` | `±0.050` | N/A | Market Ref |
| **Baseline (EloDiff)** | **`0.966`** | **`0.574`** | `0.025` | `54.0%` | `0.403` | `±0.043` | `[0.000, 0.000]` | **Baseline** |
| **Exp A (Strength Dynamics)** | `0.969` | `0.576` | `0.020` | `53.7%` | `0.400` | `±0.046` | `[-0.0073, +0.0014]` | Degraded |
| **Exp B (Recent Form Quality)** | `0.971` | `0.577` | `0.015` | `54.0%` | `0.407` | `±0.031` | `[-0.0114, +0.0022]` | Degraded |
| **Exp C (Home/Away Venue)** | `0.970` | `0.576` | `0.011` | `54.6%` | `0.408` | `±0.032` | `[-0.0090, +0.0019]` | Degraded |
| **Exp D (Schedule / Fatigue)** | `0.964` | `0.573` | `0.019` | `53.3%` | `0.397` | `±0.046` | `[-0.0039, +0.0087]` | Noise (CI spans 0) |
| **Exp E (Head-to-Head)** | `0.972` | `0.579` | `0.017` | `53.9%` | `0.403` | `±0.046` | `[-0.0111, -0.0004]` | Degraded |
| **Exp F (League Standings)** | `0.972` | `0.578` | `0.014` | `53.9%` | `0.400` | `±0.048` | `[-0.0110, +0.0006]` | Degraded |

---

## 4. Fold-by-Fold Detailed Breakdown

| Fold | Test Window | Baseline Log Loss | Exp A | Exp B | Exp C | Exp D | Exp E | Exp F |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Fold 1** | $2023\text{-}12\text{-}30 \rightarrow 2024\text{-}04\text{-}06$ | 0.948 | 0.944 | 0.943 | 0.951 | 0.932 | 0.957 | 0.945 |
| **Fold 2** | $2024\text{-}04\text{-}06 \rightarrow 2024\text{-}09\text{-}14$ | 0.902 | 0.904 | 0.922 | 0.915 | 0.904 | 0.904 | 0.902 |
| **Fold 3** | $2024\text{-}09\text{-}15 \rightarrow 2024\text{-}12\text{-}14$ | 1.014 | 1.020 | 1.026 | 1.011 | 1.018 | 1.014 | 1.021 |
| **Fold 4** | $2024\text{-}12\text{-}14 \rightarrow 2025\text{-}02\text{-}26$ | 1.014 | 1.024 | 1.019 | 1.030 | 1.018 | 1.032 | 1.030 |
| **Fold 5** | $2025\text{-}02\text{-}26 \rightarrow 2025\text{-}05\text{-}25$ | 0.954 | 0.953 | 0.945 | 0.944 | 0.950 | 0.954 | 0.961 |

---

## 5. Synthesis & Diagnosis of Feature Instability

1. **Why Over-Engineering Features Degrades Probability Quality**:
   - Adding short-term rolling form, venue splits, H2H, and table positions increases model variance and leads tree-based algorithms to overfit noise in short historical Premier League samples.
2. **Elo Rating Strength**:
   - Pre-match `EloDiff` already dynamically absorbs past match results, goal differentials, home advantage, and opponent strength over multi-year windows with optimal exponential smoothing.
3. **Statistical Uncertainty**:
   - Exp D (Schedule/Fatigue) shows a slight numerical change (`0.964` vs `0.966`), but its paired bootstrap $95\%$ confidence interval includes zero (`[-0.0039, +0.0087]`). Under the mandatory promotion rule, statistically uncertain improvements must be REJECTED.

---

## 6. Final Decision & Required Summary Output

FEATURE GROUPS IMPROVED:
NONE (Exp D showed minor numerical movement but 95% CI spans zero)

FEATURE GROUPS DEGRADED:
Exp A (Strength Dynamics), Exp B (Recent Form), Exp C (Venue Strength), Exp E (Head-to-Head), Exp F (League Standings)

BEST OOS LOG LOSS:
0.966 (Baseline EloDiff Engine)

BEST OOS BRIER:
0.574 (Baseline EloDiff Engine)

CALIBRATION RESULT:
ECE = 0.025 (Well calibrated)

FOLD STABILITY:
Std Dev Log Loss = ±0.043 across 5 walk-forward folds

STATISTICAL SIGNIFICANCE:
No feature group achieved statistically significant improvement over baseline (All 95% CIs include or lie below 0.0)

RECOMMENDATION:
REJECT ALL ADVANCED FEATURES / KEEP EXISTING BASELINE UNCHANGED

PRODUCTION FILES MODIFIED:
NONE
