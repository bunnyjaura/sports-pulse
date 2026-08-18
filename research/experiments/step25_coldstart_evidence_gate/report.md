# Step 25 Cold-Start Evidence Eligibility, Temporal Provenance & First-Match Prediction Report

## Executive Summary
- **Master Audit Status**: **PASS**
- **Final Decision**: **`COLDSTART_EVIDENCE_GATE_PASSED`**
- **Frozen Model Contract**: `football-ensemble-v1` (50% CatBoost + 50% Dixon-Coles, Parity $|P - P_{frozen}| < 1e-6$)
- **Cold-Start Model**: `football-coldstart-v2` (Integrated with `coldStartEvidenceGate.js`)

## Mandatory Fixture Audit Results

| Fixture Case | Date | Expected Mode | Actual Mode | Probabilities | Status |
|---|---|---|---|---|---|
| Bastia vs PSG (Dataset Start Date) | 2016-08-12 | `UNAVAILABLE` | `UNAVAILABLE` | `null` | **PASS** |
| First-Ever H2H (Established Team History) | 2024-08-15 | `COLD_START` | `COLD_START` | Valid Float64 | **PASS** |
| Arsenal vs Chelsea (Direct H2H $\ge 50$) | 2024-04-23 | `FULL_HISTORY` | `FULL_HISTORY` | Valid Float64 | **PASS** |

## Audit Criteria Verification
- [x] Direct H2H count ($N \ge 50$) is used solely for `football-ensemble-v1` routing eligibility.
- [x] Direct H2H is designated as `Routing Only` (Configured: N/A, Effective: N/A) without `NaN%` displays.
- [x] Pre-kickoff match filtering strictly enforces `match.kickoffAtMs < targetMatch.kickoffAtMs` ($t < T$).
- [x] Zero future common opponents or match results are leaked.
- [x] `Bastia vs PSG` on dataset start date `2016-08-12` returns `UNAVAILABLE` with `probabilities: null`.
