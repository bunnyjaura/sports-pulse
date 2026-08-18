<template>
  <div class="glass-panel value-bets-card glass-card-glow">
    <div class="card-header">
      <div>
        <h2><TrendingUp class="text-gold icon-inline" :size="24" /> Market Odds vs Model Probability Reference</h2>
        <p class="subtitle">Neutral comparison of <strong>football-ensemble-v1</strong> probabilities against bookmaker market reference odds. <em>(Note: Value-Bet strategy was REJECTED by Step 16 Research Audit)</em>.</p>
      </div>
    </div>

    <div class="table-container font-mono">
      <div class="table-head">
        <span>Match / Date</span>
        <span>Selection Pick</span>
        <span>Model Prob ($P$)</span>
        <span>Bookmaker Odds</span>
        <span>Market Implied Prob</span>
        <span>Probability Difference</span>
        <span>Status</span>
      </div>

      <div v-for="item in filteredBets" :key="item.id" class="table-row">
        <div class="match-info">
          <span class="teams">{{ item.homeTeam }} vs {{ item.awayTeam }}</span>
          <span class="date">{{ item.date }} • {{ item.league }}</span>
        </div>

        <div class="pick-tag">
          <span class="pick-badge">{{ item.pickLabel }}</span>
        </div>

        <div class="prob-val text-cyan font-mono">
          {{ (item.modelProb * 100).toFixed(1) }}%
        </div>

        <div class="odds-val font-mono">
          {{ item.odds }}
        </div>

        <div class="implied-val font-mono text-muted">
          {{ (item.impliedProb * 100).toFixed(1) }}%
        </div>

        <div class="ev-val text-gold font-mono font-bold">
          {{ (item.diff * 100) > 0 ? '+' : '' }}{{ (item.diff * 100).toFixed(1) }}% pts
        </div>

        <div class="kelly-val font-mono">
          <span class="kelly-badge">Reference Only</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { TrendingUp } from 'lucide-vue-next';
import { UPCOMING_FIXTURES } from '../data/historicalMatches';

const filteredBets = computed(() => {
  const bets = [];

  for (const fix of UPCOMING_FIXTURES) {
    const hP = 0.53;
    const dP = 0.25;
    const aP = 0.22;

    const selections = [
      { pickLabel: `${fix.homeTeam} Win (H)`, modelProb: hP, odds: fix.B365H },
      { pickLabel: `Draw (X)`, modelProb: dP, odds: fix.B365D },
      { pickLabel: `${fix.awayTeam} Win (A)`, modelProb: aP, odds: fix.B365A }
    ];

    for (const sel of selections) {
      if (sel.odds) {
        const impliedProb = 1 / sel.odds;
        const diff = sel.modelProb - impliedProb;

        bets.push({
          id: `${fix.id}-${sel.pickLabel}`,
          homeTeam: fix.homeTeam,
          awayTeam: fix.awayTeam,
          date: fix.date,
          league: fix.league,
          pickLabel: sel.pickLabel,
          modelProb: sel.modelProb,
          odds: sel.odds,
          impliedProb,
          diff
        });
      }
    }
  }

  return bets;
});
</script>

<style scoped>
.value-bets-card {
  padding: 24px;
}

.icon-inline {
  vertical-align: middle;
  margin-right: 8px;
}

.text-gold { color: var(--amber-gold); }
.text-cyan { color: var(--primary-cyan); }
.text-emerald { color: var(--emerald-green); }
.text-muted { color: var(--text-muted); }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.subtitle {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: 4px;
}

.ev-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.btn-filter {
  background: var(--bg-dark);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.btn-filter.active, .btn-filter:hover {
  border-color: var(--amber-gold);
  color: var(--amber-gold);
  background: rgba(245, 158, 11, 0.1);
}

.table-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.table-head {
  display: grid;
  grid-template-columns: 2fr 1.8fr 1fr 1fr 1fr 1.2fr 1.2fr;
  font-size: 0.75rem;
  color: var(--text-dim);
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  min-width: 800px;
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1.8fr 1fr 1fr 1fr 1.2fr 1.2fr;
  align-items: center;
  padding: 14px;
  background: var(--bg-dark);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  font-size: 0.85rem;
  min-width: 800px;
}

.match-info {
  display: flex;
  flex-direction: column;
}

.teams { font-weight: 700; color: var(--text-main); }
.date { font-size: 0.72rem; color: var(--text-dim); }

.pick-badge {
  background: rgba(245, 158, 11, 0.15);
  color: var(--amber-gold);
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 700;
}

.font-bold { font-weight: 800; }

.kelly-badge {
  background: rgba(16, 185, 129, 0.15);
  color: var(--emerald-green);
  padding: 4px 8px;
  border-radius: 4px;
}
</style>
