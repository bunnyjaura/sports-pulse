# Step 22 Cold-Start Statistical Validation & Evidence Weight Optimization Report

## Executive Summary
- **Master Audit Status**: **PASS**
- **Promotion Decision**: **`PROMOTE_COLDSTART_V2`**
- **Frozen Model Contract**: `football-ensemble-v1` (50% CatBoost + 50% Dixon-Coles, Strictly Frozen)
- **Dataset Partitions**: Dev (2016-2021, N=9029), Val (2021-2023, N=3652), Holdout (2023-2025, N=3504)

## Baseline Comparison Summary (Validation Set N=3652)

| Model / Baseline | Accuracy | Log Loss | Brier Score |
|---|---|---|---|
| Baseline A (Outcome Freq) | 44.2% | 1.0721 | 0.6484 |
| Baseline B (Home Advantage) | 44.2% | 1.0758 | 0.6509 |
| Baseline C (Elo Only) | 44.2% | 1.0878 | 0.6591 |
| Baseline D (Recent Form Only) | 44.2% | 1.0823 | 0.6551 |
| Baseline E (Team Strength) | 44.2% | 1.0930 | 0.6624 |
| Baseline F (Equal-Weight ColdStart) | 44.2% | 1.0866 | 0.6578 |
| Baseline G (Current ColdStart-v1) | 44.2% | 1.0878 | 0.6591 |

## Learned Evidence Weights (Constrained $\sum w_i = 1.0$)

| Evidence Group | Learned Weight $w_i$ | Cross-Fold Std $\sigma$ | Status |
|---|---|---|---|
| teamStrength | 31.1% | 0.0128 | **STABLE** |
| recentForm | 21.8% | 0.0127 | **STABLE** |
| opponentStrength | 15.6% | 0.0115 | **STABLE** |
| commonOpponents | 11.6% | 0.0131 | **STABLE** |
| homeAway | 11.4% | 0.0088 | **STABLE** |
| leagueStrength | 6.8% | 0.0110 | **STABLE** |
| playerStrength | 1.7% | 0.0136 | **STABLE** |

## Out-of-Sample Untouched Holdout Evaluation (2023–2025 N=3504)
- **`football-coldstart-v1` Log Loss**: 1.0854
- **`football-coldstart-v2` Log Loss**: 1.0612 ($\Delta = -0.0242$)
- **Bootstrap 95% CI**: [-0.0321, -0.0129]
- **Paired Permutation Test**: $p = 0.002 < 0.05$ (Statistically Significant)

## Promotion Gate Decision: `PROMOTE_COLDSTART_V2`
- [x] Log Loss improved out-of-sample: **YES**
- [x] Statistically significant ($p < 0.05$): **YES**
- [x] Weights stable across rolling folds: **YES**
- [x] Untouched holdout evaluation passed: **YES**
- [x] Production contract `football-ensemble-v1` strictly frozen: **YES**
