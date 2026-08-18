<template>
  <div class="dashboard-overview">
    <!-- Top KPI Cards -->
    <div class="grid-4 kpi-row">
      <div class="glass-panel kpi-card">
        <div class="kpi-icon text-cyan"><Activity :size="24" /></div>
        <div>
          <div class="kpi-title">Model Status</div>
          <div class="kpi-value text-emerald">football-ensemble-v1</div>
          <div class="kpi-sub">50% CatBoost + 50% Dixon-Coles</div>
        </div>
      </div>

      <div class="glass-panel kpi-card">
        <div class="kpi-icon text-gold"><TrendingUp :size="24" /></div>
        <div>
          <div class="kpi-title">Probabilistic Engine</div>
          <div class="kpi-value text-gold">Pure Probability</div>
          <div class="kpi-sub">No Automatic Betting Layer</div>
        </div>
      </div>

      <div class="glass-panel kpi-card">
        <div class="kpi-icon text-purple"><ShieldCheck :size="24" /></div>
        <div>
          <div class="kpi-title">Walk-Forward Accuracy</div>
          <div class="kpi-value font-mono">53.9%</div>
          <div class="kpi-sub">OOS Log Loss: 0.965</div>
        </div>
      </div>

      <div class="glass-panel kpi-card">
        <div class="kpi-icon text-blue"><Layers :size="24" /></div>
        <div>
          <div class="kpi-title">Historical Records</div>
          <div class="kpi-value font-mono">{{ matches.length }} Matches</div>
          <div class="kpi-sub">Multi-Season Database</div>
        </div>
      </div>
    </div>

    <!-- Main Content Split -->
    <div class="grid-2 main-split">
      <!-- Live Fixtures & Predictions -->
      <div class="glass-panel section-card">
        <div class="section-header">
          <h3><Sparkles class="text-cyan" :size="20" /> Upcoming Match Predictions</h3>
          <span class="badge-live">LIVE MODEL</span>
        </div>

        <div class="upcoming-list">
          <div v-for="fix in upcomingPredictions" :key="fix.id" class="fixture-item">
            <div class="fix-header">
              <span class="league font-mono">{{ fix.league }} • {{ fix.date }}</span>
              <span class="score-pred font-mono text-cyan">Pred: {{ fix.predictedScore }}</span>
            </div>

            <div class="teams-versus">
              <span class="team-name">{{ fix.homeTeam }}</span>
              <span class="vs font-mono">VS</span>
              <span class="team-name">{{ fix.awayTeam }}</span>
            </div>

            <div class="prob-bars">
              <div class="prob-fill home" :style="{ width: fix.homeProb + '%' }">
                <span>{{ fix.homeTeam }}: {{ fix.homeProb }}%</span>
              </div>
              <div class="prob-fill draw" :style="{ width: fix.drawProb + '%' }">
                <span>Draw: {{ fix.drawProb }}%</span>
              </div>
              <div class="prob-fill away" :style="{ width: fix.awayProb + '%' }">
                <span>{{ fix.awayTeam }}: {{ fix.awayProb }}%</span>
              </div>
            </div>

            <div class="odds-row font-mono">
              <span>Market Reference: <strong>H {{ fix.B365H }}</strong> | <strong>D {{ fix.B365D }}</strong> | <strong>A {{ fix.B365A }}</strong></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Elo Team Rankings & Power Ratings -->
      <div class="glass-panel section-card">
        <div class="section-header">
          <h3><Award class="text-gold" :size="20" /> Team Elo & Power Ratings</h3>
          <span class="subtitle-sm">Dynamic Rating Matrix</span>
        </div>

        <div class="rankings-table">
          <div class="table-head font-mono">
            <span>Rank</span>
            <span>Team</span>
            <span>Elo Rating</span>
            <span>Attack Factor ($\alpha$)</span>
            <span>Defense Factor ($\beta$)</span>
          </div>

          <div v-for="(t, idx) in sortedTeams" :key="t.name" class="table-row">
            <span class="rank-num font-mono">#{{ idx + 1 }}</span>
            <span class="team-name font-mono">{{ t.name }}</span>
            <span class="elo-val font-mono text-cyan">{{ t.elo }}</span>
            <span class="stat-val font-mono">{{ t.attack }}</span>
            <span class="stat-val font-mono">{{ t.defense }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Activity, TrendingUp, ShieldCheck, Layers, Sparkles, Award } from 'lucide-vue-next';
import { INITIAL_HISTORICAL_MATCHES, UPCOMING_FIXTURES } from '../data/historicalMatches';
import { computeEloDatabase } from '../utils/eloEngine';
import { trainDixonColesModel, predictMatchDixonColes } from '../utils/dixonColes';

const matches = INITIAL_HISTORICAL_MATCHES;

const eloDb = computed(() => computeEloDatabase(matches));
const dixonModel = computed(() => trainDixonColesModel(matches));

const sortedTeams = computed(() => {
  const teams = Object.keys(eloDb.value).map(name => ({
    name,
    elo: eloDb.value[name],
    attack: (dixonModel.value.teamParameters[name] || { attack: 1.0 }).attack,
    defense: (dixonModel.value.teamParameters[name] || { defense: 1.0 }).defense
  }));

  teams.sort((a, b) => b.elo - a.elo);
  return teams;
});

const upcomingPredictions = computed(() => {
  return UPCOMING_FIXTURES.map(fix => {
    const eloDiff = (eloDb.value[fix.homeTeam] || 1500) - (eloDb.value[fix.awayTeam] || 1500);
    const pred = predictMatchDixonColes(fix.homeTeam, fix.awayTeam, dixonModel.value, { eloDiff });

    const homeProbPct = Math.round(pred.homeWinProb * 100);
    const drawProbPct = Math.round(pred.drawProb * 100);
    const awayProbPct = Math.round(pred.awayWinProb * 100);

    const evH = (pred.homeWinProb * fix.B365H) - 1;
    const evD = (pred.drawProb * fix.B365D) - 1;
    const evA = (pred.awayWinProb * fix.B365A) - 1;
    const bestEV = Math.max(evH, evD, evA);

    return {
      ...fix,
      predictedScore: `${pred.mostLikelyScore.home}-${pred.mostLikelyScore.away}`,
      homeProb: homeProbPct,
      drawProb: drawProbPct,
      awayProb: awayProbPct,
      bestEV
    };
  });
});
</script>

<style scoped>
.kpi-row {
  margin-bottom: 24px;
}

.kpi-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.kpi-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--bg-dark);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.text-cyan { color: var(--primary-cyan); }
.text-gold { color: var(--amber-gold); }
.text-purple { color: var(--purple-accent); }
.text-blue { color: var(--primary-blue); }
.text-emerald { color: var(--emerald-green); }

.kpi-title {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.kpi-value {
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1.2;
}

.kpi-sub {
  font-size: 0.72rem;
  color: var(--text-dim);
}

.main-split {
  margin-top: 24px;
}

.section-card {
  padding: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.badge-live {
  background: rgba(16, 185, 129, 0.15);
  color: var(--emerald-green);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.subtitle-sm {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.upcoming-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fixture-item {
  background: var(--bg-dark);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
}

.fix-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.teams-versus {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.team-name {
  font-size: 1.05rem;
  font-weight: 700;
}

.vs {
  font-size: 0.75rem;
  color: var(--text-dim);
}

.prob-bars {
  display: flex;
  height: 22px;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 12px;
  font-size: 0.72rem;
  font-weight: 700;
}

.prob-fill {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  white-space: nowrap;
}

.prob-fill.home { background: var(--primary-cyan); color: #040914; }
.prob-fill.draw { background: var(--amber-gold); color: #040914; }
.prob-fill.away { background: var(--purple-accent); color: #ffffff; }

.odds-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.rankings-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.table-head {
  display: grid;
  grid-template-columns: 0.6fr 2fr 1.2fr 1.2fr 1.2fr;
  font-size: 0.75rem;
  color: var(--text-dim);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.table-row {
  display: grid;
  grid-template-columns: 0.6fr 2fr 1.2fr 1.2fr 1.2fr;
  align-items: center;
  padding: 10px 12px;
  background: var(--bg-dark);
  border-radius: 6px;
  font-size: 0.85rem;
}

.rank-num {
  font-weight: 700;
  color: var(--text-muted);
}

.elo-val {
  font-weight: 800;
}

/* Mobile & Tablet Responsiveness */
@media (max-width: 900px) {
  .main-split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .rankings-table {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .table-head, .table-row {
    min-width: 500px;
  }
}

@media (max-width: 480px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>
