"""
Step 22 Chronological Dataset Builder
Partitions multi-league historical dataset into Training (2016-2021), Validation (2021-2023), and Untouched Holdout (2023-2025).
Enforces strict date inequality: training.kickoffAt < target.kickoffAt.
"""

import os
import pandas as pd

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'data', 'multi_league_historical.csv')

def load_partitioned_datasets():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    df = df.sort_values('kickoffAt').reset_index(drop=True)

    dev_df = df[(df['kickoffAt'] >= '2016-08-01') & (df['kickoffAt'] < '2021-07-01')].copy()
    val_df = df[(df['kickoffAt'] >= '2021-07-01') & (df['kickoffAt'] < '2023-07-01')].copy()
    holdout_df = df[(df['kickoffAt'] >= '2023-07-01') & (df['kickoffAt'] <= '2025-06-30')].copy()

    return {
        'full_df': df,
        'dev_df': dev_df,
        'val_df': val_df,
        'holdout_df': holdout_df
    }

if __name__ == '__main__':
    parts = load_partitioned_datasets()
    print(f"Dataset Partitions Loaded:")
    print(f"  Dev (2016-2021): {len(parts['dev_df'])} matches")
    print(f"  Val (2021-2023): {len(parts['val_df'])} matches")
    print(f"  Holdout (2023-2025): {len(parts['holdout_df'])} matches")
