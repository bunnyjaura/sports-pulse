// Cutoff-Date, Multi-Fold Walk-Forward, and Step 4 Baseline Evaluation Engine

import { computeEloDatabase, calculateEloExpectation, updateEloRatings, parseMatchDate } from './eloEngine';
import { trainDixonColesModel, predictMatchDixonColes } from './dixonColes';

export function runBaselineComparisonWalkForward(matches, options = {}) {
  const numFolds = options.numFolds || 5;

  const sortedMatches = [...matches].filter(m => m.date && m.FTHG !== undefined && m.FTAG !== undefined);
  sortedMatches.sort((a, b) => parseMatchDate(a.date).getTime() - parseMatchDate(b.date).getTime());

  const totalCount = sortedMatches.length;
  if (totalCount < 10) return { baselines: [] };

  const minTrainCount = Math.floor(totalCount * 0.50);
  const remainingCount = totalCount - minTrainCount;
  const foldStep = Math.floor(remainingCount / numFolds) || 1;

  let sumAccA = 0, sumLossA = 0, sumBrierA = 0;
  let sumAccB = 0, sumLossB = 0, sumBrierB = 0;
  let sumAccC = 0, sumLossC = 0, sumBrierC = 0;
  let sumAccM = 0, sumLossM = 0, sumBrierM = 0;

  for (let fold = 0; fold < numFolds; fold++) {
    const trainEndIdx = minTrainCount + (fold * foldStep);
    const testEndIdx = Math.min(totalCount, trainEndIdx + foldStep);

    const trainSet = sortedMatches.slice(0, trainEndIdx);
    const testSet = sortedMatches.slice(trainEndIdx, testEndIdx);

    if (testSet.length === 0) continue;

    // Baseline A probabilities (Train set frequencies)
    let homeWins = 0, draws = 0, awayWins = 0;
    for (const tm of trainSet) {
      if (tm.FTHG > tm.FTAG) homeWins++;
      else if (tm.FTHG === tm.FTAG) draws++;
      else awayWins++;
    }
    const pAHome = homeWins / trainSet.length;
    const pADraw = draws / trainSet.length;
    const pAAway = awayWins / trainSet.length;

    let corrA = 0, lossA = 0, brierA = 0;
    let corrB = 0, lossB = 0, brierB = 0;
    let corrC = 0, lossC = 0, brierC = 0;
    let corrM = 0, lossM = 0, brierM = 0;

    const eloDb = computeEloDatabase(trainSet);
    const dixonModel = trainDixonColesModel(trainSet);

    for (const m of testSet) {
      const act = m.FTR || (m.FTHG > m.FTAG ? "H" : m.FTHG < m.FTAG ? "A" : "D");
      const yH = act === "H" ? 1 : 0;
      const yD = act === "D" ? 1 : 0;
      const yA = act === "A" ? 1 : 0;

      // Baseline A
      if (pAHome >= pADraw && pAHome >= pAAway && act === "H") corrA++;
      lossA += -Math.log(Math.max(0.01, act === "H" ? pAHome : act === "D" ? pADraw : pAAway));
      brierA += Math.pow(pAHome - yH, 2) + Math.pow(pADraw - yD, 2) + Math.pow(pAAway - yA, 2);

      // Baseline B (Always Home)
      if (act === "H") corrB++;
      lossB += -Math.log(Math.max(0.01, act === "H" ? 0.98 : 0.01));
      brierB += Math.pow(1.0 - yH, 2) + Math.pow(0.0 - yD, 2) + Math.pow(0.0 - yA, 2);

      // Baseline C (Bookie Normalized)
      const bH = m.B365H || 2.0;
      const bD = m.B365D || 3.4;
      const bA = m.B365A || 3.6;

      const rH = 1 / bH, rD = 1 / bD, rA = 1 / bA;
      const overround = rH + rD + rA;
      const normH = rH / overround;
      const normD = rD / overround;
      const normA = rA / overround;

      let predC = "H";
      if (normD > normH && normD > normA) predC = "D";
      else if (normA > normH && normA > normD) predC = "A";

      if (predC === act) corrC++;
      const pActC = act === "H" ? normH : act === "D" ? normD : normA;
      lossC += -Math.log(Math.max(0.01, pActC));
      brierC += Math.pow(normH - yH, 2) + Math.pow(normD - yD, 2) + Math.pow(normA - yA, 2);

      // Current Model (Elo + Dixon Coles)
      const hElo = eloDb[m.homeTeam] || 1500;
      const aElo = eloDb[m.awayTeam] || 1500;
      const eloDiff = hElo - aElo;

      const dcPred = predictMatchDixonColes(m.homeTeam, m.awayTeam, dixonModel, { eloDiff });
      const eloHomeProb = calculateEloExpectation(hElo + 65, aElo);
      const eloAwayProb = 1 - eloHomeProb;
      const eloDrawProb = 0.26;

      let hP = 0.6 * dcPred.homeWinProb + 0.4 * eloHomeProb;
      let aP = 0.6 * dcPred.awayWinProb + 0.4 * eloAwayProb;
      let dP = 0.6 * dcPred.drawProb + 0.4 * eloDrawProb;

      const totP = hP + dP + aP;
      hP /= totP; dP /= totP; aP /= totP;

      let predM = "H";
      if (dP > hP && dP > aP) predM = "D";
      else if (aP > hP && aP > dP) predM = "A";

      if (predM === act) corrM++;
      const pActM = act === "H" ? hP : act === "D" ? dP : aP;
      lossM += -Math.log(Math.max(0.01, pActM));
      brierM += Math.pow(hP - yH, 2) + Math.pow(dP - yD, 2) + Math.pow(aP - yA, 2);

      const res = updateEloRatings(hElo, aElo, m.FTHG, m.FTAG);
      eloDb[m.homeTeam] = res.newHomeElo;
      eloDb[m.awayTeam] = res.newAwayElo;
    }

    const n = testSet.length;
    sumAccA += (corrA / n); sumLossA += (lossA / n); sumBrierA += (brierA / n);
    sumAccB += (corrB / n); sumLossB += (lossB / n); sumBrierB += (brierB / n);
    sumAccC += (corrC / n); sumLossC += (lossC / n); sumBrierC += (brierC / n);
    sumAccM += (corrM / n); sumLossM += (lossM / n); sumBrierM += (brierM / n);
  }

  const f = numFolds;
  return {
    baselines: [
      { name: "Baseline A (Historical Frequencies)", accuracyPct: parseFloat(((sumAccA / f) * 100).toFixed(1)), logLoss: parseFloat((sumLossA / f).toFixed(3)), brierScore: parseFloat((sumBrierA / f).toFixed(3)) },
      { name: "Baseline B (Always Home Win)", accuracyPct: parseFloat(((sumAccB / f) * 100).toFixed(1)), logLoss: parseFloat((sumLossB / f).toFixed(3)), brierScore: parseFloat((sumBrierB / f).toFixed(3)) },
      { name: "Baseline C (Normalized Bookmaker Odds)", accuracyPct: parseFloat(((sumAccC / f) * 100).toFixed(1)), logLoss: parseFloat((sumLossC / f).toFixed(3)), brierScore: parseFloat((sumBrierC / f).toFixed(3)) },
      { name: "Current Model (HistGradientBoosting / Elo)", accuracyPct: parseFloat(((sumAccM / f) * 100).toFixed(1)), logLoss: parseFloat((sumLossM / f).toFixed(3)), brierScore: parseFloat((sumBrierM / f).toFixed(3)) }
    ]
  };
}

export function runMultiFoldWalkForwardBacktest(matches, options = {}) {
  const numFolds = options.numFolds || 5;

  const sortedMatches = [...matches].filter(m => m.date && m.FTHG !== undefined && m.FTAG !== undefined);
  sortedMatches.sort((a, b) => parseMatchDate(a.date).getTime() - parseMatchDate(b.date).getTime());

  const totalCount = sortedMatches.length;
  if (totalCount < 10) {
    return { foldResults: [], meanAccuracyPct: 0, meanLogLoss: 0, meanBrierScore: 0 };
  }

  const minTrainCount = Math.floor(totalCount * 0.50);
  const remainingCount = totalCount - minTrainCount;
  const foldStep = Math.floor(remainingCount / numFolds) || 1;

  const foldResults = [];

  for (let fold = 0; fold < numFolds; fold++) {
    const trainEndIdx = minTrainCount + (fold * foldStep);
    const testEndIdx = Math.min(totalCount, trainEndIdx + foldStep);

    const trainSet = sortedMatches.slice(0, trainEndIdx);
    const testSet = sortedMatches.slice(trainEndIdx, testEndIdx);

    if (testSet.length === 0) continue;

    const eloDb = computeEloDatabase(trainSet);
    const dixonModel = trainDixonColesModel(trainSet);

    let correctPicks = 0;
    let foldBrier = 0;
    let foldLogLoss = 0;

    for (const m of testSet) {
      const hElo = eloDb[m.homeTeam] || 1500;
      const aElo = eloDb[m.awayTeam] || 1500;
      const eloDiff = hElo - aElo;

      const dcPred = predictMatchDixonColes(m.homeTeam, m.awayTeam, dixonModel, { eloDiff });

      const eloHomeProb = calculateEloExpectation(hElo + 65, aElo);
      const eloAwayProb = 1 - eloHomeProb;
      const eloDrawProb = 0.26;

      let hProb = 0.6 * dcPred.homeWinProb + 0.4 * eloHomeProb;
      let aProb = 0.6 * dcPred.awayWinProb + 0.4 * eloAwayProb;
      let dProb = 0.6 * dcPred.drawProb + 0.4 * eloDrawProb;

      const totalP = hProb + dProb + aProb;
      hProb /= totalP;
      dProb /= totalP;
      aProb /= totalP;

      let predOutcome = "H";
      if (dProb > hProb && dProb > aProb) predOutcome = "D";
      else if (aProb > hProb && aProb > dProb) predOutcome = "A";

      const actualOutcome = m.FTR || (m.FTHG > m.FTAG ? "H" : m.FTHG < m.FTAG ? "A" : "D");
      if (predOutcome === actualOutcome) correctPicks += 1;

      const yH = actualOutcome === "H" ? 1 : 0;
      const yD = actualOutcome === "D" ? 1 : 0;
      const yA = actualOutcome === "A" ? 1 : 0;

      foldBrier += Math.pow(hProb - yH, 2) + Math.pow(dProb - yD, 2) + Math.pow(aProb - yA, 2);
      const pAct = actualOutcome === "H" ? hProb : actualOutcome === "D" ? dProb : aProb;
      foldLogLoss += -Math.log(Math.max(0.01, pAct));

      const res = updateEloRatings(hElo, aElo, m.FTHG, m.FTAG);
      eloDb[m.homeTeam] = res.newHomeElo;
      eloDb[m.awayTeam] = res.newAwayElo;
    }

    const testN = testSet.length;
    const accPct = parseFloat(((correctPicks / testN) * 100).toFixed(1));
    const avgBrier = parseFloat((foldBrier / testN).toFixed(3));
    const avgLoss = parseFloat((foldLogLoss / testN).toFixed(3));

    const startDate = testSet[0].date;
    const endDate = testSet[testSet.length - 1].date;

    foldResults.push({
      fold: fold + 1,
      trainSize: trainSet.length,
      testSize: testN,
      windowLabel: `${startDate} -> ${endDate}`,
      accuracyPct: accPct,
      brierScore: avgBrier,
      logLoss: avgLoss
    });
  }

  const accs = foldResults.map(f => f.accuracyPct);
  const meanAccuracyPct = accs.length ? parseFloat((accs.reduce((a, b) => a + b, 0) / accs.length).toFixed(1)) : 0;
  const meanLogLoss = foldResults.length ? parseFloat((foldResults.reduce((a, b) => a + b.logLoss, 0) / foldResults.length).toFixed(3)) : 0;
  const meanBrierScore = foldResults.length ? parseFloat((foldResults.reduce((a, b) => a + b.brierScore, 0) / foldResults.length).toFixed(3)) : 0;

  return {
    numFolds: foldResults.length,
    meanAccuracyPct,
    meanLogLoss,
    meanBrierScore,
    foldResults
  };
}

export function runWalkForwardBacktest(matches, options = {}) {
  const cutoffDateStr = options.cutoffDate || "2026-08-16";
  const cutoffTimestamp = parseMatchDate(cutoffDateStr).getTime();

  const trainingMatches = [];
  const testMatches = [];

  for (const m of matches) {
    if (m.date) {
      const matchTimestamp = parseMatchDate(m.date).getTime();
      if (matchTimestamp <= cutoffTimestamp) {
        trainingMatches.push(m);
      } else {
        testMatches.push(m);
      }
    }
  }

  trainingMatches.sort((a, b) => parseMatchDate(a.date).getTime() - parseMatchDate(b.date).getTime());
  testMatches.sort((a, b) => parseMatchDate(a.date).getTime() - parseMatchDate(b.date).getTime());

  const eloDb = computeEloDatabase(trainingMatches);
  const dixonModel = trainDixonColesModel(trainingMatches);

  let correctPicks = 0;
  let totalBrierScore = 0;
  let totalLogLoss = 0;
  let totalBetStake = 0;
  let totalBetReturn = 0;

  const testResults = testMatches.map(match => {
    const homeTeam = match.homeTeam;
    const awayTeam = match.awayTeam;

    const homeElo = eloDb[homeTeam] || 1500;
    const awayElo = eloDb[awayTeam] || 1500;
    const eloDiff = homeElo - awayElo;

    const dcPred = predictMatchDixonColes(homeTeam, awayTeam, dixonModel, { eloDiff });

    const eloHomeProb = calculateEloExpectation(homeElo + 65, awayElo);
    const eloAwayProb = 1 - eloHomeProb;
    const eloDrawProb = 0.26;

    let homeProb = 0.6 * dcPred.homeWinProb + 0.4 * eloHomeProb;
    let awayProb = 0.6 * dcPred.awayWinProb + 0.4 * eloAwayProb;
    let drawProb = 0.6 * dcPred.drawProb + 0.4 * eloDrawProb;

    const totalProb = homeProb + drawProb + awayProb;
    homeProb = parseFloat((homeProb / totalProb).toFixed(3));
    drawProb = parseFloat((drawProb / totalProb).toFixed(3));
    awayProb = parseFloat((awayProb / totalProb).toFixed(3));

    let predictedOutcome = "H";
    if (drawProb > homeProb && drawProb > awayProb) predictedOutcome = "D";
    else if (awayProb > homeProb && awayProb > drawProb) predictedOutcome = "A";

    const actualOutcome = match.FTR || (match.FTHG > match.FTAG ? "H" : match.FTHG < match.FTAG ? "A" : "D");
    const isCorrect = predictedOutcome === actualOutcome;
    if (isCorrect) correctPicks += 1;

    const yH = actualOutcome === "H" ? 1 : 0;
    const yD = actualOutcome === "D" ? 1 : 0;
    const yA = actualOutcome === "A" ? 1 : 0;

    const brier = Math.pow(homeProb - yH, 2) + Math.pow(drawProb - yD, 2) + Math.pow(awayProb - yA, 2);
    totalBrierScore += brier;

    const pActual = actualOutcome === "H" ? homeProb : actualOutcome === "D" ? drawProb : awayProb;
    const logLoss = -Math.log(Math.max(0.01, pActual));
    totalLogLoss += logLoss;

    let valueBetPicked = null;
    let betProfit = 0;

    const b365H = match.B365H;
    const b365D = match.B365D;
    const b365A = match.B365A;

    if (b365H && b365D && b365A) {
      const evH = (homeProb * b365H) - 1;
      const evD = (drawProb * b365D) - 1;
      const evA = (awayProb * b365A) - 1;

      if (evH > 0.05 && evH >= evD && evH >= evA) {
        valueBetPicked = { outcome: "H", odds: b365H, ev: evH };
      } else if (evD > 0.05 && evD >= evH && evD >= evA) {
        valueBetPicked = { outcome: "D", odds: b365D, ev: evD };
      } else if (evA > 0.05 && evA >= evH && evA >= evD) {
        valueBetPicked = { outcome: "A", odds: b365A, ev: evA };
      }

      if (valueBetPicked) {
        totalBetStake += 1;
        if (valueBetPicked.outcome === actualOutcome) {
          betProfit = valueBetPicked.odds - 1;
          totalBetReturn += valueBetPicked.odds;
        } else {
          betProfit = -1;
        }
      }
    }

    if (match.FTHG !== undefined && match.FTAG !== undefined) {
      const updated = updateEloRatings(homeElo, awayElo, match.FTHG, match.FTAG);
      eloDb[homeTeam] = updated.newHomeElo;
      eloDb[awayTeam] = updated.newAwayElo;
    }

    return {
      matchId: match.id,
      date: match.date,
      league: match.league,
      homeTeam,
      awayTeam,
      homeElo,
      awayElo,
      expectedGoalsHome: dcPred.expectedGoalsHome,
      expectedGoalsAway: dcPred.expectedGoalsAway,
      predictedScore: `${dcPred.mostLikelyScore.home}-${dcPred.mostLikelyScore.away}`,
      actualScore: `${match.FTHG}-${match.FTAG}`,
      predictedOutcome,
      actualOutcome,
      isCorrect,
      homeProb,
      drawProb,
      awayProb,
      odds: { H: b365H || '-', D: b365D || '-', A: b365A || '-' },
      valueBetPicked,
      betProfit: parseFloat(betProfit.toFixed(2))
    };
  });

  const testCount = testMatches.length || 1;
  const accuracyPct = parseFloat(((correctPicks / testCount) * 100).toFixed(1));
  const avgBrierScore = parseFloat((totalBrierScore / testCount).toFixed(3));
  const avgLogLoss = parseFloat((totalLogLoss / testCount).toFixed(3));
  
  const roiPct = totalBetStake > 0 
    ? parseFloat((((totalBetReturn - totalBetStake) / totalBetStake) * 100).toFixed(1))
    : 0;

  return {
    cutoffDate: cutoffDateStr,
    trainingMatchesCount: trainingMatches.length,
    testMatchesCount: testMatches.length,
    correctPicks,
    accuracyPct,
    avgBrierScore,
    avgLogLoss,
    totalBetStake,
    totalBetReturn: parseFloat(totalBetReturn.toFixed(2)),
    roiPct,
    testResults
  };
}
