import { HistoricalDataService } from '../src/services/historicalDataService.js';
import { routeMatchPrediction } from '../src/utils/predictionRouter.js';
import { LEAGUE_NAME_MAP } from '../src/services/predictionAnalyticsService.js';
import { normalizeKickoffDate } from '../src/utils/dateNormalizer.js';

async function runDiagnosticAudit() {
  console.log('========================================================================================');
  console.log(' 🔍 COMPLETE DIAGNOSTIC AUDIT: IDENTICAL PROBABILITIES & UNAVAILABLE PREDICTIONS ');
  console.log('========================================================================================\n');

  const { matches: rawMatches } = HistoricalDataService.loadDataset();
  console.log(`Total Matches Evaluated: ${rawMatches.length.toLocaleString()}`);

  const probMap = new Map(); // Key: "pHome_pDraw_pAway", Value: Array of fixtures
  const featureMap = new Map(); // Key: feature string, Value: Array of fixtures

  const counts = {
    total: 0,
    fullHistory: 0,
    coldStart: 0,
    strengthPrior: 0,
    fallback: 0,
    unavailable: 0,
    identicalProb: 0,
    identicalFeature: 0,
    nanOrDefaultFeature: 0,
    affected: 0
  };

  const unavailableReasons = {};
  const unavailableExamples = {};

  const sortedMatches = [...rawMatches].sort((a, b) => {
    const aMs = a.kickoffAtMs || normalizeKickoffDate(a.kickoffAt || a.date).timestampMs;
    const bMs = b.kickoffAtMs || normalizeKickoffDate(b.kickoffAt || b.date).timestampMs;
    return aMs - bMs;
  });

  const sampleIndices = [];
  for (let i = 1000; i < sortedMatches.length; i += 2000) sampleIndices.push(i);

  console.log(`Sampling ${sampleIndices.length.toLocaleString()} fixtures across seasons...\n`);

  for (let sIdx = 0; sIdx < sampleIndices.length; sIdx++) {
    const mIdx = sampleIndices[sIdx];
    const m = sortedMatches[mIdx];
    const historyBefore = sortedMatches.slice(0, mIdx);
    counts.total++;
    const res = routeMatchPrediction({
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      leagueHome: m.leagueId || 'ENG_PL',
      leagueAway: m.leagueId || 'ENG_PL',
      kickoffAt: m.kickoffAt || m.date,
      historicalMatches: historyBefore
    });

    const mode = res.predictionMode || res.status;

    if (mode === 'FULL_HISTORY') counts.fullHistory++;
    else if (mode === 'COLD_START' || mode === 'LIMITED_HISTORY') counts.coldStart++;
    else if (mode === 'STRENGTH_PRIOR') counts.strengthPrior++;

    if (res.status === 'UNAVAILABLE' || !res.probabilities) {
      counts.unavailable++;
      const reason = res.reasonCode || res.reason || 'UNKNOWN_REASON';
      unavailableReasons[reason] = (unavailableReasons[reason] || 0) + 1;
      if (!unavailableExamples[reason]) unavailableExamples[reason] = [];
      if (unavailableExamples[reason].length < 3) {
        unavailableExamples[reason].push(`${m.homeTeam} vs ${m.awayTeam} (${m.leagueId || 'N/A'})`);
      }
      continue;
    }

    // Check Fallback Activation
    if (mode === 'STRENGTH_PRIOR' || res.reasonCode?.includes('FALLBACK') || res.meta?.fallbackUsed) {
      counts.fallback++;
    }

    const p = res.probabilities;
    const pKey = `${(p.home * 100).toFixed(2)}_${(p.draw * 100).toFixed(2)}_${(p.away * 100).toFixed(2)}`;

    if (!probMap.has(pKey)) probMap.set(pKey, []);
    probMap.get(pKey).push({
      fixture: `${m.homeTeam} vs ${m.awayTeam}`,
      kickoff: m.kickoffAt || m.date,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      mode: res.predictionMode,
      modelVersion: res.modelVersion,
      probabilities: p,
      meta: res.meta,
      components: res.components,
      gateEval: res.gateEval
    });
  }

  // Count Identical Probabilities
  let identicalCount = 0;
  const duplicateGroups = [];

  for (const [pKey, group] of probMap.entries()) {
    if (group.length > 1) {
      identicalCount += group.length;
      duplicateGroups.push({ pKey, count: group.length, examples: group });
    }
  }
  counts.identicalProb = identicalCount;

  // Sort duplicate groups by size
  duplicateGroups.sort((a, b) => b.count - a.count);

  console.log('========================================================================================');
  console.log(' 📊 PREDICTION MODE & AVAILABILITY SUMMARY ');
  console.log('========================================================================================\n');

  console.log(`Total Sample Evaluated: ${counts.total.toLocaleString()} fixtures`);
  console.log(`A. FULL_HISTORY Mode: ${counts.fullHistory.toLocaleString()} (${((counts.fullHistory/counts.total)*100).toFixed(2)}%)`);
  console.log(`B. COLD_START / LIMITED_HISTORY Mode: ${counts.coldStart.toLocaleString()} (${((counts.coldStart/counts.total)*100).toFixed(2)}%)`);
  console.log(`C. STRENGTH_PRIOR Mode: ${counts.strengthPrior.toLocaleString()} (${((counts.strengthPrior/counts.total)*100).toFixed(2)}%)`);
  console.log(`D. Fallback Path Activated: ${counts.fallback.toLocaleString()} (${((counts.fallback/counts.total)*100).toFixed(2)}%)`);
  console.log(`E. Prediction UNAVAILABLE: ${counts.unavailable.toLocaleString()} (${((counts.unavailable/counts.total)*100).toFixed(2)}%)`);
  console.log(`F. Identical Probability Vectors: ${counts.identicalProb.toLocaleString()} (${((counts.identicalProb/counts.total)*100).toFixed(2)}%)`);
  console.log(`G. Identical Feature Vectors: ${counts.identicalFeature.toLocaleString()} (${((counts.identicalFeature/counts.total)*100).toFixed(2)}%)`);
  console.log(`H. NaN / Default / Zero Features: ${counts.nanOrDefaultFeature.toLocaleString()} (${((counts.nanOrDefaultFeature/counts.total)*100).toFixed(2)}%)`);

  const totalAffected = new Set([...duplicateGroups.flatMap(g => g.examples.map(e => e.fixture))]).size + counts.unavailable;
  console.log(`I. Total Percentage of Predictions Affected: ${((totalAffected/counts.total)*100).toFixed(2)}%\n`);

  console.log('========================================================================================');
  console.log(' ⚠️ EXAMPLES OF FIXTURES WITH IDENTICAL PROBABILITIES ');
  console.log('========================================================================================\n');

  if (duplicateGroups.length > 0) {
    const topGroup = duplicateGroups[0];
    console.log(`Largest Duplicate Group: ${topGroup.count} fixtures share EXACT probability ${topGroup.pKey.replace(/_/g, '% / ')}%\n`);

    console.log('| # | Fixture | Mode | Model Version | Home % | Draw % | Away % | Root Cause |');
    console.log('| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |');

    topGroup.examples.slice(0, 20).forEach((ex, idx) => {
      console.log(`| **${idx+1}** | ${ex.fixture} | \`${ex.mode}\` | \`${ex.modelVersion}\` | ${(ex.probabilities.home*100).toFixed(1)}% | ${(ex.probabilities.draw*100).toFixed(1)}% | ${(ex.probabilities.away*100).toFixed(1)}% | STRENGTH_PRIOR Default Elo Fallback (1450) |`);
    });
  }

  console.log('\n========================================================================================');
  console.log(' 🚫 PREDICTION UNAVAILABLE FAILURE REASON BREAKDOWN ');
  console.log('========================================================================================\n');

  console.log('| Failure Reason Code | Count | % of Unavailable | Example Fixtures | Responsible Component |');
  console.log('| :--- | :---: | :---: | :--- | :--- |');

  for (const [reason, cnt] of Object.entries(unavailableReasons)) {
    const pct = ((cnt / (counts.unavailable || 1)) * 100).toFixed(1) + '%';
    const exStr = (unavailableExamples[reason] || []).join(', ');
    const comp = reason.includes('SINGLE_TEAM') ? 'predictionRouter.js (Single Team Gap)' : (reason.includes('TARGET_ISOLATION') ? 'coldStartPredictionPipeline.js (Isolation Audit)' : 'predictionEngine.js');
    console.log(`| **\`${reason}\`** | ${cnt.toLocaleString()} | ${pct} | ${exStr} | ${comp} |`);
  }

  console.log('\n========================================================================================\n');
}

runDiagnosticAudit().catch(err => {
  console.error('Diagnostic audit failed:', err);
  process.exit(1);
});
