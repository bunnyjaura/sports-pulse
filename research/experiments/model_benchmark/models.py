"""
Model Definitions & Conservative Configurations for Step 6 Benchmarking
Imports and checks status of HistGradientBoosting, LightGBM, XGBoost, CatBoost.
"""

from sklearn.ensemble import HistGradientBoostingClassifier

# Check LightGBM
try:
    from lightgbm import LGBMClassifier
    HAS_LIGHTGBM = True
except Exception as e:
    HAS_LIGHTGBM = False
    LIGHTGBM_ERR = str(e)

# Check XGBoost
try:
    from xgboost import XGBClassifier
    HAS_XGBOOST = True
except Exception as e:
    HAS_XGBOOST = False
    XGBOOST_ERR = str(e)

# Check CatBoost
try:
    from catboost import CatBoostClassifier
    HAS_CATBOOST = True
except Exception as e:
    HAS_CATBOOST = False
    CATBOOST_ERR = str(e)

def get_benchmark_models():
    models = {}
    
    # 1. Model A — Existing HistGradientBoosting Baseline
    models['HistGB'] = {
        'status': 'AVAILABLE',
        'instance': HistGradientBoostingClassifier(max_iter=100, max_depth=4, random_state=42)
    }
    
    # 2. Model B — LightGBM
    if HAS_LIGHTGBM:
        models['LightGBM'] = {
            'status': 'AVAILABLE',
            'instance': LGBMClassifier(
                objective='multiclass',
                num_class=3,
                learning_rate=0.03,
                n_estimators=200,
                num_leaves=15,
                max_depth=4,
                min_child_samples=30,
                subsample=0.8,
                colsample_bytree=0.8,
                reg_alpha=0.1,
                reg_lambda=1.0,
                random_state=42,
                verbose=-1
            )
        }
    else:
        models['LightGBM'] = {
            'status': 'UNAVAILABLE',
            'error': LIGHTGBM_ERR,
            'instance': None
        }

    # 3. Model C — XGBoost
    if HAS_XGBOOST:
        models['XGBoost'] = {
            'status': 'AVAILABLE',
            'instance': XGBClassifier(
                objective='multi:softprob',
                num_class=3,
                learning_rate=0.03,
                n_estimators=200,
                max_depth=3,
                min_child_weight=5,
                subsample=0.8,
                colsample_bytree=0.8,
                reg_alpha=0.1,
                reg_lambda=1.0,
                random_state=42
            )
        }
    else:
        models['XGBoost'] = {
            'status': 'UNAVAILABLE',
            'error': XGBOOST_ERR,
            'instance': None
        }

    # 4. Model D — CatBoost
    if HAS_CATBOOST:
        models['CatBoost'] = {
            'status': 'AVAILABLE',
            'instance': CatBoostClassifier(
                loss_function='MultiClass',
                iterations=200,
                depth=4,
                learning_rate=0.03,
                l2_leaf_reg=5,
                random_seed=42,
                verbose=0
            )
        }
    else:
        models['CatBoost'] = {
            'status': 'UNAVAILABLE',
            'error': CATBOOST_ERR,
            'instance': None
        }
        
    return models
