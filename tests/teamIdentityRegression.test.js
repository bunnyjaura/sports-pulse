import { getCanonicalTeamId, resolveTeamIdentity } from '../src/utils/teamIdentity.js';
import { normalizeTeamName, stripDiacritics } from '../src/utils/teamNormalizer.js';
import { predictMatch, predictCatBoostEloDiff } from '../src/utils/predictionEngine.js';
import { predictMatchDixonColes, trainDixonColesModel } from '../src/utils/dixonColes.js';
import { routeMatchPrediction } from '../src/utils/predictionRouter.js';
import { getHistoricalDataset } from '../src/services/historicalDataService.js';
import { HistoricalMatchService } from '../src/services/historicalMatchService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('================================================================');
console.log(' ⚽ SPORTS PREDICTOR — TEAM IDENTITY & ROUTING REGRESSION SUITE ');
console.log('================================================================\n');

const historicalMatches = getHistoricalDataset();

// Test 1: Atlético Madrid + Málaga -> canonical IDs correct
console.log('--- Test 1: Atlético Madrid & Málaga Canonical IDs ---');
const idAtleticoAccented = getCanonicalTeamId('Atlético Madrid');
const idMalagaAccented = getCanonicalTeamId('Málaga');
assert(idAtleticoAccented === 'atletico_madrid', `Atlético Madrid resolves to atletico_madrid (got: ${idAtleticoAccented})`);
assert(idMalagaAccented === 'malaga', `Málaga resolves to malaga (got: ${idMalagaAccented})`);

// Test 2: Málaga + Malaga -> same canonical ID
console.log('\n--- Test 2: Málaga & Malaga Identity Match ---');
const idMalagaUnaccented = getCanonicalTeamId('Malaga');
assert(idMalagaAccented === idMalagaUnaccented, `Málaga (${idMalagaAccented}) === Malaga (${idMalagaUnaccented})`);

// Test 3: Atlético Madrid vs Málaga -> valid prediction (FULL_HISTORY)
console.log('\n--- Test 3: Atlético Madrid vs Málaga Prediction ---');
const resA = routeMatchPrediction({ homeTeam: 'Atlético Madrid', awayTeam: 'Málaga', historicalMatches });
assert(resA.status === 'SUCCESS', `Prediction status is SUCCESS (got: ${resA.status})`);
assert(resA.predictionMode === 'FULL_HISTORY', `Prediction mode is FULL_HISTORY (got: ${resA.predictionMode})`);
assert(resA.probabilities !== null, 'Probabilities are not null');
assert(resA.probabilities.home > 0 && resA.probabilities.away > 0, `Valid probabilities (Home: ${(resA.probabilities.home*100).toFixed(1)}%, Away: ${(resA.probabilities.away*100).toFixed(1)}%)`);

// Test 4: No H2H + both teams have history -> valid FULL_HISTORY prediction
console.log('\n--- Test 4: Zero H2H + Strong Team History ---');
const resZeroH2H = routeMatchPrediction({ homeTeam: 'Arsenal', awayTeam: 'Real Madrid', historicalMatches });
assert(resZeroH2H.historicalObservations === 0, `Direct H2H count is 0 (got: ${resZeroH2H.historicalObservations})`);
assert(resZeroH2H.status === 'SUCCESS', `Status is SUCCESS (got: ${resZeroH2H.status})`);
assert(resZeroH2H.predictionMode === 'FULL_HISTORY', `Produces FULL_HISTORY prediction despite 0 H2H count (got: ${resZeroH2H.predictionMode})`);

// Test 5: Celtic vs LASK Linz -> FULL_HISTORY prediction path with real dataset history
console.log('\n--- Test 5: Celtic vs LASK Linz (FULL_HISTORY Mode with 600+ Match History) ---');
const resC = routeMatchPrediction({ homeTeam: 'Celtic', awayTeam: 'LASK Linz', leagueHome: 'SCO_PREMIERSHIP', leagueAway: 'AUT_BUNDESLIGA', historicalMatches });
assert(resC.status === 'SUCCESS', `Status is SUCCESS (got: ${resC.status})`);
assert(resC.predictionMode === 'FULL_HISTORY', `Prediction mode is FULL_HISTORY (got: ${resC.predictionMode})`);
assert(resC.probabilities !== null, 'Probabilities are not null');
assert(resC.probabilities.home > resC.probabilities.away, `Celtic (Elo ${resC.meta.homeElo}) > LASK Linz (Elo ${resC.meta.awayElo}): Home ${(resC.probabilities.home*100).toFixed(1)}% vs Away ${(resC.probabilities.away*100).toFixed(1)}%`);

// Test 6: Home/away swap changes probabilities appropriately
console.log('\n--- Test 6: Home / Away Swap ---');
const resB = routeMatchPrediction({ homeTeam: 'Málaga', awayTeam: 'Atlético Madrid', historicalMatches });
assert(resB.status === 'SUCCESS', 'Swapped fixture produces SUCCESS');
assert(resB.probabilities.home !== resA.probabilities.home, 'Home win probability changes on swap');
assert(resA.probabilities.home > resB.probabilities.home, `Atlético Madrid at home (${(resA.probabilities.home*100).toFixed(1)}%) > Málaga at home (${(resB.probabilities.home*100).toFixed(1)}%)`);

// Test 7: Münchengladbach, Köln, Béziers -> generic Unicode NFD accent stripping
console.log('\n--- Test 7: Generic Unicode NFD Diacritic Removal ---');
assert(stripDiacritics('Münchengladbach') === 'Munchengladbach', 'Münchengladbach -> Munchengladbach');
assert(stripDiacritics('Köln') === 'Koln', 'Köln -> Koln');
assert(stripDiacritics('Béziers') === 'Beziers', 'Béziers -> Beziers');
assert(getCanonicalTeamId('Münchengladbach') === 'munchengladbach', 'Canonical ID munchengladbach');

// Test 8: Missing Elo never produces 1500 fallback
console.log('\n--- Test 8: No Silent Elo 1500 Fallback ---');
const missingEloRes = predictMatch({ homeTeam: 'NonExistentFC_A', awayTeam: 'NonExistentFC_B', historicalMatches });
assert(missingEloRes.status !== 'SUCCESS', `Status is not SUCCESS for unknown teams (got: ${missingEloRes.status})`);
assert(missingEloRes.probabilities === null, 'Probabilities are null when Elo is missing');

// Test 9: Missing Dixon-Coles parameters never produce 1.1/0.9 fallback
console.log('\n--- Test 9: No Silent Dixon-Coles Default Fallback ---');
const emptyModel = trainDixonColesModel([]);
const dcMissingRes = predictMatchDixonColes('NonExistentFC_A', 'NonExistentFC_B', emptyModel);
assert(dcMissingRes.status === 'UNAVAILABLE', `Dixon-Coles returns UNAVAILABLE for un-fitted teams (got: ${dcMissingRes.status})`);

// Test 10: Strict Temporal Cutoff
console.log('\n--- Test 10: Strict Pre-Kickoff Temporal Isolation ---');
const targetDate = '2024-01-01T00:00:00.000Z';
const filtered = HistoricalMatchService.getMatchesBefore(historicalMatches, targetDate);
const futureCount = filtered.filter(m => new Date(m.kickoffAt || m.date) >= new Date(targetDate)).length;
assert(futureCount === 0, `Zero future matches included prior to cutoff ${targetDate}`);

// --- ZERO-GAP DECISION TREE REGRESSION TESTS ---

// Test 11: FULL_HISTORY Probabilities Invariant
console.log('\n--- Test 11: FULL_HISTORY Probabilities Invariant ---');
const resFull = routeMatchPrediction({ homeTeam: 'Arsenal', awayTeam: 'Chelsea', historicalMatches });
assert(resFull.predictionMode === 'FULL_HISTORY', `Arsenal vs Chelsea is FULL_HISTORY (got: ${resFull.predictionMode})`);
assert(resFull.probabilities !== null, 'FULL_HISTORY probabilities are non-null');
assert(Math.abs(resFull.probabilities.home + resFull.probabilities.draw + resFull.probabilities.away - 1.0) < 1e-6, 'FULL_HISTORY probabilities sum to 1.0');

// Test 12: COLD_START Probabilities Invariant
console.log('\n--- Test 12: COLD_START Probabilities Invariant ---');
// Brighton vs Burnley at 2017-10-01 has ~7 matches in DB (min < 50) -> COLD_START
const resCold = routeMatchPrediction({ homeTeam: 'Brighton', awayTeam: 'Burnley', kickoffAt: '2017-10-01T00:00:00.000Z', historicalMatches });
assert(resCold.predictionMode === 'COLD_START' || resCold.predictionMode === 'LIMITED_HISTORY', `Low sample fixture routes to COLD_START/LIMITED_HISTORY (got: ${resCold.predictionMode})`);
assert(resCold.probabilities !== null, 'COLD_START probabilities are non-null');
assert(Math.abs(resCold.probabilities.home + resCold.probabilities.draw + resCold.probabilities.away - 1.0) < 1e-6, 'COLD_START probabilities sum to 1.0');

// Test 13: Single-Team Gap Fixture Never Returns Null
console.log('\n--- Test 13: Single-Team Gap Fixture Recovery ---');
const resSingleGap = routeMatchPrediction({ homeTeam: 'Arsenal', awayTeam: 'NonExistentFC_Unknown', historicalMatches });
assert(resSingleGap.status === 'SUCCESS', `Single-gap status is SUCCESS (got: ${resSingleGap.status})`);
assert(resSingleGap.predictionMode === 'SINGLE_TEAM_FALLBACK', `Mode is SINGLE_TEAM_FALLBACK (got: ${resSingleGap.predictionMode})`);
assert(resSingleGap.probabilities !== null, 'Single-gap probabilities are NOT null');
assert(Math.abs(resSingleGap.probabilities.home + resSingleGap.probabilities.draw + resSingleGap.probabilities.away - 1.0) < 1e-6, 'Probabilities sum strictly to 1.0');
assert(resSingleGap.provenance && resSingleGap.provenance.fallbackUsed === true, 'Exposes complete provenance object with fallbackUsed: true');

// Test 14: Both-Unknown Fixture Never Returns Null
console.log('\n--- Test 14: Both-Unknown Fixture Recovery ---');
const resBothUnknown = routeMatchPrediction({ homeTeam: 'UnknownFC_A', awayTeam: 'UnknownFC_B', historicalMatches });
assert(resBothUnknown.status === 'SUCCESS', `Both-unknown status is SUCCESS (got: ${resBothUnknown.status})`);
assert(resBothUnknown.predictionMode === 'BOTH_UNKNOWN', `Mode is BOTH_UNKNOWN (got: ${resBothUnknown.predictionMode})`);
assert(resBothUnknown.probabilities !== null, 'Both-unknown probabilities are NOT null');
assert(Math.abs(resBothUnknown.probabilities.home + resBothUnknown.probabilities.draw + resBothUnknown.probabilities.away - 1.0) < 1e-6, 'Probabilities sum strictly to 1.0');
assert(resBothUnknown.priorSourceHome !== undefined && resBothUnknown.priorSourceAway !== undefined, 'Exposes priorSourceHome and priorSourceAway in provenance');

// Test 15: Invalid Fixtures Return UNAVAILABLE
console.log('\n--- Test 15: Data Integrity Failures Return UNAVAILABLE ---');
const resInvalidTeam = routeMatchPrediction({ homeTeam: '', awayTeam: 'Arsenal', historicalMatches });
assert(resInvalidTeam.status === 'UNAVAILABLE', `Empty team name returns UNAVAILABLE (got: ${resInvalidTeam.status})`);
assert(resInvalidTeam.probabilities === null, 'Probabilities are null for invalid team name');

const resInvalidDate = routeMatchPrediction({ homeTeam: 'Arsenal', awayTeam: 'Chelsea', kickoffAt: 'INVALID_DATE_STRING', historicalMatches });
assert(resInvalidDate.status === 'UNAVAILABLE', `Invalid kickoff date returns UNAVAILABLE (got: ${resInvalidDate.status})`);
assert(resInvalidDate.probabilities === null, 'Probabilities are null for invalid kickoff date');

// Test 16: Complete Provenance Object Verification
console.log('\n--- Test 16: Provenance Object Structure ---');
assert(resFull.provenance !== undefined, 'FULL_HISTORY includes provenance object');
assert(resSingleGap.provenance !== undefined, 'SINGLE_TEAM_FALLBACK includes provenance object');
assert(resBothUnknown.provenance !== undefined, 'BOTH_UNKNOWN includes provenance object');

console.log('\n================================================================');
console.log(` RESULTS: ${passed} Passed, ${failed} Failed `);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
