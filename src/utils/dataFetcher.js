const URLS = {
  zh: 'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/cn/gamedata/excel/character_table.json',
  ko: 'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/kr/gamedata/excel/character_table.json',
  en: 'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/en/gamedata/excel/character_table.json',
  ja: 'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/jp/gamedata/excel/character_table.json',
  release: 'https://raw.githubusercontent.com/ArknightsAssets/releasever/master/releasever.json'
};

const EXCLUDE_IDS = new Set([
  'char_615_acspec', 'char_612_accast', 'char_614_acsupo', 
  'char_609_acguad', 'char_611_acnipe', 'char_613_acmedc', 
  'char_608_acpion', 'char_604_ccast', 'char_602_cdfend', 
  'char_601_cguard', 'char_605_cmedic', 'char_603_csnipe', 
  'char_607_cspec', 'char_606_csuppo', 'char_600_cpione',
  'char_617_sharp2', 'char_610_acfend'
]);

const isExcluded = (c, key) => {
  if (EXCLUDE_IDS.has(key)) return true;
  return false;
};

const isTargetRarity = (r) => {
  if (typeof r === 'number') return r >= 0 && r <= 5;
  if (typeof r === 'string') {
    const s = r.toUpperCase();
    return s.includes('1') || s.includes('2') || s.includes('3') || s.includes('4') || s.includes('5') || s.includes('6');
  }
  return false;
};

let cachedCharacters = null;

export async function fetchCharacters() {
  if (cachedCharacters) return cachedCharacters;

  try {
    const [zhRes, koRes, enRes, jaRes, releaseRes] = await Promise.all([
      fetch(URLS.zh).then(r => r.json()).catch(() => ({})),
      fetch(URLS.ko).then(r => r.json()).catch(() => ({})),
      fetch(URLS.en).then(r => r.json()).catch(() => ({})),
      fetch(URLS.ja).then(r => r.json()).catch(() => ({})),
      fetch(URLS.release).then(r => r.json()).catch(() => ({}))
    ]);

    const list = [];
    for (const [key, c] of Object.entries(zhRes)) {
      if (!c || typeof c !== 'object') continue;
      const prof = (c.profession || '').toUpperCase();
      if (prof === 'TOKEN' || prof === 'TRAP') continue;

      if (!isTargetRarity(c.rarity)) continue;
      if (isExcluded(c, key)) continue;

      const nameCN = c.name || c.appellation || key;
      const label = (c.appellation && String(c.appellation).trim().length > 0) ? c.appellation : nameCN;
      const star = typeof c.rarity === 'number' ? c.rarity + 1 : parseInt(c.rarity.replace(/[^0-9]/g, '')) || 4;

      const imgUrl = `https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/avatar/${key}.png`;
      
      let releaseTimestamp = 0;
      if (releaseRes[key]) {
         const dateStr = releaseRes[key].substring(0, 8); // "YY-MM-DD"
         releaseTimestamp = new Date(`20${dateStr}`).getTime();
      }

      list.push({
        id: key,
        label: label,
        nameMap: {
            zh: nameCN,
            ko: koRes[key]?.name || label,
            en: enRes[key]?.name || label,
            ja: jaRes[key]?.name || label
        },
        image: imgUrl,
        star: star,
        releaseTimestamp: releaseTimestamp
      });
    }

    list.sort((a, b) => a.label.localeCompare(b.label, 'en'));
    cachedCharacters = list;
    return list;
  } catch (error) {
    console.error('Error fetching Arknights data:', error);
    return [];
  }
}
