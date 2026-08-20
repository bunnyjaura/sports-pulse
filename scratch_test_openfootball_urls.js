import https from 'https';

function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const lines = data.split('\n').filter(l => l.trim());
        console.log(`URL: ${url}`);
        console.log(`  Status: ${res.statusCode} | Lines: ${lines.length} | Header: ${lines[0] || 'NONE'}`);
        if (lines.length > 1) {
          console.log(`  Sample row 1: ${lines[1]}`);
        }
        resolve({ ok: res.statusCode === 200, count: lines.length, text: data });
      });
    }).on('error', (err) => {
      console.log(`URL: ${url} | Error: ${err.message}`);
      resolve({ ok: false });
    });
  });
}

async function main() {
  console.log('--- Testing openfootball / footballcsv Raw GitHub URLs ---\n');

  // Test Champions League
  await checkUrl('https://raw.githubusercontent.com/footballcsv/champions-league/master/2020s/2023-24/cl.csv');
  await checkUrl('https://raw.githubusercontent.com/footballcsv/champions-league/master/2010s/2018-19/cl.csv');

  // Test Europa League
  await checkUrl('https://raw.githubusercontent.com/footballcsv/europa-league/master/2020s/2023-24/el.csv');

  // Test China
  await checkUrl('https://raw.githubusercontent.com/footballcsv/china/master/2020s/2023/csl.csv');
  await checkUrl('https://raw.githubusercontent.com/footballcsv/china/master/2020s/2024/csl.csv');

  // Test Australia
  await checkUrl('https://raw.githubusercontent.com/footballcsv/australia/master/2020s/2023-24/aleague.csv');

  // Test Saudi Arabia
  await checkUrl('https://raw.githubusercontent.com/footballcsv/saudi-arabia/master/2020s/2023-24/pro-league.csv');

  // Test Colombia
  await checkUrl('https://raw.githubusercontent.com/footballcsv/colombia/master/2020s/2023/liga.csv');

  // Test Copa Libertadores
  await checkUrl('https://raw.githubusercontent.com/footballcsv/copa-libertadores/master/2020s/2023/libertadores.csv');
}

main();
