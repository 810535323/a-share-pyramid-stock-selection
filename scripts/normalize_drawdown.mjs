#!/usr/bin/env node
/**
 * Fetch forward-adjusted (qfq) A-share daily K-lines, compute drawdowns from
 * early-period peak and full-period peak, and output a Markdown + JSON summary
 * with normalized group averages (Base = 100%).
 *
 * Usage:
 *   node normalize_drawdown.mjs --beg 20260701 --end 20261126 \
 *     --stocks "上游:002371:北方华创,上游:688019:安集科技,中游:688981:中芯国际,基准:588170:科创半导ETF" \
 *     [--early-days 15] [--out ./result.json]
 */

import fs from 'node:fs';

function parseArgs(argv) {
  const args = { beg: '20260701', end: '', earlyDays: 15, stocks: '', out: '' };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--beg') args.beg = argv[++i];
    else if (k === '--end') args.end = argv[++i];
    else if (k === '--early-days') args.earlyDays = Number(argv[++i]);
    else if (k === '--stocks') args.stocks = argv[++i];
    else if (k === '--out') args.out = argv[++i];
  }
  if (!args.end) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    args.end = `${y}${m}${d}`;
  }
  return args;
}

function inferMarket(code) {
  if (/^(6|5)/.test(code)) return { market: 'sh', secid: `1.${code}` };
  if (/^(0|3|1)/.test(code)) return { market: 'sz', secid: `0.${code}` };
  return { market: 'bj', secid: `0.${code}` };
}

function fmtDate(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

async function fetchTencent(code, beg, end) {
  const { market } = inferMarket(code);
  const sym = `${market}${code}`;
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${sym},day,${fmtDate(beg)},${fmtDate(end)},320,qfq`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const json = await res.json();
  const node = json?.data?.[sym];
  const arr = node?.qfqday || node?.day;
  if (!arr?.length) throw new Error(`No Tencent data for ${sym}`);
  return arr.map(r => ({ date: r[0], open: +r[1], close: +r[2], high: +r[3], low: +r[4], vol: +r[5] }));
}

async function fetchEastmoney(code, beg, end) {
  const { secid } = inferMarket(code);
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56&klt=101&fqt=1&beg=${beg}&end=${end}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const json = await res.json();
  const arr = json?.data?.klines;
  if (!arr?.length) throw new Error(`No Eastmoney data for ${secid}`);
  return arr.map(line => {
    const [date, open, close, high, low, vol] = line.split(',');
    return { date, open: +open, close: +close, high: +high, low: +low, vol: +vol };
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.stocks) {
    console.error('Missing --stocks "Group:Code:Name,..."');
    process.exit(1);
  }

  const items = args.stocks.split(',').map(s => {
    const [group, code, name] = s.split(':').map(x => x.trim());
    return { group, code, name: name || code };
  });

  const begDt = new Date(fmtDate(args.beg));
  const earlyCutoffDt = new Date(begDt.getTime() + args.earlyDays * 86400000);
  const earlyCutoff = earlyCutoffDt.toISOString().slice(0, 10);

  const results = [];
  for (const item of items) {
    let klines = null;
    let source = '';
    try {
      klines = await fetchTencent(item.code, args.beg, args.end);
      source = 'tencent';
    } catch (e1) {
      try {
        klines = await fetchEastmoney(item.code, args.beg, args.end);
        source = 'eastmoney';
      } catch (e2) {
        console.error(`[WARN] Failed ${item.code} ${item.name}: ${e1.message} | ${e2.message}`);
        continue;
      }
    }

    const first = klines[0];
    const latest = klines[klines.length - 1];
    const earlySlice = klines.filter(k => k.date <= earlyCutoff);
    const earlyPeak = (earlySlice.length ? earlySlice : [first]).reduce((a, b) => (b.high > a.high ? b : a));
    const fullPeak = klines.reduce((a, b) => (b.high > a.high ? b : a));

    results.push({
      ...item,
      source,
      bars: klines.length,
      firstDate: first.date,
      firstClose: first.close,
      earlyPeakDate: earlyPeak.date,
      earlyPeakHigh: earlyPeak.high,
      fullPeakDate: fullPeak.date,
      fullPeakHigh: fullPeak.high,
      latestDate: latest.date,
      latestClose: latest.close,
      chgFromStartPct: +(((latest.close - first.close) / first.close) * 100).toFixed(2),
      ddFromEarlyPeakPct: +(((latest.close - earlyPeak.high) / earlyPeak.high) * 100).toFixed(2),
      ddFromFullPeakPct: +(((latest.close - fullPeak.high) / fullPeak.high) * 100).toFixed(2),
      normalizedFromEarlyPeak: klines.map(k => ({ d: k.date, v: +((k.close / earlyPeak.high) * 100).toFixed(2) })),
      normalizedFromStart: klines.map(k => ({ d: k.date, v: +((k.close / first.close) * 100).toFixed(2) })),
    });
  }

  // Group summary
  const groups = {};
  for (const r of results) {
    if (!groups[r.group]) groups[r.group] = [];
    groups[r.group].push(r);
  }

  console.log('| 环节 | 代码 | 名称 | 起始收盘 | 期初高点(日期) | 最新收盘(日期) | 较期初高点回调 | 较起始日涨跌 |');
  console.log('| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |');
  for (const [g, list] of Object.entries(groups)) {
    const avgDD = (list.reduce((a, x) => a + x.ddFromEarlyPeakPct, 0) / list.length).toFixed(2);
    const avgChg = (list.reduce((a, x) => a + x.chgFromStartPct, 0) / list.length).toFixed(2);
    console.log(`| **${g}均值** | *${list.length}只* | — | — | — | — | **${avgDD}%** | **${avgChg}%** |`);
    for (const r of list.sort((a, b) => b.ddFromEarlyPeakPct - a.ddFromEarlyPeakPct)) {
      console.log(`| ${g} | \`${r.code}\` | ${r.name} | ${r.firstClose} | ${r.earlyPeakHigh} (${r.earlyPeakDate}) | ${r.latestClose} (${r.latestDate}) | ${r.ddFromEarlyPeakPct}% | ${r.chgFromStartPct >= 0 ? '+' : ''}${r.chgFromStartPct}% |`);
    }
  }

  if (args.out) {
    fs.writeFileSync(args.out, JSON.stringify({ args, results }, null, 2));
    console.error(`[OK] Wrote JSON output to ${args.out}`);
  }
}

main();
