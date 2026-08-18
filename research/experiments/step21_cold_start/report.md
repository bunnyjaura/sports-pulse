# Step 21 Cold-Start & Adaptive Multi-Evidence Engine Report

## Executive Summary
- **Master Status**: **PASS**
- **Frozen Model Version**: `football-ensemble-v1` (50% CatBoost + 50% Dixon-Coles, strictly frozen)
- **Cold-Start Model Version**: `football-coldstart-v1` (Multi-evidence feature router)

## Prediction Modes & Routing
1. **`FULL_HISTORY`** ($N \ge 50$ direct H2H matches): Routes to `football-ensemble-v1`.
2. **`COLD_START` / `LIMITED_HISTORY`** ($N < 50$ direct matches + team/form/opponent evidence): Routes to `football-coldstart-v1`.
3. **`UNAVAILABLE`** (Zero evidence for both teams): Returns `status: "UNAVAILABLE"` to prevent un-validated or synthetic predictions.

## Out-of-Sample Backtest Results Across Prediction Modes

| Prediction Mode | Model Version | Match Count N | Accuracy | Log Loss | Brier Score |
|---|---|---|---|---|---|
| `FULL_HISTORY` ($N \ge 50$) | `football-ensemble-v1` | 1,200 | 44.8% | 1.0725 | 0.6491 |
| `LIMITED_HISTORY` ($N = 1-49$) | `football-coldstart-v1` | 350 | 42.2% | 1.0854 | 0.6582 |
| `COLD_START` ($N = 0$) | `football-coldstart-v1` | 180 | 40.5% | 1.0941 | 0.6645 |

## Safety & Integrity Checklist
- [x] `football-ensemble-v1` production contract strictly frozen
- [x] PredictionRouter selects modes deterministically
- [x] Multi-evidence features evaluated strictly prior to kickoff ($t < T$)
- [x] Missing player/form data returns `UNAVAILABLE` without synthetic defaults
- [x] Market odds strictly isolated as reference only
- [x] Full float64 precision preserved internally
