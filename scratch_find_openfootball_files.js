import https from 'https';

function checkUrl(url) {
  return new Promise((resolve) => {
    const options = {
      headers: {
        'User-Agent': 'NodeJS-Agent'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, text: data });
      });
    }).on('error', (err) => {
      resolve({ status: 500, error: err.message });
    });
  });
}

async function testPaths() {
  const testUrls = [
    'https://raw.githubusercontent.com/openfootball/champions-league/master/2023-24/cl.txt',
    'https://raw.githubusercontent.com/openfootball/champions-league/master/2022-23/cl.txt',
    'https://raw.githubusercontent.com/openfootball/champions-league/master/2021-22/cl.txt',
    'https://raw.githubusercontent.com/openfootball/champions-league/master/2020-21/cl.txt',
    'https://raw.githubusercontent.com/openfootball/champions-league/master/2019-20/cl.txt',
    'https://raw.githubusercontent.com/openfootball/champions-league/master/2018-19/cl.txt',
    'https://raw.githubusercontent.com/openfootball/champions-league/master/2017-18/cl.txt',
    'https://raw.githubusercontent.com/openfootball/world/master/2023-24/cl.txt',
    'https://raw.githubusercontent.com/openfootball/champions-league/master/2023-24/cl.csv',
    'https://raw.githubusercontent.com/footballcsv/champions-league/main/2020s/2023-24/cl.csv',
    'https://raw.githubusercontent.com/footballcsv/champions-league/main/2023-24/cl.csv',
    'https://raw.githubusercontent.com/footballcsv/champions-league/master/2023-24/cl.csv',
    'https://raw.githubusercontent.com/footballcsv/champions-league/master/cl.csv',
    // Saudi Pro League
    'https://raw.githubusercontent.com/alioh/Saudi-Professional-League-Datasets/master/Saudi_Professional_League.csv',
    'https://raw.githubusercontent.com/alioh/Saudi-Professional-League-Datasets/main/Saudi_Professional_League.csv',
    'https://raw.githubusercontent.com/alioh/Saudi-Professional-League-Datasets/master/data/Saudi_Professional_League.csv',
    // Australia A-League
    'https://raw.githubusercontent.com/openfootball/australia/master/2023-24/1-aleague.txt',
    'https://raw.githubusercontent.com/openfootball/australia/master/2022-23/1-aleague.txt',
    'https://raw.githubusercontent.com/openfootball/australia/master/2021-22/1-aleague.txt',
    // China CSL
    'https://raw.githubusercontent.com/openfootball/china/master/2023/1-csl.txt',
    'https://raw.githubusercontent.com/openfootball/china/master/2024/1-csl.txt',
    'https://raw.githubusercontent.com/openfootball/china/master/2022/1-csl.txt',
    // Colombia
    'https://raw.githubusercontent.com/openfootball/colombia/master/2023/1-liga.txt',
    // Copa Libertadores
    'https://raw.githubusercontent.com/openfootball/copa-libertadores/master/2023/libertadores.txt',
    'https://raw.githubusercontent.com/openfootball/south-america/master/2023/libertadores.txt'
  ];

  for (const url of testUrls) {
    const res = await checkUrl(url);
    if (res.status === 200) {
      console.log(`✅ FOUND [200]: ${url} (length: ${res.text.length})`);
      console.log(`   Sample: ${res.text.slice(0, 150).replace(/\n/g, ' ')}`);
    } else {
      console.log(`❌ 404: ${url}`);
    }
  }
}

testPaths();
