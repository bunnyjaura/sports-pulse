# Cold-Start Engine V2 Research Report

- **Evaluated Matches**: N=570 out-of-sample matches
- **Methodology**: 5-Fold Walk-Forward Cross Validation (Zero Temporal Leakage)

---

## Out-of-Sample Results Table

| Candidate Model | Log Loss (Lower is Better) | Brier Score (Lower is Better) | Calibration ECE | Accuracy % | Promotion Status |
|---|:---:|:---:|:---:|:---:|---|
| **Baseline Cold-Start V1** | `0.9839` | `0.5858` | `0.0847` | `54.21%` | Baseline Control |
| ⭐ **Option A: Learned Elo Priors** | **`0.9687`** | **`0.5754`** | **`0.0426`** | **`54.56%`** | **PASSED PROMOTION GATE** |
| **Option C: Elo + DC (N >= 3)** | `0.9616` | `0.572` | `0.0209` | `54.56%` | N=3 Threshold |
| ⭐ **Option C: Elo + DC (N >= 5 + Shrinkage)** | **`0.9621`** | **`0.5724`** | `0.024` | `54.56%` | **BEST COMBINED MODEL** |
| **Option C: Elo + DC (N >= 8)** | `0.9628` | `0.5729` | `0.0239` | `54.56%` | N=8 Threshold |
| **Option C: Elo + DC (N >= 10)** | `0.963` | `0.5731` | `0.0253` | `54.56%` | N=10 Threshold |
| **Tau-Optimized Logits** | `0.9763` | `0.5799` | `0.025` | `54.56%` | Tau Tuning Candidate |

---
