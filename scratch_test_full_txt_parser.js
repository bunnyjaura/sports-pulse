import https from 'https';

function fetchText(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve);
      }
      if (res.statusCode !== 200) return resolve('');
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

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

async function testAll() {
  const sources = [
    { leagueId: 'CHN_CSL', name: 'Chinese Super League', urls: ['https://raw.githubusercontent.com/openfootball/world/master/asia/china/2024_cn1.txt', 'https://raw.githubusercontent.com/openfootball/world/master/asia/china/2023_cn1.txt', 'https://raw.githubusercontent.com/openfootball/world/master/asia/china/2022_cn1.txt', 'https://raw.githubusercontent.com/openfootball/world/master/asia/china/2021_cn1.txt', 'https://raw.githubusercontent.com/openfootball/world/master/asia/china/2020_cn1.txt', 'https://raw.githubusercontent.com/openfootball/world/master/asia/china/2019_cn1.txt', 'https://raw.githubusercontent.com/openfootball/world/master/asia/china/2018_cn1.txt'] },
    { leagueId: 'AUS_ALEAGUE', name: 'Australia A-League', urls: ['https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2024-25_au1.txt', 'https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2023-24_au1.txt', 'https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2022-23_au1.txt', 'https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2021-22_au1.txt', 'https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2020-21_au1.txt', 'https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2019-20_au1.txt', 'https://raw.githubusercontent.com/openfootball/world/master/pacific/australia/2018-19_au1.txt'] },
    { leagueId: 'KSA_PRO', name: 'Saudi Pro League', urls: ['https://raw.githubusercontent.com/openfootball/world/master/middle-east/saudi-arabia/2024-25_sa1.txt'] },
    { leagueId: 'COL_PRIMERA', name: 'Colombian Primera', urls: ['https://raw.githubusercontent.com/openfootball/south-america/master/colombia/2025_co1.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/colombia/2024_co1.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/colombia/2023_co1.txt'] },
    { leagueId: 'UEFA_CL', name: 'UEFA Champions League', urls: ['https://raw.githubusercontent.com/openfootball/champions-league/master/2024-25/cl.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2023-24/cl.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2022-23/cl.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2021-22/cl.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2020-21/cl.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2019-20/cl.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2018-19/cl.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2017-18/cl.txt'] },
    { leagueId: 'UEFA_EL', name: 'UEFA Europa League', urls: ['https://raw.githubusercontent.com/openfootball/champions-league/master/2024-25/el.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2023-24/el.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2022-23/el.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2021-22/el.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2020-21/el.txt'] },
    { leagueId: 'UEFA_ECL', name: 'UEFA Conference League', urls: ['https://raw.githubusercontent.com/openfootball/champions-league/master/2024-25/conf.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2023-24/conf.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2022-23/conf.txt', 'https://raw.githubusercontent.com/openfootball/champions-league/master/2021-22/conf.txt'] },
    { leagueId: 'CONMEBOL_LIBERTADORES', name: 'Copa Libertadores', urls: ['https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2024_copal.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2023_copal.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2022_copal.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2021_copal.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2020_copal.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2019_copal.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2018_copal.txt'] },
    { leagueId: 'CONMEBOL_SUDAMERICANA', name: 'Copa Sudamericana', urls: ['https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2024_copas.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2023_copas.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2022_copas.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2021_copas.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2020_copas.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2019_copas.txt', 'https://raw.githubusercontent.com/openfootball/south-america/master/copa-libertadores/2018_copas.txt'] }
  ];

  for (const src of sources) {
    let total = 0;
    for (const url of src.urls) {
      const txt = await fetchText(url);
      const parsed = parseOpenFootballTxt(txt, src.leagueId, src.name);
      total += parsed.length;
    }
    console.log(`✓ ${src.name.padEnd(30)} (${src.leagueId}): ${total.toLocaleString()} matches parsed`);
  }
}

testAll();
