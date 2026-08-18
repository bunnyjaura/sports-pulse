# Step 8 Research Experiment Report: Probability Calibration

- **Experiment Name**: Out-of-Sample Probability Calibration Experiment (Step 8)
- **Date**: 2026-08-18
- **Dataset**: Multi-Season Premier League Historical Matches (N=1140 matches)
- **Validation**: 5-Fold Expanding Window Walk-Forward Evaluation
- **Calibration Protocol**: Chronological split inside every historical fold (70% base train, 30% calibration val; zero test leakage).

---

## 1. Global Out-of-Sample Calibration Summary

| Model | Calibration Method | Out-of-Sample Log Loss (Lower is Better) | Brier Score (Lower is Better) | ECE Calibration Error (Lower is Better) | Accuracy % | Macro F1 | Fold Log Loss Std Dev | Decision |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **Market Benchmark** | Raw | **`0.939`** | **`0.556`** | `0.011` | **`56.5%`** | `0.423` | `±0.050` | Benchmark |
| **CatBoost** | **Raw** | **`0.958`** | **`0.568`** | `0.014` | **`54.6%`** | `0.418` | `±0.048` | **KEEP RAW** |
| | Platt | `0.979` | `0.580` | **`0.002`** | `55.4%` | `0.414` | `±0.041` | Rejected |
| | Isotonic | `1.013` | `0.588` | `0.042` | `51.9%` | `0.434` | `±0.063` | Rejected |
| **Dixon-Coles** | **Raw** | **`0.964`** | **`0.574`** | **`0.012`** | **`54.9%`** | `0.413` | `±0.046` | **KEEP RAW** |
| | Platt | `0.999` | `0.594` | `0.007` | `51.4%` | `0.380` | `±0.028` | Rejected |
| | Isotonic | `1.012` | `0.598` | `0.022` | `50.7%` | `0.392` | `±0.040` | Rejected |
| **XGBoost** | **Raw** | **`0.980`** | **`0.580`** | `0.024` | `53.5%` | `0.429` | **`±0.036`** | **KEEP RAW** |
| | Platt | `0.988` | `0.586` | **`0.008`** | `53.9%` | `0.403` | `±0.026` | Rejected |
| | Isotonic | `1.010` | `0.590` | `0.035` | `52.5%` | `0.418` | `±0.043` | Rejected |
| **LightGBM** | **Platt** | **`0.992`** | **`0.589`** | **`0.006`** | `53.3%` | `0.397` | **`±0.030`** | **KEEP PLATT** |
| | Raw | `1.001` | `0.589` | `0.034` | `53.2%` | `0.448` | `±0.047` | Control |
| | Isotonic | `1.023` | `0.599` | `0.034` | `50.5%` | `0.406` | `±0.042` | Rejected |

---

## 2. Key Calibration Discoveries

1. **CatBoost & Dixon-Coles Are Natively Well Calibrated**:
   - Both **CatBoost Raw (`0.958` Log Loss, `0.014` ECE)** and **Dixon-Coles Raw (`0.964` Log Loss, `0.012` ECE)** produce exceptionally well-calibrated probabilities natively.
   - Post-hoc Platt scaling slightly pulls extreme confidence probabilities toward the mean prior, reducing ECE further (`0.002` for CatBoost) but slightly worsening out-of-sample Log Loss (`0.979`).
2. **LightGBM Benefits from Platt Scaling**:
   - For **LightGBM**, Platt scaling successfully improves Log Loss from `1.001` to **`0.992`** and reduces ECE from `0.034` to `0.006`.
3. **Isotonic Overfitting**:
   - Across all 4 models, Isotonic regression overfits small historical calibration splits ($N \approx 200$), consistently degrading out-of-sample Log Loss.

---

## 3. Best Model / Calibration Mapping for Step 9 Ensembling

- **Best Raw Model**: **CatBoost Raw** (Log Loss: `0.958`, ECE: `0.014`)
- **Best Calibrated Model**: **CatBoost Raw** (Log Loss: `0.958`)
- **Best Non-Market Football Model**: **Dixon-Coles Raw** (Log Loss: `0.964`, ECE: `0.012`)
- **Most Improved via Calibration**: **LightGBM Platt** (Log Loss improved from `1.001` to `0.992`)

---

## 4. Final Recommendation (Rule 21)

**`KEEP RAW FOR CATBOOST / DIXON-COLES / XGBOOST, KEEP PLATT FOR LIGHTGBM`**

- **Production Status**: Zero changes made to production files (`train_ensemble.py`). All calibration evaluations are archived in `research/experiments/calibration/` (`leakage_tests.py`, `calibration_methods.py`, `evaluation.py`, `run_experiment.py`, `results.json`, `report.md`).
