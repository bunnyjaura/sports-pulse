# Step 32 Research Experiment Report: Prediction Performance Analytics & League Leaderboard

- **Experiment Name**: Prediction Performance Analytics Engine & League Leaderboard (Step 32)
- **Date**: 2026-08-18
- **Evaluated Matches**: N=1752 multi-league pre-kickoff predictions
- **Minimum Sample Threshold**: N ≥ 100 matches required for reliable status

---

## 1. League Performance Leaderboard (Ranked by Log Loss)

| League | Matches (N) | Accuracy % (95% CI) | Log Loss (Primary) | Brier Score | Sample Reliability |
|---|:---:|:---:|:---:|:---:|---|
| **GER_BUNDESLIGA** | `306` | `54.2% (48.6% - 59.7%)` | **`0.9464`** | `0.5597` | `RELIABLE_SAMPLE` |
| **ESP_LALIGA** | `380` | `55.3% (50.2% - 60.2%)` | **`0.9473`** | `0.563` | `RELIABLE_SAMPLE` |
| **ENG_PL** | `380` | `55.8% (50.8% - 60.7%)` | **`0.9662`** | `0.5735` | `RELIABLE_SAMPLE` |
| **ITA_SERIEA** | `380` | `55.0% (50.0% - 59.9%)` | **`0.9668`** | `0.576` | `RELIABLE_SAMPLE` |
| **FRA_LIGUE1** | `306` | `51.0% (45.4% - 56.5%)` | **`1.0144`** | `0.6096` | `RELIABLE_SAMPLE` |

---

## 2. Confidence Calibration Buckets

Evaluating whether a high confidence prediction (e.g. 70%) actually hits ~70% of the time:

| Prediction Confidence | Matches | Actual Accuracy % | Avg Predicted Prob % | Log Loss | Calibration Delta |
|---|:---:|:---:|:---:|:---:|:---:|
| **50-55%** | `193` | `55.4%` | `52.7%` | `0.9895` | `2.8%` |
| **55-60%** | `215` | `62.3%` | `57.3%` | `0.9088` | `5.1%` |
| **60-65%** | `130` | `66.2%` | `62.2%` | `0.856` | `3.9%` |
| **65-70%** | `151` | `71.5%` | `67.3%` | `0.7811` | `4.2%` |
| **70%+** | `1063` | `48.7%` | `47.7%` | `1.0149` | `1.0%` |

---

## 3. Class-Specific 1X2 Performance Breakdown

| Outcome Class | Predictions Count | Precision | Recall | F1-Score |
|---|:---:|:---:|:---:|:---:|
| **Home Win (0)** | `764` | `0.552` | `0.842` | `0.667` |
| **Draw (1)** | `468` | `1.0` | `0.002` | `0.004` |
| **Away Win (2)** | `520` | `0.526` | `0.594` | `0.558` |

---
