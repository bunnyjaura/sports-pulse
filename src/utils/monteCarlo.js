// 10,000-Run Monte Carlo Match Simulator Laboratory

function samplePoisson(lambda) {
  let L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

export function runMonteCarloSimulation(homeTeam, awayTeam, baseHomeXG, baseAwayXG, options = {}) {
  const iterations = options.iterations || 10000;

  // Custom User Slider Adjustments
  const eloWeight = options.eloWeight !== undefined ? options.eloWeight : 1.0;
  const formWeight = options.formWeight !== undefined ? options.formWeight : 1.0;
  const homeAdvantageBoost = options.homeAdvantageBoost !== undefined ? options.homeAdvantageBoost : 0.35;
  const weatherFactor = options.weatherFactor || 1.0; // e.g. 0.9 for Heavy Rain
  const restDaysHome = options.restDaysHome || 6;
  const restDaysAway = options.restDaysAway || 6;

  // Rest congestion impact (-0.05 xG per day under 4 days)
  const homeRestPenalty = restDaysHome < 4 ? (4 - restDaysHome) * 0.08 : 0;
  const awayRestPenalty = restDaysAway < 4 ? (4 - restDaysAway) * 0.08 : 0;

  // Adjusted Expected Goals
  let finalHomeXG = (baseHomeXG * formWeight + homeAdvantageBoost - homeRestPenalty) * weatherFactor;
  let finalAwayXG = (baseAwayXG * formWeight - awayRestPenalty) * weatherFactor;

  finalHomeXG = Math.max(0.2, finalHomeXG);
  finalAwayXG = Math.max(0.1, finalAwayXG);

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  const scoreCounts = {};
  const maxGoalDim = 6;
  for (let i = 0; i <= maxGoalDim; i++) {
    for (let j = 0; j <= maxGoalDim; j++) {
      scoreCounts[`${i}-${j}`] = 0;
    }
  }

  for (let sim = 0; sim < iterations; sim++) {
    const hG = Math.min(maxGoalDim, samplePoisson(finalHomeXG));
    const aG = Math.min(maxGoalDim, samplePoisson(finalAwayXG));

    if (hG > aG) homeWins++;
    else if (hG === aG) draws++;
    else awayWins++;

    const scoreKey = `${hG}-${aG}`;
    if (scoreCounts[scoreKey] !== undefined) {
      scoreCounts[scoreKey]++;
    }
  }

  const homeWinPct = parseFloat(((homeWins / iterations) * 100).toFixed(1));
  const drawPct = parseFloat(((draws / iterations) * 100).toFixed(1));
  const awayWinPct = parseFloat(((awayWins / iterations) * 100).toFixed(1));

  // Build Scoreline Grid
  const grid = [];
  for (let i = 0; i <= maxGoalDim; i++) {
    const row = [];
    for (let j = 0; j <= maxGoalDim; j++) {
      const count = scoreCounts[`${i}-${j}`] || 0;
      const pct = parseFloat(((count / iterations) * 100).toFixed(2));
      row.push({ homeGoals: i, awayGoals: j, count, pct });
    }
    grid.push(row);
  }

  // Generate a realistic simulated match story / event log for 1 sample iteration
  const simSampleHomeGoals = samplePoisson(finalHomeXG);
  const simSampleAwayGoals = samplePoisson(finalAwayXG);
  const eventLog = generateMatchTimelineEvents(homeTeam, awayTeam, simSampleHomeGoals, simSampleAwayGoals);

  return {
    homeTeam,
    awayTeam,
    iterations,
    finalHomeXG: parseFloat(finalHomeXG.toFixed(2)),
    finalAwayXG: parseFloat(finalAwayXG.toFixed(2)),
    homeWinPct,
    drawPct,
    awayWinPct,
    grid,
    simulatedSampleScore: `${simSampleHomeGoals}-${simSampleAwayGoals}`,
    eventLog
  };
}

function generateMatchTimelineEvents(homeTeam, awayTeam, homeGoals, awayGoals) {
  const events = [];
  
  // Distribute goals across 90 minutes
  for (let g = 0; g < homeGoals; g++) {
    const min = Math.floor(Math.random() * 88) + 2;
    events.push({ minute: min, type: "GOAL", team: homeTeam, desc: `⚽ GOAL! ${homeTeam} scores!` });
  }

  for (let g = 0; g < awayGoals; g++) {
    const min = Math.floor(Math.random() * 88) + 2;
    events.push({ minute: min, type: "GOAL", team: awayTeam, desc: `⚽ GOAL! ${awayTeam} scores!` });
  }

  // Add random yellow cards / key moments
  events.push({ minute: 1, type: "START", desc: "🏁 Kick-off! Match begins." });
  events.push({ minute: 45, type: "HALF_TIME", desc: "⏸️ Half-Time whistle." });
  events.push({ minute: 90, type: "FULL_TIME", desc: `🔚 Full-time! Final Score: ${homeTeam} ${homeGoals} - ${awayGoals} ${awayTeam}.` });

  events.sort((a, b) => a.minute - b.minute);
  return events;
}
