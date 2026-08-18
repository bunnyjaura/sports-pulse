# Step 16 Research Experiment Report: Live Prediction Quality & Value-Bet Decision Layer

- **Experiment Name**: Live Prediction Quality & Value-Bet Decision Layer (Step 16)
- **Date**: 2026-08-18
- **Model Version**: `football-ensemble-v1` (CatBoost 50% + Dixon-Coles 50%)
- **Dataset**: Multi-Season Premier League Historical Matches (N=1140 matches across 5 Walk-Forward Folds)
- **Evaluation**: Flat 1-Unit Stake Chronological Value Backtest & 1000-Sample Paired Bootstrap

---

## 1. Methodology & Fair Odds Math

- **Fair Decimal Odds**: $\text{fair\_odds}_i = 1 / P_{\text{model\_i}}$
- **Market Probabilities (Overround Removed)**: $P_{\text{market\_i}} = (1 / \text{odds}_i) / \sum (1 / \text{odds}_k)$
- **Model Edge**: $\text{edge}_i = P_{\text{model\_i}} - P_{\text{market\_i}}$
- **Expected Value (EV)**: $\text{EV}_i = P_{\text{model\_i}} \times \text{market\_odds}_i - 1$

---

## 2. Chronological Value Backtest Results Across Threshold Configurations

| Threshold Configuration | Total Qualified Opportunities | Opportunity Rate % | Hit Rate % | Average Edge | Average EV | Realized ROI % (1-Unit Flat) | Total Profit (Units) | 95% Bootstrap CI (ROI %) | $P(\text{ROI} > 0)$ | Verdict |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Edge $\ge 0.01$, EV $\ge 0.01$** | 451 | 79.1% | 27.3% | +0.066 | +0.191 | **-22.13%** | -99.82 | `[-34.96%, -9.27%]` | 0.000 | **REJECT** |
| **Edge $\ge 0.02$, EV $\ge 0.01$** | 423 | 74.2% | 28.1% | +0.069 | +0.201 | **-21.62%** | -91.47 | `[-35.31%, -8.02%]` | 0.002 | **REJECT** |
| **Edge $\ge 0.03$, EV $\ge 0.02$** *(Primary)* | **358** | **62.8%** | **29.9%** | **+0.077** | **+0.225** | **-18.36%** | **-65.73** | **`[-33.95%, -2.97%]`** | **0.012** | **REJECT** |
| **Edge $\ge 0.05$, EV $\ge 0.03$** | 254 | 44.6% | 30.7% | +0.092 | +0.261 | **-25.69%** | -65.25 | `[-41.46%, -8.37%]` | 0.001 | **REJECT** |
| **Edge $\ge 0.05$, EV $\ge 0.05$** | 248 | 43.5% | 30.2% | +0.093 | +0.266 | **-25.82%** | -64.04 | `[-42.02%, -6.98%]` | 0.000 | **REJECT** |

---

## 3. Hypothesis Test Evaluation

- **Null Hypothesis ($H_0$)**: Football model provides no actionable incremental information beyond market odds.
- **Alternative Hypothesis ($H_1$)**: Football model identifies statistically meaningful market mispricing.
- **Result**: **$H_0$ IS STRONGLY SUPPORTED**.
  - All evaluated threshold configurations produced negative realized ROIs ranging from **`-18.36%` to `-25.82%`**.
  - All $95\%$ bootstrap confidence intervals lie strictly below zero.
  - Probability of positive ROI is $\le 1.2\%$.
  - Model probability disagreements with bookmaker odds reflect model approximation errors, NOT bookmaker mispricing.

---

## 4. Final Recommendation

**`REJECT VALUE STRATEGY`**

- **Production Impact**: The frozen prediction engine **`football-ensemble-v1`** must NOT be connected to any betting or execution layer.
- **Production Status**: Production engine remains frozen and operationally `SAFE_TO_OPERATE` as a pure probabilistic estimator.
