# Step 27 Cold-Start Evidence Quality, Team-History Gate & Connectivity Report

## Executive Summary
- **Master Audit Status**: **PASS**
- **Final Decision**: **`COLDSTART_EVIDENCE_VALIDATED`**
- **Frozen Model Contract**: `football-ensemble-v1` (50% CatBoost + 50% Dixon-Coles, Parity $|P - P_{frozen}| < 1e-6$)
- **Cold-Start Model**: `football-coldstart-v2` (Integrated with `coldStartEvidenceQuality.js`)

## Mandatory Fixture Audit Results

| Fixture Case | Date | Expected Status | Actual Status | Probabilities | Test Status |
|---|---|---|---|---|---|
| Bastia vs PSG (Dataset Start Date) | 2016-08-12 | `EXCLUDED` | `EXCLUDED` | `null` | **PASS** |
| Arsenal vs Liverpool (League-Only Context) | 2016-08-14 | `UNAVAILABLE` | `UNAVAILABLE` | `null` | **PASS** |
| First-Ever H2H (Established Team History) | 2024-08-15 | `PREDICTED` | `PREDICTED` | Valid Float64 | **PASS** |
| Arsenal vs Chelsea (Direct H2H $\ge 50$) | 2024-04-23 | `PREDICTED` | `PREDICTED` | Valid Float64 | **PASS** |

## Audit Criteria Verification
- [x] Strict evidence taxonomy: Team-Specific, Comparative, Contextual.
- [x] Contextual evidence alone (League Strength) CANNOT trigger `COLD_START`.
- [x] `Arsenal vs Liverpool` (2016-08-14) returns `UNAVAILABLE` (`NO_TEAM_SPECIFIC_PRE_MATCH_EVIDENCE`) with `probabilities: null`.
- [x] Established team history without H2H ($H2H = 0$) correctly routes to `COLD_START` (`football-coldstart-v2`).
- [x] Feature perturbation connectivity verified and zero constant/default predictions detected.
