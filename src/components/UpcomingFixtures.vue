<template>
  <div class="upcoming-container">
    <div class="glass-panel header-card glass-card-glow">
      <div class="header-content">
        <div>
          <h2><Calendar class="icon-inline text-cyan" :size="24" /> Major European Leagues — Real-Time Fixtures</h2>
          <p class="subtitle">Real upcoming & live match fixtures from official ESPN & public sports APIs. Zero mock data.</p>
        </div>

        <div class="header-actions">
          <div :class="['api-status-pill', isLiveApiAvailable ? 'online' : 'offline']">
            <span class="pulse-dot"></span>
            <span>API Status: <strong>{{ isLiveApiAvailable ? 'LIVE API ONLINE' : 'DATA UNAVAILABLE' }}</strong></span>
          </div>

          <button class="btn-primary btn-sm" @click="loadApiFixtures" :disabled="isLoadingApi">
            <RefreshCw :size="15" :class="{ 'spin-icon': isLoadingApi }" />
            <span>{{ isLoadingApi ? 'Fetching Live API...' : 'Sync Live Fixtures' }}</span>
          </button>
        </div>
      </div>

      <!-- Competition Filter Tabs -->
      <div class="league-filter-group font-mono">
        <button 
          v-for="(lg, key) in leagueOptions" 
          :key="key"
          :class="['btn-league', { active: selectedLeague === key }]"
          @click="selectedLeague = key"
        >
          <span>{{ lg.name }}</span>
        </button>
      </div>

      <!-- Date Filter Pills -->
      <div v-if="availableDates.length > 1" class="date-filter-group font-mono margin-top">
        <button 
          v-for="d in availableDates" 
          :key="d"
          :class="['btn-date', { active: selectedDate === d }]"
          @click="selectedDate = d"
        >
          {{ formatDisplayDate(d) }}
        </button>
      </div>
    </div>

    <!-- Fixtures Grouped by Date -->
    <div v-if="Object.keys(filteredFixturesByDate).length" class="fixtures-date-group">
      <div v-for="(group, dateKey) in filteredFixturesByDate" :key="dateKey" class="date-block">
        <div class="date-header">
          <Calendar :size="16" class="text-cyan" />
          <span class="date-title font-mono">{{ formatDisplayDate(dateKey) }}</span>
          <span class="match-count-badge">{{ group.length }} Real Live Matches</span>
        </div>

        <div class="grid-2">
          <div v-for="fix in group" :key="fix.fixtureId || fix.id" class="glass-panel fixture-card">
            <div class="fix-card-header">
              <span class="league-tag">{{ fix.league?.name || fix.league }}</span>
              <span class="live-api-tag font-mono">LIVE API</span>
              <span class="time-tag font-mono text-cyan">⏰ {{ formatTimeIST(fix.kickoffAt) }}</span>
            </div>

            <div class="matchup-row">
              <div class="team-col home">
                <img v-if="fix.homeTeam?.logo" :src="fix.homeTeam.logo" class="team-badge" alt="" />
                <span class="team-name">{{ fix.homeTeam?.name || fix.homeTeam }}</span>
              </div>

              <div class="vs-circle font-mono">VS</div>

              <div class="team-col away">
                <span class="team-name">{{ fix.awayTeam?.name || fix.awayTeam }}</span>
                <img v-if="fix.awayTeam?.logo" :src="fix.awayTeam.logo" class="team-badge" alt="" />
              </div>
            </div>

            <!-- Neutral Market Reference Data -->
            <div class="market-bar font-mono">
              <span v-if="fix.market && fix.market.home">
                Market Reference: <strong>H {{ fix.market.home }}</strong> | <strong>D {{ fix.market.draw }}</strong> | <strong>A {{ fix.market.away }}</strong>
                <em class="note-text">(Not used by model)</em>
              </span>
              <span v-else class="text-muted">
                Market Reference: Unavailable <em>(Not used by prediction engine)</em>
              </span>
            </div>

            <!-- PREDICT BUTTON -->
            <button class="btn-primary btn-predict" @click="openPredictionModal(fix)">
              <Sparkles :size="16" />
              <span>Predict Match Probability</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoadingApi" class="glass-panel empty-card font-mono">
      <Calendar :size="40" class="text-cyan" />
      <h4>No Upcoming Fixtures Available</h4>
      <p>Currently no live or scheduled fixtures found for the selected competition filter from ESPN/TheSportsDB APIs.</p>
    </div>

    <!-- Loading State -->
    <div v-else class="glass-panel empty-card font-mono">
      <RefreshCw :size="36" class="text-cyan spin-icon" />
      <h4>Fetching Live Major League Fixtures...</h4>
      <p>Connecting to ESPN Scoreboards and live sports APIs for real competition schedules.</p>
    </div>

    <!-- PREDICTION RESULT MODAL -->
    <div v-if="selectedFixtureModal" class="modal-backdrop" @click.self="selectedFixtureModal = null">
      <div class="glass-panel modal-card glass-card-glow">
        <div class="modal-header">
          <div class="modal-title-box">
            <Sparkles class="text-cyan" :size="22" />
            <div>
              <h3>Match Probability Output</h3>
              <span class="sub-text font-mono">Model Version: <strong>football-ensemble-v1</strong></span>
            </div>
          </div>
          <button class="close-btn" @click="selectedFixtureModal = null"><X :size="20" /></button>
        </div>

        <div v-if="activePrediction" class="modal-body">
          <div class="modal-matchup">
            <div class="m-team home">
              <span class="t font-heading">{{ selectedFixtureModal.homeTeam?.name || selectedFixtureModal.homeTeam }}</span>
            </div>
            <div class="m-vs font-mono">VS</div>
            <div class="m-team away">
              <span class="t font-heading">{{ selectedFixtureModal.awayTeam?.name || selectedFixtureModal.awayTeam }}</span>
            </div>
          </div>

          <!-- Outcome Probabilities Display -->
          <div class="prob-grid font-mono">
            <div :class="['p-box', { highlight: activePrediction.predictedOutcome === 'Home' }]">
              <span class="p-title">Home Win</span>
              <span class="p-val text-cyan">{{ (activePrediction.probabilities.home * 100).toFixed(1) }}%</span>
            </div>
            <div :class="['p-box', { highlight: activePrediction.predictedOutcome === 'Draw' }]">
              <span class="p-title">Draw</span>
              <span class="p-val text-cyan">{{ (activePrediction.probabilities.draw * 100).toFixed(1) }}%</span>
            </div>
            <div :class="['p-box', { highlight: activePrediction.predictedOutcome === 'Away' }]">
              <span class="p-title">Away Win</span>
              <span class="p-val text-cyan">{{ (activePrediction.probabilities.away * 100).toFixed(1) }}%</span>
            </div>
          </div>

          <!-- Goal Expectancy & Market Probabilities Section (Step 31/33) -->
          <div class="goal-markets-card font-mono" v-if="activePrediction.expectedGoals">
            <h4 class="breakdown-title text-cyan"><Activity :size="16" /> Expected Goals (xG) & Goal Market Probabilities</h4>
            <div class="goal-stats-grid">
              <!-- Expected Goals (xG) & Scoreline -->
              <div class="g-stat-box">
                <span class="g-label">Expected Team Goals (xG)</span>
                <div class="xg-row">
                  <span class="xg-val text-cyan">{{ selectedFixtureModal.homeTeam?.name || 'Home' }}: <strong>{{ activePrediction.expectedGoals.home }}</strong></span>
                  <span class="xg-val text-cyan">{{ selectedFixtureModal.awayTeam?.name || 'Away' }}: <strong>{{ activePrediction.expectedGoals.away }}</strong></span>
                </div>
                <div class="most-likely-score" v-if="activePrediction.mostLikelyScore">
                  <span>Most Likely Scoreline: <strong class="text-emerald">{{ activePrediction.mostLikelyScore.home }} - {{ activePrediction.mostLikelyScore.away }}</strong> ({{ (activePrediction.mostLikelyScore.prob * 100).toFixed(1) }}%)</span>
                </div>
              </div>

              <!-- Over / Under 1.5, 2.5, 3.5 & BTTS -->
              <div class="g-market-chips" v-if="activePrediction.overUnder">
                <div class="chip-item">
                  <span class="chip-label">Over 1.5 Goals:</span>
                  <span class="chip-val text-emerald">{{ (activePrediction.overUnder.over15 * 100).toFixed(1) }}%</span>
                </div>
                <div class="chip-item highlight-chip">
                  <span class="chip-label">Over 2.5 Goals:</span>
                  <span class="chip-val text-cyan font-bold">{{ (activePrediction.overUnder.over25 * 100).toFixed(1) }}%</span>
                </div>
                <div class="chip-item">
                  <span class="chip-label">Over 3.5 Goals:</span>
                  <span class="chip-val text-muted">{{ (activePrediction.overUnder.over35 * 100).toFixed(1) }}%</span>
                </div>
                <div class="chip-item highlight-chip" v-if="activePrediction.btts">
                  <span class="chip-label">Both Teams To Score (BTTS):</span>
                  <span class="chip-val text-emerald font-bold">{{ (activePrediction.btts.yes * 100).toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Component Model Breakdown -->
          <div class="component-breakdown font-mono">
            <h4 class="breakdown-title">📊 Component Model Breakdown (50/50 Ensemble)</h4>
            <div class="breakdown-grid">
              <div class="b-card">
                <span class="b-title">CatBoost Tree Model (50%)</span>
                <span>Home: {{ (activePrediction.components.catboost.home * 100).toFixed(1) }}% | Draw: {{ (activePrediction.components.catboost.draw * 100).toFixed(1) }}% | Away: {{ (activePrediction.components.catboost.away * 100).toFixed(1) }}%</span>
              </div>
              <div class="b-card">
                <span class="b-title">Dixon-Coles Goal Model (50%)</span>
                <span>Home: {{ (activePrediction.components.dixonColes.home * 100).toFixed(1) }}% | Draw: {{ (activePrediction.components.dixonColes.draw * 100).toFixed(1) }}% | Away: {{ (activePrediction.components.dixonColes.away * 100).toFixed(1) }}%</span>
              </div>
            </div>
          </div>

          <!-- Neutral Market Reference -->
          <div class="market-ref-card font-mono">
            <span class="lbl">Market Reference (Neutral Bookmaker Odds):</span>
            <div class="market-odds-row" v-if="selectedFixtureModal.market && selectedFixtureModal.market.home">
              <span>Bookmaker Odds: H {{ selectedFixtureModal.market.home }} | D {{ selectedFixtureModal.market.draw }} | A {{ selectedFixtureModal.market.away }}</span>
            </div>
            <div v-else class="text-muted">Market Reference: Unavailable</div>
            <div class="disclaimer-text">ℹ️ Market reference data is displayed for reference only and is <strong>NEVER used by football-ensemble-v1</strong>.</div>
          </div>

          <div class="modal-actions">
            <button class="btn-primary" @click="selectedFixtureModal = null">Close Prediction</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Calendar, Sparkles, X, RefreshCw, Activity } from 'lucide-vue-next';
import { LiveFixtureService } from '../services/liveFixtureService';
import { HistoricalMatchService } from '../services/historicalMatchService';
import { predictMatch } from '../utils/predictionEngine';
import { SUPPORTED_LEAGUES } from '../utils/fixtureNormalizer';

const selectedLeague = ref('ALL');
const selectedDate = ref('ALL');
const selectedFixtureModal = ref(null);
const activePrediction = ref(null);

const isLoadingApi = ref(false);
const isLiveApiAvailable = ref(true);
const apiFixtures = ref([]);
const historicalDataset = ref([]);

const leagueOptions = computed(() => ({
  'ALL': { name: 'All Major Leagues' },
  ...SUPPORTED_LEAGUES
}));

const filteredFixtures = computed(() => {
  return LiveFixtureService.filterByLeague(apiFixtures.value, selectedLeague.value);
});

function getISTDateString(isoStr) {
  if (!isoStr) return '2026-08-18';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '2026-08-18';
  const istDate = new Date(d.getTime() + (5.5 * 3600 * 1000));
  const yyyy = istDate.getUTCFullYear();
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const availableDates = computed(() => {
  const dates = new Set(filteredFixtures.value.map(f => {
    return getISTDateString(f.kickoffAt);
  }));
  return ['ALL', ...Array.from(dates).sort()];
});

const filteredFixturesByDate = computed(() => {
  const groups = {};

  for (const fix of filteredFixtures.value) {
    const dStr = getISTDateString(fix.kickoffAt);
    if (selectedDate.value !== 'ALL' && dStr !== selectedDate.value) continue;

    if (!groups[dStr]) groups[dStr] = [];
    groups[dStr].push(fix);
  }

  return groups;
});

onMounted(async () => {
  historicalDataset.value = await HistoricalMatchService.loadHistoricalMatches();
  await loadApiFixtures();
});

async function loadApiFixtures() {
  isLoadingApi.value = true;
  try {
    const res = await LiveFixtureService.fetchUpcomingFixtures({ leagueKey: selectedLeague.value });
    apiFixtures.value = res.fixtures;
    isLiveApiAvailable.value = res.isLiveApiAvailable;
  } catch (err) {
    console.error('Error fetching live fixtures:', err);
    isLiveApiAvailable.value = false;
  } finally {
    isLoadingApi.value = false;
  }
}

function openPredictionModal(fix) {
  selectedFixtureModal.value = fix;
  const homeName = fix.homeTeam?.name || fix.homeTeam;
  const awayName = fix.awayTeam?.name || fix.awayTeam;

  activePrediction.value = predictMatch({
    homeTeam: homeName,
    awayTeam: awayName,
    kickoffAt: fix.kickoffAt,
    historicalMatches: historicalDataset.value
  });
}

function formatTimeIST(isoStr) {
  if (!isoStr) return '07:30 PM IST';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '07:30 PM IST';
  
  // Add 5.5 hours for IST
  const istDate = new Date(d.getTime() + (5.5 * 3600 * 1000));
  let hours = istDate.getUTCHours();
  const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm} IST`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr || dateStr === 'ALL') return 'All Dates (IST)';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const yyyy = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10) - 1;
    const dd = parseInt(parts[2], 10);
    const d = new Date(Date.UTC(yyyy, mm, dd));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  return dateStr;
}
</script>

<style scoped>
.upcoming-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header-card {
  padding: 20px 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.api-status-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-family: var(--font-mono);
}

.api-status-pill.online {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.api-status-pill.offline {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.league-filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: rgba(7, 11, 18, 0.6);
  padding: 6px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.btn-league {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-league:hover {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.05);
}

.btn-league.active {
  background: var(--bg-panel);
  color: var(--primary-cyan);
  border: 1px solid rgba(0, 242, 254, 0.3);
  box-shadow: 0 0 10px rgba(0, 242, 254, 0.1);
}

.date-filter-group {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  flex-wrap: wrap;
  padding: 4px 0;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

.btn-date {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.btn-date:hover {
  background: rgba(0, 242, 254, 0.08);
  border-color: rgba(0, 242, 254, 0.3);
  color: #e2e8f0;
}

.btn-date.active {
  background: rgba(0, 242, 254, 0.15);
  color: var(--primary-cyan);
  border-color: var(--primary-cyan);
  box-shadow: 0 0 8px rgba(0, 242, 254, 0.2);
}

.date-block {
  margin-bottom: 24px;
}

.date-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding-left: 4px;
}

.match-count-badge {
  background: rgba(0, 242, 254, 0.1);
  color: var(--primary-cyan);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-family: var(--font-mono);
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.fixture-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fix-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
}

.league-tag {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 8px;
  border-radius: 4px;
}

.live-api-tag {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
}

.time-tag {
  margin-left: auto;
}

.matchup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
}

.team-col {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.team-col.home { justify-content: flex-end; }
.team-col.away { justify-content: flex-start; }

.team-badge {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.team-name {
  font-weight: 700;
  font-size: 1rem;
}

.vs-circle {
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border-color);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.market-bar {
  background: rgba(7, 11, 18, 0.5);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.78rem;
  color: var(--text-muted);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.note-text {
  color: rgba(255, 255, 255, 0.4);
  margin-left: 6px;
}

.btn-predict {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
}

.empty-card {
  padding: 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 12px;
  color: var(--text-muted);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  width: 100%;
  max-width: 620px;
  padding: 24px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 14px;
  margin-bottom: 18px;
}

.modal-title-box {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sub-text {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.modal-matchup {
  display: flex;
  align-items: center;
  justify-content: space-around;
  font-size: 1.2rem;
  background: rgba(15, 23, 42, 0.5);
  padding: 12px;
  border-radius: 8px;
}

.prob-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.p-box {
  background: rgba(7, 11, 18, 0.6);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.p-box.highlight {
  border-color: var(--primary-cyan);
  background: rgba(0, 242, 254, 0.1);
}

.p-title { font-size: 0.8rem; color: var(--text-muted); }
.p-val { font-size: 1.6rem; font-weight: 800; }

.component-breakdown,
.goal-markets-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 14px;
}

.goal-stats-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.g-stat-box {
  background: rgba(7, 11, 18, 0.5);
  padding: 10px 14px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.g-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.xg-row {
  display: flex;
  justify-content: space-around;
  font-size: 0.9rem;
}

.most-likely-score {
  border-top: 1px dashed rgba(51, 65, 85, 0.6);
  padding-top: 6px;
  font-size: 0.8rem;
  text-align: center;
}

.g-market-chips {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.chip-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(7, 11, 18, 0.5);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
}

.highlight-chip {
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.3);
}

.breakdown-title {
  font-size: 0.85rem;
  margin-bottom: 10px;
}

.breakdown-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.8rem;
}

.b-card {
  display: flex;
  justify-content: space-between;
  background: rgba(7, 11, 18, 0.5);
  padding: 8px 12px;
  border-radius: 6px;
}

.market-ref-card {
  background: rgba(7, 11, 18, 0.6);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  font-size: 0.82rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.disclaimer-text {
  font-size: 0.72rem;
  color: var(--text-muted);
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
  padding-top: 6px;
}

/* Mobile & Tablet Responsiveness */
@media (max-width: 900px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 12px;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .league-filter-group,
  .date-filter-group {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    padding: 6px 2px;
    gap: 6px;
    scrollbar-width: none;
  }

  .league-filter-group::-webkit-scrollbar,
  .date-filter-group::-webkit-scrollbar {
    display: none;
  }

  .btn-league,
  .btn-date {
    flex-shrink: 0;
    min-height: 38px;
    padding: 8px 14px;
    font-size: 0.85rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .modal-card {
    padding: 16px;
    max-height: 92vh;
    overflow-y: auto;
  }

  .b-card {
    flex-direction: column;
    gap: 4px;
  }
}

@media (max-width: 500px) {
  .prob-grid {
    grid-template-columns: 1fr;
  }

  .matchup-row {
    flex-direction: column;
    gap: 10px;
  }

  .team-col.home, .team-col.away {
    justify-content: center;
  }

  .vs-circle {
    margin: 4px 0;
  }
}
</style>
