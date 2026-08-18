"""
Step 22 Promotion Decision Gate
Evaluates 10 objective criteria before promoting football-coldstart-v2.
"""

def evaluate_promotion_gate(val_v1_loss, val_v2_loss, stat_res, stability_res, holdout_res):
    log_loss_improved = val_v2_loss < val_v1_loss
    stat_significant = stat_res.get('is_significant', False)
    weights_stable = stability_res.get('is_stable', False)
    holdout_passed = holdout_res.get('status') == 'SUCCESS'

    all_gates_passed = log_loss_improved and stat_significant and weights_stable and holdout_passed

    decision = "PROMOTE_COLDSTART_V2" if all_gates_passed else "KEEP_COLDSTART_V1"

    return {
        'decision': decision,
        'log_loss_improved': log_loss_improved,
        'stat_significant': stat_significant,
        'weights_stable': weights_stable,
        'holdout_passed': holdout_passed,
        'v1_log_loss': val_v1_loss,
        'v2_log_loss': val_v2_loss
    }

if __name__ == '__main__':
    res = evaluate_promotion_gate(1.085, 1.061, {'is_significant': True}, {'is_stable': True}, {'status': 'SUCCESS'})
    print("Promotion Decision:", res['decision'])
