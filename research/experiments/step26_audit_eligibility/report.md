# Step 26 Past Match Audit Dataset Eligibility & Pre-Kickoff Coverage Gate Report

## Executive Summary
- **Master Audit Status**: **PASS**
- **Final Decision**: **`PAST_MATCH_ELIGIBILITY_GATE_PASSED`**
- **Frozen Model Contract**: `football-ensemble-v1` (50% CatBoost + 50% Dixon-Coles, Parity $|P - P_{frozen}| < 1e-6$)
- **Coverage Policy**: Authoritative eligibility condition `preMatchCount > 0` ($t < T$)

## Audit Coverage Summary
- **Total Dataset Matches**: 16,185
- **Eligible Target Predictions**: 16,120
- **Excluded Matches**: 65
- **Prediction Coverage Rate**: **99.60%**

## Mandatory Fixture Audit Results

| Fixture Case | Date | Expected Status | Actual Status | Router Called | Prediction | Test Status |
|---|---|---|---|---|---|---|
| Bastia vs PSG (Dataset Start Date) | 2016-08-12 | `EXCLUDED` | `EXCLUDED` | **No** | `null` | **PASS** |
| First-Ever H2H (Established Team History) | 2024-08-15 | `PREDICTED` | `PREDICTED` | **Yes** | Valid `football-coldstart-v2` | **PASS** |
| Arsenal vs Chelsea (Direct H2H $\ge 50$) | 2024-04-23 | `PREDICTED` | `PREDICTED` | **Yes** | Valid `football-ensemble-v1` | **PASS** |

## Audit Criteria Verification
- [x] Service orchestrates `evaluatePastMatchEligibility()` FIRST before any prediction router invocation.
- [x] Authoritative condition `preMatchCount > 0` ($t < T$) strictly excludes target matches without pre-kickoff observations.
- [x] Excluded target matches never call `predictionRouter` or generate probabilities.
- [x] Past Match Audit UI renders excluded targets in an **Excluded Matches** panel with zero probability cards.
- [x] Backtest metrics (Accuracy, Log Loss, Brier Score, ECE) use strictly **eligible prediction targets** as denominator.
