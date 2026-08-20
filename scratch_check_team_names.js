import { HistoricalDataService } from './src/services/historicalDataService.js';
import { getCanonicalTeamId } from './src/utils/teamIdentity.js';
import { HistoricalMatchService } from './src/services/historicalMatchService.js';

const dataset = HistoricalDataService.loadDataset().matches;

console.log('--- CHINESE SUPER LEAGUE TEAMS IN DATASET ---');
const cslTeams = new Set();
dataset.filter(m => m.leagueId === 'CHN_CSL').forEach(m => {
  cslTeams.add(m.homeTeam);
  cslTeams.add(m.awayTeam);
});
console.log(Array.from(cslTeams).sort());

console.log('\n--- AUSTRALIA A-LEAGUE TEAMS IN DATASET ---');
const aleagueTeams = new Set();
dataset.filter(m => m.leagueId === 'AUS_ALEAGUE').forEach(m => {
  aleagueTeams.add(m.homeTeam);
  aleagueTeams.add(m.awayTeam);
});
console.log(Array.from(aleagueTeams).sort());

console.log('\n--- SAUDI PRO LEAGUE TEAMS IN DATASET ---');
const ksaTeams = new Set();
dataset.filter(m => m.leagueId === 'KSA_PRO').forEach(m => {
  ksaTeams.add(m.homeTeam);
  ksaTeams.add(m.awayTeam);
});
console.log(Array.from(ksaTeams).sort());

const cutoff = new Date().toISOString();
console.log("\nHistory for 'Shanghai Port':", HistoricalMatchService.getTeamHistory(dataset, 'Shanghai Port', cutoff).length);
console.log("History for 'Shanghai SIPG':", HistoricalMatchService.getTeamHistory(dataset, 'Shanghai SIPG', cutoff).length);
console.log("History for 'Shandong Taishan':", HistoricalMatchService.getTeamHistory(dataset, 'Shandong Taishan', cutoff).length);
console.log("History for 'Shandong Luneng':", HistoricalMatchService.getTeamHistory(dataset, 'Shandong Luneng', cutoff).length);

console.log("History for 'Melbourne City':", HistoricalMatchService.getTeamHistory(dataset, 'Melbourne City', cutoff).length);
console.log("History for 'Sydney FC':", HistoricalMatchService.getTeamHistory(dataset, 'Sydney FC', cutoff).length);
