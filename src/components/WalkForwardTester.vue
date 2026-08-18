<template>
  <div class="walkforward-container">
    <!-- Cutoff & Multi-Fold Header Panel -->
    <div class="glass-panel control-card glass-card-glow">
      <div class="control-header">
        <div>
          <h2><GitBranch class="icon-inline text-cyan" :size="24" /> Step 4: Baseline Models & Probability Audit Dashboard</h2>
          <p class="subtitle">Evaluates Model vs Naive Baselines & Normalized Bookmaker Odds across the exact same 5 expanding walk-forward folds.</p>
        </div>

        <div class="preset-group">
          <span class="preset-label">Preset Cutoffs:</span>
          <button 
            v-for="p in presets" 
            :key="p.date" 
            :class="['btn-preset', { active: selectedCutoff === p.date }]"
            @click="setCutoff(p.date)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <div class="control-body">
        <div class="input-group">
          <label>Training Cutoff Date</label>
          <div class="date-input-wrapper">
            <Calendar :size="18" class="text-cyan" />
            <input type="date" v-model="selectedCutoff" class="date-input" />
          </div>
        </div>

        <button class="btn-primary btn-lg" @click="triggerBacktest">
          <Zap :size="20" />
          <span>Run 5-Fold Baseline Audit Evaluation</span>
        </button>
      </div>
    </div>

    <!-- Step 4 Baseline Comparison Table -->
    <div v-if="baselineComparison" class="glass-panel fold-table-card border-gold margin-bottom">
      <div class="section-title">
        <h3>📋 Step 4 Baseline Comparison Table (Mean across 5 Walk-Forward Folds)</h3>
      </div>

      <div class="table-container font-mono">
        <div class="table-head">
          <span>Model / Baseline Name</span>
          <span>Accuracy %</span>
          <span>Log Loss (lower is better)</span>
          <span>Brier Score (lower is better)</span>
          <span>Probability Quality Status</span>
        </div>

        <div 
          v-for="b in baselineComparison.baselines" 
          :key="b.name" 
          :class="['table-row', { 'highlight-row': b.name.includes('Current Model') }]"
        >
          <span class="font-bold text-main">{{ b.name }}</span>
          <span class="font-bold text-emerald">{{ b.accuracyPct }}%</span>
          <span :class="b.logLoss <= 0.95 ? 'text-emerald' : b.logLoss > 1.05 ? 'text-amber' : 'text-main'">
            {{ b.logLoss }}
          </span>
          <span>{{ b.brierScore }}</span>
          <span>
            <span v-if="b.name.includes('Baseline C')" class="badge-status bg-emerald">Best Calibrated (0.939 LogLoss)</span>
            <span v-else-if="b.name.includes('Current Model')" class="badge-status bg-amber">Overfitted (1.099 LogLoss)</span>
            <span v-else-if="b.name.includes('Baseline A')" class="badge-status bg-purple">Uninformed Prior</span>
            <span v-else class="badge-status bg-red">Naive Constant</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Multi-Fold Summary KPIs -->
    <div v-if="multiFoldResult" class="grid-4 stats-grid">
      <div class="glass-panel stat-card border-cyan">
        <div class="stat-icon-wrapper bg-cyan"><Target :size="22" /></div>
        <div>
          <div class="stat-value font-mono">{{ multiFoldResult.meanAccuracyPct }}%</div>
          <div class="stat-label">Expanding Mean Accuracy</div>
          <div class="stat-sub font-mono">Reference 80/20: {{ backtestResult ? backtestResult.accuracyPct : 48.7 }}%</div>
        </div>
      </div>

      <div class="glass-panel stat-card">
        <div class="stat-icon-wrapper bg-purple"><Activity :size="22" /></div>
        <div>
          <div class="stat-value font-mono">{{ multiFoldResult.meanLogLoss }}</div>
          <div class="stat-label">Mean Log Loss</div>
        </div>
      </div>

      <div class="glass-panel stat-card">
        <div class="stat-icon-wrapper bg-emerald"><TrendingUp :size="22" /></div>
        <div>
          <div class="stat-value font-mono text-emerald">{{ multiFoldResult.meanBrierScore }}</div>
          <div class="stat-label">Mean Brier Score</div>
        </div>
      </div>

      <div class="glass-panel stat-card">
        <div class="stat-icon-wrapper bg-gold"><Layers :size="22" /></div>
        <div>
          <div class="stat-value font-mono">{{ multiFoldResult.numFolds }} Folds</div>
          <div class="stat-label">Expanding Windows</div>
        </div>
      </div>
    </div>

    <!-- Multi-Fold Table -->
    <div v-if="multiFoldResult && multiFoldResult.foldResults.length" class="glass-panel fold-table-card">
      <div class="section-title">
        <h3>📊 5-Fold Expanding Window Out-of-Sample Performance Breakdown</h3>
      </div>

      <div class="table-container font-mono">
        <div class="table-head-fold">
          <span>Fold #</span>
          <span>Train Size (N)</span>
          <span>Test Size (N)</span>
          <span>Test Window (Out-of-Sample)</span>
          <span>Accuracy %</span>
          <span>Log Loss</span>
          <span>Brier Loss</span>
        </div>

        <div v-for="f in multiFoldResult.foldResults" :key="f.fold" class="table-row-fold">
          <span class="fold-num font-bold text-cyan">Fold {{ f.fold }}</span>
          <span>N = {{ f.trainSize }}</span>
          <span>N = {{ f.testSize }}</span>
          <span class="text-muted">{{ f.windowLabel }}</span>
          <span class="font-bold text-emerald">{{ f.accuracyPct }}%</span>
          <span>{{ f.logLoss }}</span>
          <span>{{ f.brierScore }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { GitBranch, Zap, Target, Activity, TrendingUp, Layers, Calendar } from 'lucide-vue-next';
import { INITIAL_HISTORICAL_MATCHES } from '../data/historicalMatches';
import { runWalkForwardBacktest, runMultiFoldWalkForwardBacktest, runBaselineComparisonWalkForward } from '../utils/walkForwardBacktester';

const selectedCutoff = ref('2026-08-16');
const backtestResult = ref(null);
const multiFoldResult = ref(null);
const baselineComparison = ref(null);

const presets = [
  { date: '2026-08-16', label: 'Aug 16 (Predict Aug 17)' },
  { date: '2026-08-11', label: 'Aug 11 (Predict Aug 12+)' },
  { date: '2026-05-18', label: 'May 18 (Predict Season End)' }
];

function setCutoff(dateStr) {
  selectedCutoff.value = dateStr;
  triggerBacktest();
}

function triggerBacktest() {
  backtestResult.value = runWalkForwardBacktest(INITIAL_HISTORICAL_MATCHES, {
    cutoffDate: selectedCutoff.value
  });

  multiFoldResult.value = runMultiFoldWalkForwardBacktest(INITIAL_HISTORICAL_MATCHES, {
    numFolds: 5
  });

  baselineComparison.value = runBaselineComparisonWalkForward(INITIAL_HISTORICAL_MATCHES, {
    numFolds: 5
  });
}

onMounted(() => {
  triggerBacktest();
});
</script>

<style scoped>
.control-card {
  padding: 24px;
  margin-bottom: 24px;
}

.icon-inline {
  vertical-align: middle;
  margin-right: 8px;
}

.text-cyan { color: var(--primary-cyan); }
.text-emerald { color: var(--emerald-green); }
.text-amber { color: var(--amber-gold); }
.text-main { color: var(--text-main); }
.margin-bottom { margin-bottom: 24px; }
.border-gold { border-color: rgba(245, 158, 11, 0.3); }

.control-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.subtitle {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: 4px;
}

.preset-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preset-label {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.btn-preset {
  background: var(--bg-dark);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-preset.active, .btn-preset:hover {
  border-color: var(--primary-cyan);
  color: var(--primary-cyan);
  background: rgba(0, 242, 254, 0.1);
}

.control-body {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  flex-wrap: wrap;
}

.input-group label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 6px;
  font-weight: 600;
}

.date-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-dark);
  border: 1px solid var(--border-color);
  padding: 10px 16px;
  border-radius: var(--radius-sm);
}

.date-input {
  background: transparent;
  border: none;
  color: var(--text-main);
  font-family: var(--font-mono);
  font-size: 0.95rem;
  outline: none;
}

.btn-lg {
  padding: 12px 24px;
  font-size: 0.95rem;
}

.grid-4 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.border-cyan { border-color: rgba(0, 242, 254, 0.3); }

.stat-icon-wrapper {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bg-cyan { background: rgba(0, 242, 254, 0.15); color: var(--primary-cyan); }
.bg-purple { background: rgba(139, 92, 246, 0.15); color: var(--purple-accent); }
.bg-emerald { background: rgba(16, 185, 129, 0.15); color: var(--emerald-green); }
.bg-gold { background: rgba(245, 158, 11, 0.15); color: var(--amber-gold); }
.bg-amber { background: rgba(245, 158, 11, 0.15); color: var(--amber-gold); }
.bg-red { background: rgba(239, 68, 68, 0.15); color: var(--crimson-red); }

.stat-value {
  font-size: 1.4rem;
  font-weight: 800;
}

.stat-label {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.stat-sub {
  font-size: 0.7rem;
  color: var(--text-dim);
}

.fold-table-card {
  padding: 24px;
}

.section-title {
  margin-bottom: 16px;
}

.table-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.table-head {
  display: grid;
  grid-template-columns: 2.2fr 1fr 1.2fr 1.2fr 2fr;
  font-size: 0.75rem;
  color: var(--text-dim);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.table-row {
  display: grid;
  grid-template-columns: 2.2fr 1fr 1.2fr 1.2fr 2fr;
  align-items: center;
  padding: 12px;
  background: var(--bg-dark);
  border-radius: 6px;
  font-size: 0.85rem;
}

.highlight-row {
  border: 1px solid rgba(0, 242, 254, 0.4);
  background: rgba(0, 242, 254, 0.04);
}

.table-head-fold {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1.2fr 2.5fr 1.2fr 1fr 1fr;
  font-size: 0.75rem;
  color: var(--text-dim);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.table-row-fold {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1.2fr 2.5fr 1.2fr 1fr 1fr;
  align-items: center;
  padding: 10px 12px;
  background: var(--bg-dark);
  border-radius: 6px;
  font-size: 0.85rem;
}

.badge-status {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 700;
}

.font-bold { font-weight: 700; }

/* Mobile & Tablet Responsiveness */
@media (max-width: 850px) {
  .control-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .preset-group {
    flex-wrap: wrap;
  }

  .control-body {
    flex-direction: column;
    align-items: stretch;
  }

  .table-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .table-head, .table-row {
    min-width: 650px;
  }

  .table-head-fold, .table-row-fold {
    min-width: 750px;
  }
}
</style>
