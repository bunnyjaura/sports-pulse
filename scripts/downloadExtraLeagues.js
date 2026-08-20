import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fetchUrl(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch ${url}, status code: ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timeout (${timeoutMs}ms) for ${url}`));
    });

    req.on('error', reject);
  });
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDateToIso(dateStr, timeStr = '15:00') {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;

  let day = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  if (year < 100) {
    year = year >= 50 ? 1900 + year : 2000 + year;
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const timeClean = (timeStr && timeStr.trim()) ? timeStr.trim().split('+')[0] : '15:00';
  const timeFormatted = timeClean.length === 5 ? `${timeClean}:00` : timeClean;

  const iso = `${year}-${mm}-${dd}T${timeFormatted}.000Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function getSeasonFromDateStr(dateStr) {
  if (!dateStr) return '2024-25';
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return '2024-25';
  let year = parseInt(parts[2], 10);
  let month = parseInt(parts[1], 10);
  if (year < 100) year = year >= 50 ? 1900 + year : 2000 + year;

  if (month >= 7) {
    const nextYr = (year + 1) % 100;
    return `${year}-${nextYr < 10 ? '0' + nextYr : nextYr}`;
  } else {
    const prevYr = year - 1;
    const currYr = year % 100;
    return `${prevYr}-${currYr < 10 ? '0' + currYr : currYr}`;
  }
}

// 1. Seasonal Leagues Config (/mmz4281/{season}/{code}.csv)
const SEASONAL_LEAGUES = [
  { code: 'SC0', leagueId: 'SCO_PREMIERSHIP', name: 'Scottish Premiership' },
  { code: 'E1',  leagueId: 'ENG_CHAMPIONSHIP', name: 'EFL Championship' },
  { code: 'N1',  leagueId: 'NED_EREDIVISIE', name: 'Dutch Eredivisie' },
  { code: 'P1',  leagueId: 'POR_PRIMEIRA', name: 'Primeira Liga' },
  { code: 'B1',  leagueId: 'BEL_PRO_LEAGUE', name: 'Belgian First Division A' },
  { code: 'T1',  leagueId: 'TUR_SUPERLIG', name: 'Turkish Süper Lig' },
  { code: 'D2',  leagueId: 'GER_2BUNDESLIGA', name: '2. Bundesliga' },
  { code: 'SP2', leagueId: 'ESP_LALIGA2', name: 'La Liga 2' },
  { code: 'G1',  leagueId: 'GRE_SUPERLEAGUE', name: 'Greek Super League' }
];

const SEASONS = ['1617', '1718', '1819', '1920', '2021', '2122', '2223', '2324', '2425'];

// 2. Master Extra Leagues Config (/new/{code}.csv)
const MASTER_EXTRA_LEAGUES = [
  { code: 'AUT', leagueId: 'AUT_BUNDESLIGA', name: 'Austrian Bundesliga' },
  { code: 'DNK', leagueId: 'DEN_SUPERLIGA', name: 'Danish Superligaen' },
  { code: 'NOR', leagueId: 'NOR_ELITESERIEN', name: 'Norwegian Eliteserien' },
  { code: 'SWE', leagueId: 'SWE_ALLSVENSKAN', name: 'Swedish Allsvenskan' },
  { code: 'SWZ', leagueId: 'SUI_SUPERLEAGUE', name: 'Swiss Super League' },
  { code: 'POL', leagueId: 'POL_EKSTRAKLASA', name: 'Polish Ekstraklasa' },
  { code: 'ARG', leagueId: 'ARG_PRIMERA', name: 'Primera LFP (Argentina)' },
  { code: 'BRA', leagueId: 'BRA_SERIEA', name: 'Brasileirão Série A' },
  { code: 'USA', leagueId: 'USA_MLS', name: 'Major League Soccer' },
  { code: 'MEX', leagueId: 'MEX_LIGAMX', name: 'Liga MX' },
  { code: 'JPN', leagueId: 'JPN_J1', name: 'J1 League' }
];

// 3. OpenFootball Text Sources Config (UEFA, CSL, A-League, KSA, COL, Libertadores, Sudamericana)
const OPENFOOTBALL_SOURCES = [
  {
    leagueId: 'CHN_CSL',
    name: 'Chinese Super League',
    urls: [
      'https://raw.githubusercontent.com/openfootball/world/master/asia/china/2024_cn1.txt',
      'https://raw.githubusercontent.com/openfootball/world/master/asia/china/2023_cn1.txt',
      'https://raw.githubusercontent.com/openfootball/world/master/asia/china/2022_cn1.txt',
      'https://raw.githubusercontent.com/openfootball/world/master/asia/china/2021_cn1.txt',
      'https://raw.githubusercontent.com/openfootball/world/master/asia/china/2020_cn1.txt',
      'https://raw.githubusercontent.com/openfootball/world/master/asia/china/2019_cn1.txt',
      'https://raw.githubusercontent.com/openfootball/world/master/asia/china/2018_cn1.txt'
    ]
  },
  {
    leagueId: 'AUS_ALEAGUE',
    name: 'Australia A-League',
    urls: [
      'https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2024-25_au1.txt',
      'https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2023-24_au1.txt',
      'https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2022-23_au1.txt',
      'https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2021-22_au1.txt',
      'https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2020-21_au1.txt',
      'https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2019-20_au1.txt',
      'https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2018-19_au1.txt'
    ]
  },
  {
    leagueId: 'KSA_PRO',
    name: 'Saudi Pro League',
    urls: [
      'https://raw.githubusercontent.com/openfootball/world/master/middle-east/saudi-arabia/2024-25_sa1.txt'
    ]
  },
  {
    leagueId: 'COL_PRIMERA',
    name: 'Colombian Primera',
    urls: [
      'https://raw.githubusercontent.com/openfootball/south-america/master/colombia/2025_co1.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/colombia/2024_co1.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/colombia/2023_co1.txt'
    ]
  },
  {
    leagueId: 'UEFA_CL',
    name: 'UEFA Champions League',
    urls: [
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2024-25/cl.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2023-24/cl.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2022-23/cl.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2021-22/cl.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2020-21/cl.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2019-20/cl.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2018-19/cl.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2017-18/cl.txt'
    ]
  },
  {
    leagueId: 'UEFA_EL',
    name: 'UEFA Europa League',
    urls: [
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2024-25/el.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2023-24/el.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2022-23/el.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2021-22/el.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2020-21/el.txt'
    ]
  },
  {
    leagueId: 'UEFA_ECL',
    name: 'UEFA Conference League',
    urls: [
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2024-25/conf.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2023-24/conf.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2022-23/conf.txt',
      'https://raw.githubusercontent.com/openfootball/champions-league/master/2021-22/conf.txt'
    ]
  },
  {
    leagueId: 'CONMEBOL_LIBERTADORES',
    name: 'Copa Libertadores',
    urls: [
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2024_copal.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2023_copal.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2022_copal.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2021_copal.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2020_copal.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2019_copal.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2018_copal.txt'
    ]
  },
  {
    leagueId: 'CONMEBOL_SUDAMERICANA',
    name: 'Copa Sudamericana',
    urls: [
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2024_copas.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2023_copas.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2022_copas.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2021_copas.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2020_copas.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2019_copas.txt',
      'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2018_copas.txt'
    ]
  }
];

function parseOpenFootballTxt(txt, leagueId, leagueName, defaultYear = 2023) {
  const lines = txt.split(/\r?\n/);
  let currentYear = defaultYear;
  let currentDateStr = null;
  const matches = [];

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('=')) {
      const yrMatch = line.match(/\b(20\d\d)(?:\/(\d\d|20\d\d))?\b/);
      if (yrMatch) currentYear = parseInt(yrMatch[1], 10);
      continue;
    }

    const dateMatch = line.match(/^(?:[A-Z][a-z]{2}\s+)?([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(20\d\d))?/i);
    if (dateMatch && !line.includes(' v ') && !line.includes(' - ')) {
      const monthStr = dateMatch[1];
      const dayStr = dateMatch[2].padStart(2, '0');
      if (dateMatch[3]) currentYear = parseInt(dateMatch[3], 10);

      const monthMap = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
      const mm = monthMap[monthStr];
      if (mm) {
        currentDateStr = `${currentYear}-${mm}-${dayStr}`;
        continue;
      }
    }

    const isoDateMatch = line.match(/^\[?(20\d\d)-(\d\d)-(\d\d)\]?/);
    if (isoDateMatch && !line.includes(' v ')) {
      currentDateStr = `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`;
      continue;
    }

    const m = line.match(/(?:(\d{1,2}:\d{2})\s+)?(.+?)\s+(?:v|vs)\s+(.+?)\s+(\d+)-(\d+)(?:\s*\((?:\d+)-(\d+)\))?/);
    if (m && currentDateStr) {
      const timeStr = m[1] || '20:00';
      let homeTeam = m[2].replace(/\s*\([A-Z0-9]{2,4}\)$/i, '').trim();
      let awayTeam = m[3].replace(/\s*\([A-Z0-9]{2,4}\)$/i, '').trim();
      const hg = parseInt(m[4], 10);
      const ag = parseInt(m[5], 10);

      if (homeTeam && awayTeam && !isNaN(hg) && !isNaN(ag) && homeTeam !== awayTeam) {
        const iso = `${currentDateStr}T${timeStr}:00.000Z`;
        const ftr = hg > ag ? 'H' : (ag > hg ? 'A' : 'D');
        matches.push({
          leagueId,
          leagueName,
          season: `${currentYear}`,
          homeTeam,
          awayTeam,
          kickoffAt: iso,
          homeGoals: hg,
          awayGoals: ag,
          FTHG: hg,
          FTAG: ag,
          FTR: ftr
        });
      }
    }
  }

  return matches;
}

async function downloadSeasonalLeagues() {
  console.log('--- Downloading Seasonal League Datasets (/mmz4281/*.csv) ---');
  const matches = [];

  for (const lg of SEASONAL_LEAGUES) {
    let leagueCount = 0;
    for (const s of SEASONS) {
      const url = `https://www.football-data.co.uk/mmz4281/${s}/${lg.code}.csv`;
      try {
        const csvText = await fetchUrl(url, 8000);
        const lines = csvText.split(/\r?\n/);
        if (lines.length < 2) continue;

        const header = parseCsvLine(lines[0]);
        const idxHome = header.indexOf('HomeTeam');
        const idxAway = header.indexOf('AwayTeam');
        const idxDate = header.indexOf('Date');
        const idxTime = header.indexOf('Time');
        const idxFTHG = header.indexOf('FTHG');
        const idxFTAG = header.indexOf('FTAG');
        const idxFTR = header.indexOf('FTR');
        const idxB365H = header.indexOf('B365H');
        const idxB365D = header.indexOf('B365D');
        const idxB365A = header.indexOf('B365A');

        if (idxHome === -1 || idxAway === -1 || idxFTHG === -1 || idxFTAG === -1) continue;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line || !line.trim()) continue;
          const row = parseCsvLine(line);

          const homeTeam = row[idxHome];
          const awayTeam = row[idxAway];
          const fthg = parseInt(row[idxFTHG], 10);
          const ftag = parseInt(row[idxFTAG], 10);

          if (!homeTeam || !awayTeam || isNaN(fthg) || isNaN(ftag)) continue;

          const dateStr = row[idxDate];
          const timeStr = idxTime !== -1 ? row[idxTime] : '15:00';
          const isoDate = parseDateToIso(dateStr, timeStr);
          if (!isoDate) continue;

          const season = getSeasonFromDateStr(dateStr);
          const ftr = row[idxFTR] || (fthg > ftag ? 'H' : (ftag > fthg ? 'A' : 'D'));

          matches.push({
            leagueId: lg.leagueId,
            leagueName: lg.name,
            season,
            homeTeam,
            awayTeam,
            kickoffAt: isoDate,
            homeGoals: fthg,
            awayGoals: ftag,
            FTHG: fthg,
            FTAG: ftag,
            FTR: ftr,
            B365H: idxB365H !== -1 && !isNaN(parseFloat(row[idxB365H])) ? parseFloat(row[idxB365H]) : null,
            B365D: idxB365D !== -1 && !isNaN(parseFloat(row[idxB365D])) ? parseFloat(row[idxB365D]) : null,
            B365A: idxB365A !== -1 && !isNaN(parseFloat(row[idxB365A])) ? parseFloat(row[idxB365A]) : null
          });
          leagueCount++;
        }
      } catch (err) {
        // Silently skip failed/timed out URLs
      }
    }
    console.log(`  ✓ ${lg.name.padEnd(30)} (${lg.leagueId}): ${leagueCount.toLocaleString()} matches`);
  }

  return matches;
}

async function downloadMasterExtraLeagues() {
  console.log('\n--- Downloading Master Extra League Datasets (/new/*.csv) ---');
  const matches = [];

  for (const lg of MASTER_EXTRA_LEAGUES) {
    const url = `https://www.football-data.co.uk/new/${lg.code}.csv`;
    let leagueCount = 0;

    try {
      const csvText = await fetchUrl(url, 8000);
      const lines = csvText.split(/\r?\n/);
      if (lines.length < 2) continue;

      const cleanHeaderLine = lines[0].replace(/^\uFEFF/, '');
      const header = parseCsvLine(cleanHeaderLine);

      const idxHome = header.indexOf('Home');
      const idxAway = header.indexOf('Away');
      const idxDate = header.indexOf('Date');
      const idxTime = header.indexOf('Time');
      const idxHG = header.indexOf('HG');
      const idxAG = header.indexOf('AG');
      const idxRes = header.indexOf('Res');
      const idxSeason = header.indexOf('Season');
      const idxAvgH = header.indexOf('AvgH');
      const idxAvgD = header.indexOf('AvgD');
      const idxAvgA = header.indexOf('AvgA');

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line || !line.trim()) continue;
        const row = parseCsvLine(line);

        const homeTeam = row[idxHome];
        const awayTeam = row[idxAway];
        const hg = parseInt(row[idxHG], 10);
        const ag = parseInt(row[idxAG], 10);

        if (!homeTeam || !awayTeam || isNaN(hg) || isNaN(ag)) continue;

        const dateStr = row[idxDate];
        const timeStr = idxTime !== -1 ? row[idxTime] : '15:00';
        const isoDate = parseDateToIso(dateStr, timeStr);
        if (!isoDate) continue;

        const rawSeason = idxSeason !== -1 ? row[idxSeason] : null;
        let season = getSeasonFromDateStr(dateStr);
        if (rawSeason && rawSeason.includes('/')) {
          const parts = rawSeason.split('/');
          season = `${parts[0]}-${parts[1].slice(-2)}`;
        }

        const ftr = row[idxRes] || (hg > ag ? 'H' : (ag > hg ? 'A' : 'D'));

        matches.push({
          leagueId: lg.leagueId,
          leagueName: lg.name,
          season,
          homeTeam,
          awayTeam,
          kickoffAt: isoDate,
          homeGoals: hg,
          awayGoals: ag,
          FTHG: hg,
          FTAG: ag,
          FTR: ftr,
          B365H: idxAvgH !== -1 && !isNaN(parseFloat(row[idxAvgH])) ? parseFloat(row[idxAvgH]) : null,
          B365D: idxAvgD !== -1 && !isNaN(parseFloat(row[idxAvgD])) ? parseFloat(row[idxAvgD]) : null,
          B365A: idxAvgA !== -1 && !isNaN(parseFloat(row[idxAvgA])) ? parseFloat(row[idxAvgA]) : null
        });
        leagueCount++;
      }
      console.log(`  ✓ ${lg.name.padEnd(30)} (${lg.leagueId}): ${leagueCount.toLocaleString()} matches`);
    } catch (err) {
      console.error(`  Error downloading ${lg.name} (${url}):`, err.message);
    }
  }

  return matches;
}

async function downloadOpenFootballLeagues() {
  console.log('\n--- Downloading OpenFootball Datasets (UEFA, CSL, A-League, KSA, COL, Libertadores, Sudamericana) ---');
  const matches = [];

  for (const src of OPENFOOTBALL_SOURCES) {
    let leagueCount = 0;
    for (const url of src.urls) {
      try {
        const txtText = await fetchUrl(url, 8000);
        const parsed = parseOpenFootballTxt(txtText, src.leagueId, src.name);
        matches.push(...parsed);
        leagueCount += parsed.length;
      } catch (err) {
        // Silently skip broken URLs
      }
    }
    console.log(`  ✓ ${src.name.padEnd(30)} (${src.leagueId}): ${leagueCount.toLocaleString()} matches`);
  }

  return matches;
}

async function main() {
  console.log('================================================================');
  console.log(' BULK EXTRA LEAGUES DOWNLOADER (FOOTBALL-DATA & OPENFOOTBALL)  ');
  console.log('================================================================\n');

  const seasonalMatches = await downloadSeasonalLeagues();
  const masterMatches = await downloadMasterExtraLeagues();
  const openFootballMatches = await downloadOpenFootballLeagues();

  const allMatches = [...seasonalMatches, ...masterMatches, ...openFootballMatches];
  console.log(`\n================================================================`);
  console.log(`TOTAL BULK MATCHES DOWNLOADED: ${allMatches.length.toLocaleString()}`);
  console.log(`================================================================\n`);

  const outputPath = path.join(__dirname, '../src/data/extraLeaguesHistorical.json');
  fs.writeFileSync(outputPath, JSON.stringify(allMatches, null, 2), 'utf8');

  console.log(`Successfully written bulk dataset to: ${outputPath}\n`);
}

main().catch(err => {
  console.error('Bulk download failed:', err);
  process.exit(1);
});
