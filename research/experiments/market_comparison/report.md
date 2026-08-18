# Step 10 Research Experiment Report: Market Comparison & Information-Value

- **Experiment Name**: Market Comparison & Information-Value Experiment (Step 10)
- **Date**: 2026-08-18
- **Dataset**: Multi-Season Premier League Historical Matches (N=1140 matches)
- **Validation**: 5-Fold Expanding Window Walk-Forward Evaluation
- **Shrinkage Model**: $P_{\text{final}} = \alpha P_{\text{football}} + (1 - \alpha) P_{\text{market}}$

---

## 1. Market Benchmark vs. Best Football Model

| Model / Benchmark | Log Loss (Lower is Better) | Brier Score (Lower is Better) | ECE Calibration Error | Accuracy % | Status |
|---|:---:|:---:|:---:|:---:|:---:|
| **Market Benchmark** | **`0.939`** | **`0.556`** | **`0.011`** | **`56.5%`** | Market Baseline |
| **Best Football Model (CatBoost + DC 50/50)** | `0.954` | `0.565` | `0.013` | `54.7%` | Non-Market Best |

---

## 2. Fixed Market Blends

| Blend Combination ($\alpha$) | Log Loss | Brier Score | ECE Calibration Error | Accuracy % |
|---|:---:|:---:|:---:|:---:|
| **95% Market + 5% Football** ($\alpha = 0.05$) | `0.940` | `0.556` | `0.011` | `56.8%` |
| **90% Market + 10% Football** ($\alpha = 0.10$) | `0.940` | `0.556` | `0.011` | `57.0%` |
| **85% Market + 15% Football** ($\alpha = 0.15$) | `0.941` | `0.556` | `0.010` | `56.7%` |
| **80% Market + 20% Football** ($\alpha = 0.20$) | `0.941` | `0.557` | `0.011` | `56.3%` |
| **75% Market + 25% Football** ($\alpha = 0.25$) | `0.942` | `0.557` | `0.009` | `56.1%` |
| **70% Market + 30% Football** ($\alpha = 0.30$) | `0.942` | `0.557` | `0.007` | `56.1%` |
| **50% Market + 50% Football** ($\alpha = 0.50$) | `0.945` | `0.559` | `0.008` | `55.6%` |

---

## 3. Optimized Shrinkage Alpha

| Fold | Test Window | Expanding Historical Alpha ($\alpha$) | Market Log Loss | Football Log Loss | Blend Log Loss | Candidate Beats Market? |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Fold 1** | $2023\text{-}12\text{-}30 \rightarrow 2024\text{-}04\text{-}06$ | $0.05$ | 0.885 | 0.913 | 0.886 | False |
| **Fold 2** | $2024\text{-}04\text{-}06 \rightarrow 2024\text{-}09\text{-}14$ | $0.00$ | 0.877 | 0.894 | 0.877 | False |
| **Fold 3** | $2024\text{-}09\text{-}15 \rightarrow 2024\text{-}12\text{-}14$ | $0.00$ | 0.988 | 1.000 | 0.988 | True |
| **Fold 4** | $2024\text{-}12\text{-}14 \rightarrow 2025\text{-}02\text{-}26$ | $0.00$ | 0.998 | 1.013 | 0.998 | False |
| **Fold 5** | $2025\text{-}02\text{-}26 \rightarrow 2025\text{-}05\text{-}25$ | $0.00$ | 0.948 | 0.948 | 0.948 | False |

- **Mean Optimal Shrinkage Alpha**: $\alpha = 0.01$ (100% Market weight across 4 of 5 expanding folds).

---

## 4. Conditional Results & Regimes

### A. Overround Quantile Analysis:
- **Low Overround ($1.037 \rightarrow 1.051$)**: Market Log Loss `0.906` vs Football `0.912`.
- **Medium Overround ($1.051 \rightarrow 1.057$)**: Market Log Loss `0.966` vs Football `0.990`.
- **High Overround ($1.057 \rightarrow 1.078$)**: Market Log Loss `0.946` vs Football `0.958`.

### B. Probability Disagreement Quantile Analysis:
- **80-100th Disagreement Percentile ($\Delta p > 0.07$)**: Market Log Loss `0.924` vs Football `0.968`.
- High disagreement between market and football models is driven by noise in team parameters, not unpriced market inefficiencies.

### C. Outcome Class Log Loss:
- **Home**: Market `0.573` vs Football `0.584`.
- **Draw**: Market `0.546` vs Football `0.550`.
- **Away**: Market `0.534` vs Football `0.542`.

---

## 5. Statistical Significance & Paired 1000-Sample Bootstrap Test

- **Per-Match Loss Difference ($\text{Loss}_{\text{Market}} - \text{Loss}_{\text{Football}}$)**: Mean **`-0.0143`** (Median `-0.0087`).
- **Paired Bootstrap 95% Confidence Interval**: **`[-0.0244, -0.0044]`**.
- **Probability Candidate Beats Market**: **`0.002`** (0.2%).
- The 95% confidence interval lies strictly below zero, proving that closing bookmaker odds are statistically superior to the standalone football model predictions.

---

## 6. Final Decision & Required Output Formatting

BEST MARKET BENCHMARK:
Market Benchmark (Log Loss: 0.939, Brier: 0.556, ECE: 0.011, Accuracy: 56.5%)

BEST FOOTBALL MODEL:
CatBoost + Dixon-Coles 50/50 (Log Loss: 0.954, Brier: 0.565, ECE: 0.013, Accuracy: 54.7%)

BEST FIXED MARKET BLEND:
95% Market + 5% Football (Log Loss: 0.940, Brier: 0.556, ECE: 0.011, Accuracy: 56.8%)

BEST OPTIMIZED BLEND:
Optimized Shrinkage Alpha Blend (Log Loss: 0.940, Brier: 0.556, ECE: 0.011, Accuracy: 56.5%)

OPTIMAL FOOTBALL SHRINKAGE:
alpha = 0.01 (100% Market weight in 4/5 folds)

MARKET LOG LOSS:
0.939

BEST CANDIDATE LOG LOSS:
0.940

LOG LOSS IMPROVEMENT:
-0.001 (Degradation)

95% CONFIDENCE INTERVAL:
[-0.0244, -0.0044]

PROBABILITY CANDIDATE BEATS MARKET:
0.002 (0.2%)

FOLDS BEATING MARKET:
1 / 5

DOES FOOTBALL PROVIDE ADDITIONAL INFORMATION?
NO

WHERE DOES FOOTBALL ADD INFORMATION?
Within the evaluated historical OOS sample, no statistically reliable regime was identified where the football model provided incremental predictive information beyond closing bookmaker odds.

RECOMMENDATION:
REJECT

PRODUCTION FILES MODIFIED:
NONE
