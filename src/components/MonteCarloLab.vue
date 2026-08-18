<template>
  <div class="monte-carlo-lab">
    <div class="glass-panel lab-card glass-card-glow">
      <div class="lab-header">
        <div>
          <h2><Cpu class="text-cyan icon-inline" :size="24" /> 10,000 Monte Carlo Match Simulator Laboratory</h2>
          <p class="subtitle">Tune match factors live and execute 10,000 statistical simulation iterations to generate score distributions and match narratives.</p>
        </div>
      </div>

      <!-- Controls Row -->
      <div class="sim-controls">
        <div class="control-col">
          <label>Home Team</label>
          <select v-model="homeTeam" class="select-input">
            <option v-for="t in teams" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="control-col">
          <label>Away Team</label>
          <select v-model="awayTeam" class="select-input">
            <option v-for="t in teams" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="control-col">
          <label>Home Advantage Boost (+xG)</label>
          <input type="range" min="0.0" max="0.8" step="0.05" v-model.number="homeAdv" class="slider-input" />
          <span class="val-tag font-mono">+{{ homeAdv }} goals</span>
        </div>

        <div class="control-col">
          <label>Weather Condition</label>
          <select v-model.number="weatherFactor" class="select-input">
            <option :value="1.0">☀️ Ideal / Clear (1.0x)</option>
            <option :value="0.9">🌧️ Moderate Rain (0.9x)</option>
            <option :value="0.75">❄️ Heavy Snow (0.75x)</option>
          </select>
        </div>

        <button class="btn-primary btn-sim" @click="runSimulation">
          <Play :size="18" />
          <span>Run 10,000 Simulations</span>
        </button>
      </div>
    </div>

    <!-- Simulation Results -->
    <div v-if="simResult" class="grid-2 sim-results-grid">
      <!-- Probabilities & Score Heatmap -->
      <div class="glass-panel result-card">
        <h3>Simulation Outcome Probabilities (10,000 Runs)</h3>

        <div class="prob-summary-row">
          <div class="prob-box home-bg">
            <div class="prob-val font-mono">{{ simResult.homeWinPct }}%</div>
            <div class="prob-label">{{ simResult.homeTeam }} Win</div>
          </div>
          <div class="prob-box draw-bg">
            <div class="prob-val font-mono">{{ simResult.drawPct }}%</div>
            <div class="prob-label">Draw</div>
          </div>
          <div class="prob-box away-bg">
            <div class="prob-val font-mono">{{ simResult.awayWinPct }}%</div>
            <div class="prob-label">{{ simResult.awayTeam }} Win</div>
          </div>
        </div>

        <!-- Heatmap Grid (Home goals 0..6 vs Away goals 0..6) -->
        <div class="heatmap-wrapper">
          <div class="heatmap-title">Scoreline Probability Matrix Heatmap (Home ↓ vs Away →)</div>
          
          <div class="heatmap-grid">
            <template v-for="(row, i) in simResult.grid" :key="i">
              <div 
                v-for="(cell, j) in row" 
                :key="`${i}-${j}`"
                class="heatmap-cell font-mono"
                :style="{ backgroundColor: getHeatmapBg(cell.pct) }"
              >
                <span>{{ cell.homeGoals }}-{{ cell.awayGoals }}</span>
                <span class="cell-pct">{{ cell.pct }}%</span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Match Timeline Event Narrative -->
      <div class="glass-panel result-card">
        <h3>Simulated Match Narrative Storyline</h3>
        <p class="subtitle-sm">Sample Match Event Log from Iteration #{{ Math.floor(Math.random() * 9000) + 1000 }}</p>

        <div class="timeline-log font-mono">
          <div v-for="(evt, idx) in simResult.eventLog" :key="idx" class="log-item">
            <span class="minute-badge">{{ evt.minute }}'</span>
            <span class="event-desc">{{ evt.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Cpu, Play } from 'lucide-vue-next';
import { INITIAL_HISTORICAL_MATCHES } from '../data/historicalMatches';
import { runMonteCarloSimulation } from '../utils/monteCarlo';

const teams = ['Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Tottenham', 'Real Madrid', 'Bayern Munich', 'Newcastle'];
const homeTeam = ref('Arsenal');
const awayTeam = ref('Chelsea');
const homeAdv = ref(0.35);
const weatherFactor = ref(1.0);

const simResult = ref(null);

function runSimulation() {
  simResult.value = runMonteCarloSimulation(
    homeTeam.value,
    awayTeam.value,
    1.85, // base Home xG
    1.15, // base Away xG
    {
      iterations: 10000,
      homeAdvantageBoost: homeAdv.value,
      weatherFactor: weatherFactor.value
    }
  );
}

function getHeatmapBg(pct) {
  if (pct > 10) return 'rgba(0, 242, 254, 0.45)';
  if (pct > 5) return 'rgba(0, 242, 254, 0.25)';
  if (pct > 2) return 'rgba(0, 242, 254, 0.12)';
  return 'rgba(255, 255, 255, 0.03)';
}

onMounted(() => {
  runSimulation();
});
</script>

<style scoped>
.lab-card {
  padding: 24px;
  margin-bottom: 24px;
}

.icon-inline {
  vertical-align: middle;
  margin-right: 8px;
}

.text-cyan { color: var(--primary-cyan); }

.subtitle {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: 4px;
}

.sim-controls {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.control-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.control-col label {
  font-size: 0.78rem;
  color: var(--text-muted);
  font-weight: 600;
}

.select-input {
  background: var(--bg-dark);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-family: var(--font-heading);
  outline: none;
}

.slider-input {
  accent-color: var(--primary-cyan);
}

.val-tag {
  font-size: 0.75rem;
  color: var(--primary-cyan);
}

.btn-sim {
  padding: 11px 24px;
}

.sim-results-grid {
  margin-top: 24px;
}

.result-card {
  padding: 24px;
}

.prob-summary-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 16px 0 24px 0;
}

.prob-box {
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}

.home-bg { background: rgba(0, 242, 254, 0.15); border: 1px solid rgba(0, 242, 254, 0.3); }
.draw-bg { background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); }
.away-bg { background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); }

.prob-val {
  font-size: 1.5rem;
  font-weight: 800;
}

.prob-label {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.heatmap-title {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.heatmap-cell {
  background: rgba(255, 255, 255, 0.03);
  padding: 8px 4px;
}

.cell-pct {
  font-size: 0.65rem;
  color: var(--text-muted);
}

.subtitle-sm {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.timeline-log {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-dark);
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  font-size: 0.85rem;
}

.minute-badge {
  background: rgba(0, 242, 254, 0.15);
  color: var(--primary-cyan);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 700;
}

/* Mobile & Tablet Responsiveness */
@media (max-width: 768px) {
  .control-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .control-col {
    width: 100%;
  }

  .prob-summary-row {
    grid-template-columns: 1fr;
  }

  .heatmap-grid {
    gap: 2px;
  }

  .heatmap-cell {
    padding: 4px 2px;
    font-size: 0.65rem;
  }
}
</style>
