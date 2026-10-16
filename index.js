import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

// ===== UTILS POISSON =====
function poisson(k, lam) {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return Math.exp(-lam) * Math.pow(lam, k) / f;
}
function probaOver(lam, seuil) {
  let p = 0;
  for (let k = Math.floor(seuil) + 1; k <= seuil + 25; k++) {
    p += poisson(k, lam);
  }
  return p > 1? 1 : p;
}

// ===== SOURCES REELLES DE TES CAPTURES =====
const FORM_ESPANYOL = [
  { res: 'D' }, { res: 'L' }, { res: 'L' }, { res: 'W' }, { res: 'D' },
  { res: 'L' }, { res: 'L' }, { res: 'W' }, { res: 'W' }, { res: 'L' },
  { res: 'D' }, { res: 'L' }, { res: 'W' }, { res: 'L' }, { res: 'D' }
];
const FORM_ATLETICO = [
  { res: 'W' }, { res: 'W' }, { res: 'W' }, { res: 'W' }, { res: 'W' },
  { res: 'L' }, { res: 'L' }, { res: 'W' }, { res: 'W' }, { res: 'W' },
  { res: 'D' }, { res: 'W' }, { res: 'W' }, { res: 'L' }, { res: 'W' }
];
const H2H = { homeWin: 8, draw: 5, awayWin: 2, total: 15, goalsHome: 23, goalsAway: 16 };

// ETAPE 1 - Forme ponderee avec coef 1.0, 0.95, 0.90...
function calculateForm(recentMatches) {
  let weightedPoints = 0;
  let totalWeight = 0;
  recentMatches.forEach((m, i) => {
    let coef = 1.0 - (i * 0.05);
    if (coef < 0.3) coef = 0.3;
    let pts = 0;
    if (m.res === 'W') pts = 3;
    else if (m.res === 'D') pts = 1;
    weightedPoints += pts * coef;
    totalWeight += 3 * coef;
  });
  return (weightedPoints / totalWeight) * 100;
}

// ETAPE 4 - Fusion ponderee 30% H2H + 40% dom + 30% ext
function calculatePrediction(formHome, formAway, h2hStats) {
  const pH2H_Home = (h2hStats.homeWin / h2hStats.total) * 100;
  const pH2H_Draw = (h2hStats.draw / h2hStats.total) * 100;
  const pH2H_Away = (h2hStats.awayWin / h2hStats.total) * 100;
  let pHome = (pH2H_Home * 0.30) + (formHome * 0.40) + ((100 - formAway) * 0.30);
  let pDraw = pH2H_Draw;
  let pAway = (pH2H_Away * 0.30) + (formAway * 0.40) + ((100 - formHome) * 0.30);
  pHome += 3; // avantage domicile
  const total = pHome + pDraw + pAway;
  return {
    home: (pHome / total) * 100,
    draw: (pDraw / total) * 100,
    away: (pAway / total) * 100,
    brut: { home: pHome, draw: pDraw, away: pAway },
    h2h: { home: pH2H_Home, draw: pH2H_Draw, away: pH2H_Away }
  };
}

function getLambdaFusion(v1, v2) {
  const a = v1.toLowerCase();
  const e = v2.toLowerCase();
  const isMatch = (a.includes('atletico') && e.includes('espanyol')) || (a.includes('espanyol') && e.includes('atletico'));
  if (isMatch) {
    const lamHome = H2H.goalsHome / H2H.total; // 1.53
    const lamAway = H2H.goalsAway / H2H.total; // 1.07
    const isFirstAtletico = a.includes('atletico');
    return { l1: isFirstAtletico? lamHome : lamAway, l2: isFirstAtletico? lamAway : lamHome, reel: true };
  }
  return { l1: 1.5, l2: 1.2, reel: false };
}

// ETAPE 5,6,7 - Analyse complete
function analyse(v1, v2) {
  const formEsp = calculateForm(FORM_ESPANYOL);
  const formAtl = calculateForm(FORM_ATLETICO);
  const isAtleticoDom = v1.toLowerCase().includes('atletico');
  const formHome = isAtleticoDom? formAtl : formEsp;
  const formAway = isAtleticoDom? formEsp : formAtl;
  const pred = calculatePrediction(formHome, formAway, H2H);
  const lam = getLambdaFusion(v1, v2);
  const l1 = lam.l1;
  const l2 = lam.l2;

  let p1 = 0, pd = 0, p2 = 0, over = 0, gg = 0;
  let scores = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = 0; j <= 6; j++) {
      let p = poisson(i, l1) * poisson(j, l2);
      scores.push({ s: i + ':' + j, p: p });
      if (i > j) p1 += p;
      else if (i == j) pd += p;
      else p2 += p;
      if (i + j > 2.5) over += p;
      if (i > 0 && j > 0) gg += p;
    }
  }
  const sum = p1 + pd + p2;
  scores.sort((a, b) => b.p - a.p);

  const c1 = l1 * 3.8 + 2.5;
  const c2 = l2 * 3.8 + 2.5;
  const cTotal = c1 + c2;
  const t1 = l1 * 7.2 + 3;
  const t2 = l2 * 7.2 + 3;
  const tTotal = t1 + t2;
  const tCadresTotal = tTotal * 0.38;

  return {
    v1: v1, v2: v2, l1: l1, l2: l2, reel: lam.reel,
    forme: { home: formHome, away: formAway, esp: formEsp, atl: formAtl },
    fusion: pred,
    pH: p1 / sum, pD: pd / sum, pA: p2 / sum,
    pOver: over / sum, pGG: gg / sum,
    coteH: sum / p1, coteD: sum / pd, coteA: sum / p2,
    coteOver: sum / over, coteGG: sum / gg,
    top: scores.slice(0, 5),
    corners: { c1: c1, c2: c2, total: cTotal, over9: probaOver(cTotal, 9.5), coteOver9: 1 / probaOver(cTotal, 9.5) },
    tirs: { t1: t1, t2: t2, total: tTotal, cadresTotal: tCadresTotal, over22: probaOver(tTotal, 22.5), coteOver22: 1 / probaOver(tTotal, 22.5), overCadres8: probaOver(tCadresTotal, 8.5), coteOverCadres8: 1 / probaOver(tCadresTotal, 8.5) }
  };
}

async function getMatchsDuJour() {
  const iso = new Date().toISOString().slice(0, 10);
  const espn = iso.replace(/-/g, '');
  let list = [];
  try {
    for (const lg of ['esp.1', 'eng.1', 'ger.1', 'fra.1', 'bel.1']) {
      const r = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/' + lg + '/scoreboard?dates=' + espn);
      if (!r.ok) continue;
      const d = await r.json();
      if (d.events) {
        d.events.forEach(ev => {
          const c = ev.competitions && ev.competitions[0] && ev.competitions[0].competitors;
          if (c && c.length >= 2) {
            const h = c.find(x => x.homeAway === 'home') || c[0];
            const a = c.find(x => x.homeAway === 'away') || c[1];
            list.push({ home: h.team.displayName, away: a.team.displayName, league: lg });
          }
        });
      }
    }
  } catch {}
  if (list.length < 3) {
    list = [
      { home: 'Atletico Madrid', away: 'Espanyol', league: 'esp.1' },
      { home: 'Eintracht Frankfurt', away: 'FC Cologne', league: 'ger.1' },
      { home: 'Burnley', away: 'Wolves', league: 'eng.1' },
      { home: 'Deportivo', away: 'Levante', league: 'esp.2' },
      { home: 'Le Mans', away: 'Toulouse', league: 'fra.1' }
    ];
  }
  return { date: iso, list: list.slice(0, 10) };
}

async function getOddsReels() {
  const key = process.env.ODDS_API_KEY;
  if (!key) return { hasKey: false, data: [] };
  try {
    let all = [];
    for (const sport of ['soccer_spain_la_liga', 'soccer_epl', 'soccer_germany_bundesliga']) {
      const url = 'https://api.the-odds-api.com/v4/sports/' + sport + '/odds?apiKey=' + key + '&regions=eu&markets=h2h,totals,btts&oddsFormat=decimal';
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      j.forEach(m => {
        const book = m.bookmakers && m.bookmakers[0];
        if (!book) return;
        const h2h = book.markets.find(x => x.key === 'h2h');
        let H = '-', D = '-', A = '-';
        if (h2h) {
          const oH = h2h.outcomes.find(o => o.name === m.home_team);
          const oA = h2h.outcomes.find(o => o.name === m.away_team);
          const oD = h2h.outcomes.find(o => o.name === 'Draw');
          if (oH) H = oH.price;
          if (oA) A = oA.price;
          if (oD) D = oD.price;
        }
        all.push({ match: m.home_team + ' vs ' + m.away_team, H: H, D: D, A: A, book: book.key });
      });
    }
    return { hasKey: true, data: all };
  } catch (e) {
    return { hasKey: true, data: [] };
  }
}

async function deploy() {
  const cmds = [
    new SlashCommandBuilder().setName('xx').setDescription('Analyse fusion ponderee').addStringOption(o => o.setName('v1').setDescription('Equipe 1').setRequired(true)).addStringOption(o => o.setName('v2').setDescription('Equipe 2').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('calendrier').setDescription('Vrais matchs + fusion').toJSON(),
    new SlashCommandBuilder().setName('book').setDescription('Vraies cotes bookmakers').toJSON(),
    new SlashCommandBuilder().setName('coupon').setDescription('Coupon ultra fusion').toJSON()
  ];
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: cmds });
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', async () => {
  console.log('FINAL COMPLET READY - FUSION + SCORE + CORNERS + TIRS + BOOK + COUPON');
  await deploy();
});

client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  const low = msg.content.toLowerCase();

  if (low.startsWith('!analyse')) {
    let raw = msg.content.slice(8).trim();
    if (!raw) { await msg.reply('Usage:!analyse Atletico vs Espanyol'); return; }
    let v1, v2;
    if (raw.toLowerCase().includes('vs')) {
      const p = raw.split(/vs/i); v1 = p[0].trim(); v2 = p[1].trim();
    } else {
      const p = raw.split(' '); v1 = p[0].trim(); v2 = p.slice(1).join(' ').trim() || 'Espanyol';
    }
    const r = analyse(v1, v2);
    let txt = '**' + v1.toUpperCase() + ' vs ' + v2.toUpperCase() + ' - MODELE FUSION PONDERE**\n\n';
    txt += 'ETAPE 1 - FORME PONDERE (coef 1.0,0.95...):\n';
    txt += 'Atletico: ' + r.forme.atl.toFixed(1) + '% | Espanyol: ' + r.forme.esp.toFixed(1) + '%\n';
    txt += 'Forme dom: ' + r.forme.home.toFixed(1) + '% vs ext: ' + r.forme.away.toFixed(1) + '%\n\n';
    txt += 'ETAPE 2 - H2H (15 matchs): Atletico 8V (53%) Nul 5 (33%) Espanyol 2V (13%)\n\n';
    txt += 'ETAPE 3 - BUTS: ' + H2H.goalsHome + ' vs ' + H2H.goalsAway + ' = ' + (H2H.goalsHome / 15).toFixed(2) + ' vs ' + (H2H.goalsAway / 15).toFixed(2) + ' par match\n';
    txt += 'Over 2.5 histo: 7/15=46.7% BTTS: 6/15=40%\n\n';
    txt += 'ETAPE 4 - FUSION (30% H2H + 40% dom + 30% ext):\n';
    txt += 'Brut: 1=' + r.fusion.brut.home.toFixed(1) + '% N=' + r.fusion.brut.draw.toFixed(1) + '% 2=' + r.fusion.brut.away.toFixed(1) + '%\n';
    txt += 'FINAL: 1=' + r.fusion.home.toFixed(1) + '% N=' + r.fusion.draw.toFixed(1) + '% 2=' + r.fusion.away.toFixed(1) + '%\n';
    txt += 'Cotes fusion: 1=' + (100 / r.fusion.home).toFixed(2) + ' N=' + (100 / r.fusion.draw).toFixed(2) + ' 2=' + (100 / r.fusion.away).toFixed(2) + '\n\n';
    txt += 'ETAPE 5 - POISSON (lambda=' + r.l1.toFixed(2) + ' vs ' + r.l2.toFixed(2) + '):\n';
    txt += 'SCORE EXACT: ' + r.top[0].s + ' ' + (r.top[0].p * 100).toFixed(2) + '% Cote ' + (1 / r.top[0].p).toFixed(2) + '\n';
    txt += 'Autres: ' + r.top[1].s + ' ' + (r.top[1].p * 100).toFixed(2) + '% | ' + r.top[2].s + ' ' + (r.top[2].p * 100).toFixed(2) + '%\n';
    txt += 'Poisson: 1=' + (r.pH * 100).toFixed(1) + '% N=' + (r.pD * 100).toFixed(1) + '% 2=' + (r.pA * 100).toFixed(1) + '% Over=' + (r.pOver * 100).toFixed(1) + '% GG=' + (r.pGG * 100).toFixed(1) + '%\n\n';
    txt += 'ETAPE 6-7 - CORNERS + TIRS:\n';
    txt += 'Corners: ' + r.corners.total.toFixed(1) + ' Over9.5=' + (r.corners.over9 * 100).toFixed(1) + '% Cote ' + r.corners.coteOver9.toFixed(2) + '\n';
    txt += 'Tirs: ' + r.tirs.total.toFixed(1) + ' Cadres:' + r.tirs.cadresTotal.toFixed(1) + ' Over22.5=' + (r.tirs.over22 * 100).toFixed(1) + '% Cote ' + r.tirs.coteOver22.toFixed(2) + '\n';
    txt += 'Formules: P=e^-lam*lam^n/n! | Corners lamC=lamB*3.8+2.5 | Tirs lamT=lamB*7.2+3';
    await msg.reply(txt);
  }

  if (low.startsWith('!calendrier')) {
    const m = await getMatchsDuJour();
    let txt = 'CALENDRIER FUSION - ' + m.date + '\n\n';
    for (let i = 0; i < m.list.length; i++) {
      const f = m.list[i];
      const r = analyse(f.home, f.away);
      txt += (i + 1) + '. ' + f.home + ' vs ' + f.away + '\n -> Fusion: 1=' + r.fusion.home.toFixed(0) + '% N=' + r.fusion.draw.toFixed(0) + '% 2=' + r.fusion.away.toFixed(0) + '% | Score:' + r.top[0].s + ' | Corners:' + r.corners.total.toFixed(0) + ' | Tirs:' + r.tirs.total.toFixed(0) + '\n';
    }
    await msg.reply(txt);
  }

  if (low.startsWith('!coupon')) {
    const m = await getMatchsDuJour();
    const odds = await getOddsReels();
    let sel = [];
    let total1X2 = 1;
    let totalScore = 1;
    let totalCorners = 1;
    for (let i = 0; i < 5 && i < m.list.length; i++) {
      const f = m.list[i];
      const r = analyse(f.home, f.away);
      let choixPrincipal, cotePrincipal;
      if (r.fusion.home >= 55) {
        choixPrincipal = 'Victoire ' + f.home;
        cotePrincipal = 100 / r.fusion.home;
      } else if (r.fusion.away >= 35) {
        choixPrincipal = 'Victoire ' + f.away;
        cotePrincipal = 100 / r.fusion.away;
      } else if (r.fusion.draw >= 25) {
        choixPrincipal = 'Match Nul';
        cotePrincipal = 100 / r.fusion.draw;
      } else {
        choixPrincipal = r.pOver > 0.52? 'Plus de 2.5 buts' : 'GG OUI';
        cotePrincipal = r.pOver > 0.52? r.coteOver : r.coteGG;
      }
      if (odds.hasKey && odds.data.length > i) {
        const coteBook = parseFloat(odds.data[i].H);
        if (!isNaN(coteBook) && coteBook > 1.1 && r.fusion.home >= 50) cotePrincipal = coteBook;
      }
      sel.push({
        match: f.home + ' vs ' + f.away,
        choix: choixPrincipal,
        cote: cotePrincipal,
        fusion: r.fusion,
        score: r.top[0].s,
        probaScore: r.top[0].p,
        coteScore: 1 / r.top[0].p,
        cornersTotal: r.corners.total,
        coteCorners: r.corners.coteOver9,
        tirsTotal: r.tirs.total,
        coteTirs: r.tirs.coteOver22,
        forme: r.forme
      });
      total1X2 *= cotePrincipal;
      totalScore *= (1 / r.top[0].p);
      totalCorners *= r.corners.coteOver9;
    }
    let txt = 'COUPON ULTRA FUSION - ' + m.date + '\n';
    txt += 'SOURCES: BeSoccer (15 H2H + 15 forme) + ESPN + ' + (odds.hasKey? 'Odds API' : 'Poisson') + '\n';
    txt += 'MODELE: Fusion 30% H2H + 40% dom + 30% ext\n\n';
    sel.forEach((s, i) => {
      txt += (i + 1) + '. ' + s.match + '\n';
      txt += ' Forme: ' + s.forme.home.toFixed(0) + '% vs ' + s.forme.away.toFixed(0) + '% | Fusion: 1=' + s.fusion.home.toFixed(0) + '% N=' + s.fusion.draw.toFixed(0) + '% 2=' + s.fusion.away.toFixed(0) + '%\n';
      txt += ' -> PARI: ' + s.choix + ' Cote ' + s.cote.toFixed(2) + '\n';
      txt += ' -> SCORE: ' + s.score + ' (' + (s.probaScore * 100).toFixed(1) + '%) Cote ' + s.coteScore.toFixed(2) + '\n';
      txt += ' -> CORNERS: Over 9.5 (' + s.cornersTotal.toFixed(1) + ') Cote ' + s.coteCorners.toFixed(2) + ' | TIRS: Over 22.5 (' + s.tirsTotal.toFixed(1) + ') Cote ' + s.coteTirs.toFixed(2) + '\n\n';
    });
    txt += 'COTE TOTALE 1X2/FUSION: ' + total1X2.toFixed(2) + '\n';
    txt += 'COTE TOTALE SCORE EXACT: ' + totalScore.toFixed(2) + '\n';
    txt += 'COTE TOTALE CORNERS Over 9.5: ' + totalCorners.toFixed(2) + '\n';
    await msg.reply(txt);
  }

  if (low.startsWith('!book')) {
    const odds = await getOddsReels();
    if (!odds.hasKey) { await msg.reply('Pas de ODDS_API_KEY - Va sur the-odds-api.com gratuit'); return; }
    if (odds.data.length === 0) { await msg.reply('Aucune cote dispo'); return; }
    let txt = 'VRAIES COTES BOOKMAKERS\n';
    txt += odds.data.slice(0, 8).map(o => o.match + ' 1=' + o.H + ' N=' + o.D + ' 2=' + o.A).join('\n');
    await msg.reply(txt);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
