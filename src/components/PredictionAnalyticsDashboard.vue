<template>
  <div class="analytics-dashboard">
    <!-- Header Title & Filter Controls -->
    <div class="dashboard-header glass-panel">
      <div class="header-title-box">
        <div class="icon-badge font-mono text-cyan">
          <BarChart2 :size="24" />
          <span>STEP 32</span>
        </div>
        <div>
          <h2 class="section-title">Prediction Performance & League Analytics</h2>
          <p class="section-subtitle">
            Pre-kickoff prediction benchmarks evaluated strictly post-match (Zero temporal leakage). Minimum sample threshold <span class="font-mono text-cyan">N ≥ 100</span>.
          </p>
        </div>
      </div>

      <!-- Filter Controls Toolbar -->
      <div class="filter-toolbar font-heading">
        <div class="filter-group">
          <label class="filter-label"><Filter :size="14" /> Model Version</label>
          <select v-model="selectedModelVersion" class="select-input font-mono">
            <option value="football-ensemble-v2">football-ensemble-v2 (Production)</option>
            <option value="cold-start-v2">cold-start-v2 (Baseline)</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label"><Trophy :size="14" /> Competition Type</label>
          <select v-model="selectedCompetitionType" class="select-input font-mono">
            <option value="ALL">All Competitions</option>
            <option value="COMPETITIVE_LEAGUE">Competitive Leagues</option>
            <option value="FRIENDLY">International Club Friendlies</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label"><Database :size="14" /> Specific League</label>
          <select v-model="selectedLeagueId" class="select-input font-mono">
            <option value="ALL">All Leagues</option>
            <option value="ENG_PL">Premier League (England)</option>
            <option value="ESP_LALIGA">La Liga (Spain)</option>
            <option value="GER_BUNDESLIGA">Bundesliga (Germany)</option>
            <option value="ITA_SERIEA">Serie A (Italy)</option>
            <option value="FRA_LIGUE1">Ligue 1 (France)</option>
            <option value="AUS_CUP">Australia Cup (Australia)</option>
            <option value="AUS_ALEAGUE">Australia A-League (Australia)</option>
            <option value="CHN_CSL">Chinese Football Super League (China)</option>
            <option value="AFF_CHAMPIONSHIP">AFF Championship (Southeast Asia)</option>
            <option value="INT_FRIENDLY">International Club Friendly</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label"><Calendar :size="14" /> Season</label>
          <select v-model="selectedSeason" class="select-input font-mono">
            <option value="ALL">All Seasons</option>
            <option value="2024/25">2024/25</option>
            <option value="2023/24">2023/24</option>
            <option value="2022/23">2022/23</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label"><Clock :size="14" /> Time Window</label>
          <select v-model="selectedTimeWindow" class="select-input font-mono">
            <option value="ALL_TIME">All Time</option>
            <option value="LAST_90_DAYS">Last 90 Days</option>
            <option value="LAST_30_DAYS">Last 30 Days</option>
            <option value="LAST_7_DAYS">Last 7 Days</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Market Type Tabs Bar -->
    <div class="market-tabs-bar glass-panel">
      <button 
        v-for="mType in marketTypes" 
        :key="mType.id" 
        :class="['market-tab-btn', { active: selectedMarketType === mType.id }]"
        @click="selectedMarketType = mType.id"
      >
        <component :is="mType.icon" :size="16" />
        <span>{{ mType.label }}</span>
        <span class="market-stat-badge font-mono">{{ getMarketAccuracy(mType.id) }}</span>
      </button>
    </div>

    <!-- Friendly Isolation Warning Banner -->
    <div v-if="selectedCompetitionType === 'FRIENDLY'" class="warning-banner glass-panel font-mono">
      <AlertTriangle :size="18" class="text-warn" />
      <span><strong>Limited Sample Warning:</strong> International Club Friendly matches are kept isolated from competitive model training. Performance is for evaluation only.</span>
    </div>

    <!-- Top KPI Summary Cards -->
    <div class="kpi-grid">
      <!-- Best Calibrated League -->
      <div class="kpi-card glass-panel text-glow-cyan" v-if="analyticsPayload.kpiCards?.bestCalibratedLeague">
        <div class="kpi-top">
          <div class="kpi-icon-box bg-cyan-dim text-cyan">
            <Trophy :size="22" />
          </div>
          <span class="badge-status badge-success font-mono">BEST CALIBRATED</span>
        </div>
        <div class="kpi-body">
          <p class="kpi-label">Top Performing League (Log Loss)</p>
          <h3 class="kpi-value text-cyan">{{ analyticsPayload.kpiCards.bestCalibratedLeague.name }}</h3>
          <div class="kpi-metrics font-mono">
            <span>Log Loss: <strong>{{ analyticsPayload.kpiCards.bestCalibratedLeague.logLoss }}</strong></span>
            <span>Accuracy: <strong>{{ analyticsPayload.kpiCards.bestCalibratedLeague.accuracyPct }}</strong></span>
          </div>
        </div>
        <div class="kpi-footer font-mono text-muted">
          <span>↑ {{ analyticsPayload.kpiCards.bestCalibratedLeague.diffVsGlobal }} vs global avg</span>
        </div>
      </div>

      <!-- Highest Accuracy League -->
      <div class="kpi-card glass-panel" v-if="analyticsPayload.kpiCards?.highestAccuracyLeague">
        <div class="kpi-top">
          <div class="kpi-icon-box bg-emerald-dim text-emerald">
            <Target :size="22" />
          </div>
          <span class="badge-status badge-info font-mono">TOP ACCURACY</span>
        </div>
        <div class="kpi-body">
          <p class="kpi-label">Highest Accuracy League</p>
          <h3 class="kpi-value text-emerald">{{ analyticsPayload.kpiCards.highestAccuracyLeague.name }}</h3>
          <div class="kpi-metrics font-mono">
            <span>Accuracy: <strong>{{ analyticsPayload.kpiCards.highestAccuracyLeague.accuracyPct }}</strong></span>
            <span>Matches: <strong>{{ analyticsPayload.kpiCards.highestAccuracyLeague.predictions }}</strong></span>
          </div>
        </div>
        <div class="kpi-footer font-mono text-muted">
          <span>Log Loss: {{ analyticsPayload.kpiCards.highestAccuracyLeague.logLoss }}</span>
        </div>
      </div>

      <!-- Most Predictions League -->
      <div class="kpi-card glass-panel" v-if="analyticsPayload.kpiCards?.mostPredictionsLeague">
        <div class="kpi-top">
          <div class="kpi-icon-box bg-purple-dim text-purple">
            <Database :size="22" />
          </div>
          <span class="badge-status badge-purple font-mono">MOST DATA</span>
        </div>
        <div class="kpi-body">
          <p class="kpi-label">Largest Evaluated Dataset</p>
          <h3 class="kpi-value text-purple">{{ analyticsPayload.kpiCards.mostPredictionsLeague.name }}</h3>
          <div class="kpi-metrics font-mono">
            <span>Evaluated: <strong>N = {{ analyticsPayload.kpiCards.mostPredictionsLeague.predictions }}</strong></span>
            <span>Accuracy: <strong>{{ analyticsPayload.kpiCards.mostPredictionsLeague.accuracyPct }}</strong></span>
          </div>
        </div>
        <div class="kpi-footer font-mono text-muted">
          <span>Multi-Season Premier Dataset</span>
        </div>
      </div>

      <!-- Global System Summary -->
      <div class="kpi-card glass-panel" v-if="analyticsPayload.kpiCards?.globalSummary">
        <div class="kpi-top">
          <div class="kpi-icon-box bg-cyan-dim text-cyan">
            <Activity :size="22" />
          </div>
          <span class="badge-status badge-cyan font-mono">GLOBAL METRICS</span>
        </div>
        <div class="kpi-body">
          <p class="kpi-label">Global Prediction System</p>
          <h3 class="kpi-value font-mono text-cyan">{{ analyticsPayload.kpiCards.globalSummary.globalAccuracyPct }}</h3>
          <div class="kpi-metrics font-mono">
            <span>Log Loss: <strong>{{ analyticsPayload.kpiCards.globalSummary.globalLogLoss }}</strong></span>
            <span>Brier: <strong>{{ analyticsPayload.kpiCards.globalSummary.globalBrier }}</strong></span>
          </div>
        </div>
        <div class="kpi-footer font-mono text-muted">
          <span>Total Predictions: N = {{ analyticsPayload.kpiCards.globalSummary.totalPredictions }}</span>
        </div>
      </div>
    </div>

    <!-- Main Content Section: League Performance Leaderboard Table -->
    <div class="section-panel glass-panel">
      <div class="panel-header">
        <div>
          <h3 class="panel-title font-heading"><Trophy :size="18" class="text-cyan" /> League Performance Leaderboard</h3>
          <p class="panel-subtitle font-mono">Ranked primarily by Log Loss (lower is better). Minimum sample N ≥ 100 required for top status.</p>
        </div>
        <div class="panel-badge font-mono text-cyan">
          <span>{{ analyticsPayload.leaguePerformanceTable?.length || 0 }} LEAGUES</span>
        </div>
      </div>

      <div class="table-responsive">
        <table class="analytics-table font-heading">
          <thead>
            <tr>
              <th>League</th>
              <th class="text-right">Matches (N)</th>
              <th class="text-right">Accuracy % (95% CI)</th>
              <th class="text-right">Log Loss <span class="sort-indicator">▲</span></th>
              <th class="text-right">Brier Score</th>
              <th class="text-right">Calibration ECE</th>
              <th class="text-right">Avg Confidence</th>
              <th class="text-center">Sample Reliability</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lg in analyticsPayload.leaguePerformanceTable" :key="lg.leagueId" :class="{ 'insufficient-row': !lg.isSufficient }">
              <td class="font-bold">
                <div class="league-cell">
                  <span class="league-dot" :class="lg.isSufficient ? 'dot-cyan' : 'dot-warn'"></span>
                  <span>{{ lg.leagueName }}</span>
                </div>
              </td>
              <td class="text-right font-mono">{{ lg.matches }}</td>
              <td class="text-right">
                <div class="accuracy-cell font-mono">
                  <span class="acc-val text-emerald">{{ lg.accuracyPct }}%</span>
                  <span class="ci-val text-muted">({{ lg.ciText }})</span>
                </div>
              </td>
              <td class="text-right font-mono font-bold text-cyan">{{ lg.logLoss }}</td>
              <td class="text-right font-mono text-muted">{{ lg.brierScore }}</td>
              <td class="text-right font-mono text-muted">{{ lg.ece }}</td>
              <td class="text-right font-mono text-muted">{{ lg.avgConfidencePct }}%</td>
              <td class="text-center font-mono">
                <span :class="['badge-status', lg.isSufficient ? 'badge-success' : 'badge-warn']">
                  {{ lg.isSufficient ? 'N ≥ 100 VALID' : 'INSUFFICIENT (N < 100)' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Reliability Scatter/Bubble Chart Section -->
    <div class="section-panel glass-panel">
      <div class="panel-header">
        <div>
          <h3 class="panel-title font-heading"><TrendingUp :size="18" class="text-cyan" /> League Reliability Scatter Matrix</h3>
          <p class="panel-subtitle font-mono">X = Number of Predictions (N), Y = Log Loss (Lower = Better Calibration), Circle Size = Accuracy %.</p>
        </div>
      </div>

      <div class="chart-container">
        <svg class="scatter-svg" viewBox="0 0 800 320">
          <!-- Grid lines -->
          <line x1="60" y1="40" x2="760" y2="40" stroke="#334155" stroke-dasharray="4" />
          <line x1="60" y1="120" x2="760" y2="120" stroke="#334155" stroke-dasharray="4" />
          <line x1="60" y1="200" x2="760" y2="200" stroke="#334155" stroke-dasharray="4" />
          <line x1="60" y1="280" x2="760" y2="280" stroke="#475569" />

          <!-- Y Axis Labels -->
          <text x="50" y="45" fill="#94a3b8" font-size="11" text-anchor="end">0.90</text>
          <text x="50" y="125" fill="#94a3b8" font-size="11" text-anchor="end">0.95</text>
          <text x="50" y="205" fill="#94a3b8" font-size="11" text-anchor="end">1.00</text>
          <text x="50" y="285" fill="#94a3b8" font-size="11" text-anchor="end">1.05</text>

          <!-- N=100 Threshold Line -->
          <line x1="200" y1="20" x2="200" y2="280" stroke="#f59e0b" stroke-dasharray="6" opacity="0.6" />
          <text x="205" y="35" fill="#f59e0b" font-size="10" font-family="monospace">N = 100 THRESHOLD</text>

          <!-- Render League Circles -->
          <g v-for="(lg, idx) in analyticsPayload.leaguePerformanceTable" :key="lg.leagueId">
            <circle
              :cx="getScatterX(lg.matches)"
              :cy="getScatterY(parseFloat(lg.logLoss))"
              :r="getScatterRadius(parseFloat(lg.accuracyPct))"
              :fill="lg.isSufficient ? 'rgba(6, 182, 212, 0.4)' : 'rgba(245, 158, 11, 0.4)'"
              :stroke="lg.isSufficient ? '#06b6d4' : '#f59e0b'"
              stroke-width="2"
              class="scatter-circle"
            />
            <text
              :x="getScatterX(lg.matches)"
              :y="getScatterY(parseFloat(lg.logLoss)) - 14"
              fill="#e2e8f0"
              font-size="11"
              font-weight="bold"
              text-anchor="middle"
            >
              {{ lg.leagueName }} ({{ lg.accuracyPct }}%)
            </text>
          </g>
        </svg>
      </div>
    </div>

    <!-- Secondary Grids: Confidence Calibration & 1X2 Class Breakdown -->
    <div class="two-column-grid">
      <!-- Confidence Calibration Buckets -->
      <div class="section-panel glass-panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title font-heading"><BarChart :size="18" class="text-cyan" /> Confidence Bucket Calibration</h3>
            <p class="panel-subtitle font-mono">Expected vs Actual win frequencies by prediction confidence.</p>
          </div>
        </div>

        <table class="analytics-table font-heading">
          <thead>
            <tr>
              <th>Bucket</th>
              <th class="text-right">Matches</th>
              <th class="text-right">Actual Acc %</th>
              <th class="text-right">Avg Prob %</th>
              <th class="text-right">Calibration Δ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in analyticsPayload.confidenceBucketTable" :key="b.bucketLabel">
              <td class="font-bold font-mono text-cyan">{{ b.bucketLabel }}</td>
              <td class="text-right font-mono">{{ b.matches }}</td>
              <td class="text-right font-mono font-bold text-emerald">{{ b.accuracyPct }}</td>
              <td class="text-right font-mono text-muted">{{ b.avgPredictedProbPct }}</td>
              <td class="text-right font-mono" :class="parseFloat(b.calibrationDiffPct) >= 0 ? 'text-emerald' : 'text-rose'">
                {{ b.calibrationDiffPct }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 1X2 Class-Specific Performance -->
      <div class="section-panel glass-panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title font-heading"><PieChart :size="18" class="text-cyan" /> 1X2 Outcome Class Performance</h3>
            <p class="panel-subtitle font-mono">Performance breakdown for Home Win, Draw, and Away Win.</p>
          </div>
        </div>

        <table class="analytics-table font-heading">
          <thead>
            <tr>
              <th>Outcome</th>
              <th class="text-right">Predictions</th>
              <th class="text-right">Accuracy %</th>
              <th class="text-right">Avg Probability</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cs in analyticsPayload.classPerformanceTable" :key="cs.outcome">
              <td class="font-bold font-mono">{{ cs.outcome }}</td>
              <td class="text-right font-mono">{{ cs.predictions }}</td>
              <td class="text-right font-mono font-bold text-cyan">{{ cs.accuracyPct }}</td>
              <td class="text-right font-mono text-muted">{{ cs.avgProbabilityPct }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Actual vs Predicted Probability Distribution Matrix (Step 33) -->
        <div class="distribution-matrix-box font-mono" v-if="analyticsPayload.distributionMatrix">
          <p class="box-title font-heading"><Activity :size="15" class="text-cyan" /> Actual vs Predicted Outcome Distribution</p>
          <table class="analytics-table font-heading">
            <thead>
              <tr>
                <th>Outcome Class</th>
                <th class="text-right">Mean Predicted Prob %</th>
                <th class="text-right">Actual Frequency %</th>
                <th class="text-right">Argmax Frequency %</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in analyticsPayload.distributionMatrix" :key="row.outcome">
                <td class="font-bold font-mono">{{ row.outcome }}</td>
                <td class="text-right font-mono text-cyan">{{ row.avgPredictedProbPct }}</td>
                <td class="text-right font-mono font-bold text-emerald">{{ row.actualFrequencyPct }}</td>
                <td class="text-right font-mono text-muted" :class="{ 'text-rose': row.argmaxFrequencyPct === '0.0%' }">{{ row.argmaxFrequencyPct }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Model Version Side-by-Side Comparison -->
        <div class="model-compare-box font-mono" v-if="analyticsPayload.modelVersionComparison">
          <p class="box-title font-heading"><Cpu :size="15" /> Model Version Comparison (V1 vs V2)</p>
          <div class="compare-grid">
            <div class="compare-col">
              <span class="comp-label">cold-start-v2 (V1)</span>
              <span class="comp-val">Acc: {{ analyticsPayload.modelVersionComparison.v1.accuracyPct }}</span>
              <span class="comp-val text-muted">LogLoss: {{ analyticsPayload.modelVersionComparison.v1.logLoss }}</span>
            </div>
            <div class="compare-divider"></div>
            <div class="compare-col">
              <span class="comp-label text-cyan">football-ensemble-v2 (V2)</span>
              <span class="comp-val text-emerald">Acc: {{ analyticsPayload.modelVersionComparison.v2.accuracyPct }}</span>
              <span class="comp-val text-cyan">LogLoss: {{ analyticsPayload.modelVersionComparison.v2.logLoss }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { 
  BarChart2, Trophy, Target, Database, Activity, Filter, Calendar, Clock, 
  TrendingUp, BarChart, PieChart, Cpu, AlertTriangle 
} from 'lucide-vue-next';
import { PredictionAnalyticsService } from '../services/predictionAnalyticsService';
import { getHistoricalDataset } from '../services/historicalDataService';

const selectedModelVersion = ref('football-ensemble-v2');
const selectedCompetitionType = ref('ALL');
const selectedLeagueId = ref('ALL');
const selectedSeason = ref('ALL');
const selectedTimeWindow = ref('ALL_TIME');
const selectedMarketType = ref('1X2');

const datasetMatches = ref(getHistoricalDataset() || []);

onMounted(() => {
  if (datasetMatches.value.length === 0) {
    datasetMatches.value = getHistoricalDataset() || [];
  }
});

const marketTypes = [
  { id: '1X2', label: '1X2 Match Outcome', icon: Target },
  { id: 'OVER_UNDER_25', label: 'Over / Under 2.5', icon: TrendingUp },
  { id: 'BTTS', label: 'Both Teams To Score', icon: Activity }
];

const analyticsPayload = computed(() => {
  return PredictionAnalyticsService.generateAnalyticsPayload(datasetMatches.value, {
    modelVersion: selectedModelVersion.value,
    competitionType: selectedCompetitionType.value,
    leagueId: selectedLeagueId.value,
    season: selectedSeason.value,
    timeWindow: selectedTimeWindow.value,
    marketType: selectedMarketType.value
  });
});

function getMarketAccuracy(mTypeId) {
  if (!analyticsPayload.value.marketStats) return '0.0%';
  return analyticsPayload.value.marketStats[mTypeId]?.accuracyPct || '0.0%';
}

// Scatter SVG Plot Helpers
function getScatterX(matches) {
  const minM = 0;
  const maxM = 1200;
  const clamped = Math.max(minM, Math.min(maxM, matches));
  return 60 + (clamped / maxM) * 700;
}

function getScatterY(logLoss) {
  const minL = 0.90;
  const maxL = 1.05;
  const clamped = Math.max(minL, Math.min(maxL, logLoss));
  return 40 + ((clamped - minL) / (maxL - minL)) * 240;
}

function getScatterRadius(accuracyPct) {
  const r = (accuracyPct / 100) * 18;
  return Math.max(8, r);
}
</script>

<style scoped>
.analytics-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1rem;
}

.dashboard-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 12px;
}

.header-title-box {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.icon-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(6, 182, 212, 0.1);
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(6, 182, 212, 0.3);
}

.section-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #f8fafc;
  margin: 0;
}

.section-subtitle {
  font-size: 0.85rem;
  color: #94a3b8;
  margin: 0.25rem 0 0 0;
}

.filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.filter-label {
  font-size: 0.75rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.select-input {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(51, 65, 85, 0.8);
  color: #f8fafc;
  padding: 0.45rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  outline: none;
}

.select-input:focus {
  border-color: #06b6d4;
}

.warning-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #f59e0b;
  font-size: 0.85rem;
}

.text-warn {
  color: #f59e0b;
}

/* Market Tabs Bar */
.market-tabs-bar {
  display: flex;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 10px;
}

.market-tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.market-tab-btn.active {
  background: rgba(6, 182, 212, 0.15);
  color: #06b6d4;
  border: 1px solid rgba(6, 182, 212, 0.4);
}

.market-stat-badge {
  background: rgba(15, 23, 42, 0.6);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.kpi-card {
  padding: 1.1rem;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kpi-icon-box {
  padding: 0.5rem;
  border-radius: 8px;
}

.kpi-label {
  font-size: 0.75rem;
  color: #94a3b8;
  margin: 0;
}

.kpi-value {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0.25rem 0 0.5rem 0;
}

.kpi-metrics {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #cbd5e1;
}

.kpi-footer {
  font-size: 0.75rem;
  border-top: 1px dashed rgba(51, 65, 85, 0.6);
  padding-top: 0.5rem;
}

/* Section Panel */
.section-panel {
  padding: 1.25rem;
  border-radius: 12px;

}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.panel-title {
  font-size: 1.1rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #f8fafc;
}

.panel-subtitle {
  font-size: 0.8rem;
  color: #94a3b8;
  margin: 0.25rem 0 0 0;
}

/* Table Styling */
.table-responsive {
  overflow-x: auto;
}

.analytics-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.analytics-table th {
  background: rgba(15, 23, 42, 0.6);
  color: #94a3b8;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(51, 65, 85, 0.8);
}

.analytics-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(30, 41, 59, 0.6);
  color: #e2e8f0;
}

.insufficient-row {
  opacity: 0.65;
  background: rgba(245, 158, 11, 0.05);
}

.league-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.league-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-cyan { background: #06b6d4; box-shadow: 0 0 6px #06b6d4; }
.dot-warn { background: #f59e0b; }

.accuracy-cell {
  display: flex;
  flex-direction: column;
}

.ci-val {
  font-size: 0.75rem;
}

.badge-status {
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
}

.badge-success { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
.badge-warn { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
.badge-cyan { background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.3); }
.badge-info { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
.badge-purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); }

/* Scatter SVG */
.chart-container {
  width: 100%;
  overflow-x: auto;
}

.scatter-svg {
  width: 100%;
  height: 240px;
}

.scatter-circle {
  transition: all 0.3s ease;
  cursor: pointer;
}

.scatter-circle:hover {
  r: 16;
  fill-opacity: 0.8;
}

/* Two Column Grid */
.two-column-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 1.25rem;
}

.model-compare-box,
.distribution-matrix-box {
  margin-top: 1.25rem;
  background: rgba(15, 23, 42, 0.7);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid rgba(51, 65, 85, 0.6);
}

.box-title {
  font-size: 0.85rem;
  color: #f8fafc;
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.compare-grid {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.compare-col {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
}

.compare-divider {
  width: 1px;
  height: 40px;
  background: rgba(51, 65, 85, 0.8);
}
</style>
