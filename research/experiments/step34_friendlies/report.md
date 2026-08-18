# Step 34 Research Experiment Report: International Club Friendlies Support & Audit

- **Experiment Name**: International Club Friendlies Support & Performance Audit (Step 34)
- **Date**: 2026-08-18
- **Evaluated Dataset Matches**: N=1936 multi-competition pre-kickoff predictions
- **Provenance Invariant**: PASS (`postKickoffPredictions = 0`)

---

## 1. Phase 0: Prediction Provenance Audit

| Audit Field | Recorded Count | Invariant Status |
|---|:---:|:---:|
| **Total Evaluated Matches** | `1936` | Baseline N |
| **Valid Pre-Kickoff Predictions ($t_{\text{pred}} < t_{\text{kickoff}})$** | `1936` | **PASS** |
| **Post-Kickoff Predictions** | `0` | **ZERO LEAKAGE PASS** |
| **Missing Prediction Timestamps** | `0` | **PASS** |

---

## 2. Phase 1 & 2: Dataset Integration Breakdown

| Competition Name | Competition Type | Evaluated Matches (N) |
|---|:---:|:---:|
| **La Liga** | `COMPETITIVE_LEAGUE` | `380` |
| **Premier League** | `COMPETITIVE_LEAGUE` | `380` |
| **Serie A** | `COMPETITIVE_LEAGUE` | `380` |
| **Bundesliga** | `COMPETITIVE_LEAGUE` | `306` |
| **Ligue 1** | `COMPETITIVE_LEAGUE` | `306` |
| **International Club Friendly** | `FRIENDLY` | `184` |

---

## 3. Phase 3 & 4: Comparative Performance Matrix (Competitive vs Friendlies)

| Competition Population | Matches (N) | Accuracy % | Log Loss (Primary) | Brier Score | ECE | Coverage Ratio | Sample Status |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **Competitive Leagues** | `1752` | `51.7%` | **`1.0085`** | `0.6033` | `0.0264` | `100.0%` | `HIGHER_CONFIDENCE_SAMPLE` |
| **International Club Friendlies** | `184` | `39.7%` | **`1.1194`** | `0.6816` | `0.1128` | `100.0%` | `ANALYTICS_ELIGIBLE` |

---

## 4. League-by-League Performance Breakdown

| Competition Name | Type | Matches (N) | Accuracy % | Log Loss | Brier Score | Sample Reliability Status |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **Bundesliga** | `COMPETITIVE_LEAGUE` | `306` | `52.9%` | **`0.9857`** | `0.588` | `HIGHER_CONFIDENCE_SAMPLE` |
| **Premier League** | `COMPETITIVE_LEAGUE` | `380` | `53.9%` | **`0.9878`** | `0.5889` | `HIGHER_CONFIDENCE_SAMPLE` |
| **La Liga** | `COMPETITIVE_LEAGUE` | `380` | `53.2%` | **`1.0047`** | `0.5998` | `HIGHER_CONFIDENCE_SAMPLE` |
| **Serie A** | `COMPETITIVE_LEAGUE` | `380` | `51.3%` | **`1.0181`** | `0.6097` | `HIGHER_CONFIDENCE_SAMPLE` |
| **Ligue 1** | `COMPETITIVE_LEAGUE` | `306` | `46.1%` | **`1.0498`** | `0.6326` | `HIGHER_CONFIDENCE_SAMPLE` |
| **International Club Friendly** | `FRIENDLY` | `184` | `39.7%` | **`1.1194`** | `0.6816` | `ANALYTICS_ELIGIBLE` |

---

## 5. Phase 5: Friendly Modeling Experiments & Promotion Decision

| Modeling Strategy | Validation Log Loss | Status / Decision |
|---|:---:|---|
| **Model A: Production Baseline** | `1.1194` | Baseline Control |
| **Model B: Existing + FRIENDLY Indicator** | `1.1149` | Candidate |
| **Model C: Friendly Calibration** | `1.1104` | Candidate |
| **Model D: Separate Friendly Model** | `1.1362` | Candidate |

### Production Promotion Decision:
- **`ISOLATED_ANALYTICS_ONLY`**
- **Strict Rule**: Friendly matches are supported for prediction and analytics, but **ISOLATED from competitive-league training datasets** (`Premier League`, `La Liga`, `Bundesliga`, `Serie A`, `Ligue 1`).

---
