# Step 23 Past Match Audit Prediction Routing & Cold-Start Integration Report

## Executive Summary
- **Master Audit Status**: **PASS**
- **Frozen Model Contract**: `football-ensemble-v1` (50% CatBoost + 50% Dixon-Coles, $N \ge 50$ Direct H2H)
- **Cold-Start Model Version**: `football-coldstart-v2` (Step 22 Learned Weights: Team 31%, Form 22%, Opponent 16%, Home/Away 15%, Common Opp 11%, League 8%)

## Mandatory Fixture Regression Audit Cases

| Fixture | Direct H2H N | Broader History | Prediction Mode | Selected Model Version | Status |
|---|---|---|---|---|---|
| Bastia vs PSG (2016-08-12 Dataset Start) | 0 | 0 | `UNAVAILABLE` | `NONE` | **PASS** |
| Bastia vs PSG (With Broader History) | 0 | 279 matches | `COLD_START` | `football-coldstart-v2` | **PASS** |
| Arsenal vs Chelsea | 58 | 1,200 matches | `FULL_HISTORY` | `football-ensemble-v1` | **PASS** |

## Key Architectural Corrections
- Decoupled Direct H2H count ($N$) from broader historical evidence availability.
- Direct $H2H = 0$ does **not** trigger `INSUFFICIENT_HISTORY`.
- Broader team history ($A \text{ vs } C$, $B \text{ vs } D$) and league context are used by `football-coldstart-v2`.
- Effective evidence weights dynamically re-normalize when a factor is `UNAVAILABLE` ($\sum w_i' = 1.0$).
