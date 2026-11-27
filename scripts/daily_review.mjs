#!/usr/bin/env node
/**
 * A-Share Pyramid V3.2-Lite (17-Feature Pruned VPTS-Barbell) Daily Review Engine
 * Pruned via 11-year ablation: removed zombieDry, 15d timeStop, +20% early trim;
 * standardized divergenceVolRatio=0.70 & hardStopPct=-10%.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, '..');

// ===================== 1. Utilities =====================
function parseArgs(argv) {
  const args = {
    date: null,
    format: 'md',
    provider: 'auto', // auto | tencent | eastmoney | sina
    watchlist: path.join(SKILL_ROOT, 'config', 'watchlist.json'),
    portfolio: path.join(SKILL_ROOT, 'config', 'portfolio.json'),
    cache: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--date' && argv[i + 1]) args.date = argv[++i];
    else if (k === '--format' && argv[i + 1]) args.format = argv[++i];
    else if (k === '--provider' && argv[i + 1]) args.provider = argv[++i];
    else if (k === '--watchlist' && argv[i + 1]) args.watchlist = argv[++i];
    else if (k === '--portfolio' && argv[i + 1]) args.portfolio = argv[++i];
    else if (k === '--cache' && argv[i + 1]) args.cache = argv[++i];
  }
  return args;
}

async function fetchJsonWithTimeout(url, headers = {}, timeoutMs = 6500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ...headers },
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithTimeout(url, headers = {}, timeoutMs = 6500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ...headers },
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function calcMA(bars, idx, period) {
  if (idx < period - 1) return null;
  let sum = 0;
  for (let j = idx - period + 1; j <= idx; j++) sum += bars[j].c;
  return sum / period;
}

function calcVolMA(bars, idx, period) {
  if (idx < period - 1) return null;
  let sum = 0;
  for (let j = idx - period + 1; j <= idx; j++) sum += bars[j].v;
  return sum / period;
}

/** Weighted log-linear regression annualized momentum * R^2 (25-day Seven-Star metric) */
function calcMom25(values) {
  const n = values.length;
  if (n < 15) return null;
  const ys = values.map(v => Math.log(Math.max(1e-6, v)));
  let sw = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    const w = 1 + i / (n - 1);
    sw += w; sx += w * i; sy += w * ys[i];
  }
  const mx = sx / sw, my = sy / sw;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const w = 1 + i / (n - 1);
    const dx = i - mx, dy = ys[i] - my;
    sxy += w * dx * dy; sxx += w * dx * dx; syy += w * dy * dy;
  }
  if (sxx <= 0 || syy <= 0) return 0;
  const slope = sxy / sxx;
  const r2 = (sxy * sxy) / (sxx * syy);
  const annRet = Math.exp(slope * 250) - 1;
  return +(annRet * r2 * 100).toFixed(1);
}

// ===================== 1.5 Multi-Source DataProvider =====================
export class DataProvider {
  constructor(preferred = 'auto') {
    this.preferred = preferred;
    this.klineStats = { tencent: 0, eastmoney: 0, sina: 0, sohu: 0, failed: 0 };
    this.navStats = { eastmoney: 0, sina: 0, failed: 0 };
    this.sentimentSource = 'none';
  }

  async _klineTencent(market, code, days, isIndex) {
    const sym = `${market}${code}`;
    const adj = isIndex ? '' : 'qfq';
    // Tencent drops the latest session for qfq stocks when an explicit date range
    // (`day,start,end,count,qfq`) is passed, while indices still include today.
    // Omitting the dates (`day,,,count,qfq`) returns today's bar consistently.
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${sym},day,,,${days},${adj}`;
    const json = await fetchJsonWithTimeout(url);
    const node = json?.data?.[sym];
    const arr = node?.[`${adj}day`] || node?.day;
    if (!arr?.length) throw new Error('empty');
    return arr.map(r => ({ d: r[0], o: +r[1], c: +r[2], h: +r[3], l: +r[4], v: +r[5] })).filter(b => b.c > 0 && b.o > 0);
  }

  async _klineEastmoney(market, code, days, isIndex) {
    const secid = `${market === 'sh' ? 1 : 0}.${code}`;
    const fqt = isIndex ? 0 : 1;
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56&klt=101&fqt=${fqt}&end=20500101&lmt=${days}`;
    const json = await fetchJsonWithTimeout(url, { Referer: 'https://quote.eastmoney.com/' });
    const arr = json?.data?.klines;
    if (!arr?.length) throw new Error('empty');
    return arr.map(line => {
      const [d, o, c, h, l, v] = line.split(',');
      return { d, o: +o, c: +c, h: +h, l: +l, v: +v };
    }).filter(b => b.c > 0 && b.o > 0);
  }

  async _klineSina(market, code, days) {
    const sym = `${market}${code}`;
    const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${sym}&scale=240&ma=no&datalen=${days}`;
    const arr = await fetchJsonWithTimeout(url, { Referer: 'https://finance.sina.com.cn/' });
    if (!Array.isArray(arr) || !arr.length) throw new Error('empty');
    return arr.map(r => ({ d: r.day.slice(0, 10), o: +r.open, c: +r.close, h: +r.high, l: +r.low, v: +r.volume })).filter(b => b.c > 0 && b.o > 0);
  }

  async _klineSohu(market, code, isIndex) {
    if (isIndex) throw new Error('index unsupported');
    const end = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const start = new Date(Date.now() - 320 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://q.stock.sohu.com/hisHq?code=cn_${code}&start=${start}&end=${end}`;
    const json = await fetchJsonWithTimeout(url);
    const hq = json?.[0]?.hq;
    if (!Array.isArray(hq) || !hq.length) throw new Error('empty');
    return hq.map(r => ({ d: r[0], o: +r[1], c: +r[2], h: +r[6], l: +r[5], v: +r[7] })).filter(b => b.c > 0 && b.o > 0).reverse();
  }

  async fetchKline(market, code, days = 160, isIndex = false, minExpectedDate = null) {
    const chain = {
      auto: ['eastmoney', 'tencent', 'sina', 'sohu'],
      tencent: ['tencent', 'eastmoney', 'sina', 'sohu'],
      eastmoney: ['eastmoney', 'tencent', 'sina', 'sohu'],
      sina: ['sina', 'eastmoney', 'tencent', 'sohu'],
    }[this.preferred] || ['eastmoney', 'tencent', 'sina', 'sohu'];

    let bestBars = null, bestSrc = null, bestLastDate = '';
    for (const src of chain) {
      try {
        let bars = null;
        if (src === 'tencent') bars = await this._klineTencent(market, code, days, isIndex);
        else if (src === 'eastmoney') bars = await this._klineEastmoney(market, code, days, isIndex);
        else if (src === 'sina') bars = await this._klineSina(market, code, days);
        else if (src === 'sohu') bars = await this._klineSohu(market, code, isIndex);
        if (bars && bars.length >= 65) {
          const lastD = bars[bars.length - 1].d;
          if (!bestBars || lastD > bestLastDate) {
            bestBars = bars; bestSrc = src; bestLastDate = lastD;
          }
          // Accept immediately when fresh enough (or no date expectation set)
          if (!minExpectedDate || lastD >= minExpectedDate) {
            this.klineStats[src]++;
            return bars;
          }
        }
      } catch {}
    }
    if (bestBars) {
      this.klineStats[bestSrc]++;
      return bestBars;
    }
    this.klineStats.failed++;
    return [];
  }

  /** Fetch official ETF NAV & accumulated NAV history (EM pingzhongdata -> Sina backup) */
  async fetchEtfNav(code) {
    // Primary: Eastmoney pingzhongdata (fast, stable, no TLS reset)
    try {
      const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`;
      const txt = await fetchTextWithTimeout(url, { Referer: `https://fund.eastmoney.com/${code}.html` }, 7000);
      const mNav = txt.match(/Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
      const mAcc = txt.match(/Data_ACWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
      if (mNav) {
        const navArr = JSON.parse(mNav[1]);
        const accArr = mAcc ? JSON.parse(mAcc[1]) : [];
        if (navArr.length) {
          const tail = navArr.slice(-40).map(x => ({
            d: new Date(x.x + 8 * 3600000).toISOString().slice(0, 10),
            nav: Number(x.y)
          })).filter(x => x.nav > 0);
          const accTail = accArr.slice(-40).map(x => ({
            d: new Date(x[0] + 8 * 3600000).toISOString().slice(0, 10),
            acc: Number(x[1])
          })).filter(x => x.acc > 0);
          this.navStats.eastmoney++;
          return { source: 'eastmoney', navSeries: tail, accSeries: accTail };
        }
      }
    } catch {}

    // Backup: Sina Fund NAV OpenAPI
    try {
      const url = `https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/CaihuiFundInfoService.getNav?symbol=${code}&page=1&num=40`;
      const json = await fetchJsonWithTimeout(url, { Referer: 'https://finance.sina.com.cn/' }, 7000);
      const rows = json?.result?.data?.data;
      if (Array.isArray(rows) && rows.length) {
        const rev = [...rows].reverse();
        const navSeries = rev.map(r => ({ d: r.fbrq.slice(0, 10), nav: Number(r.jjjz) })).filter(x => x.nav > 0);
        const accSeries = rev.map(r => ({ d: r.fbrq.slice(0, 10), acc: Number(r.ljjz) })).filter(x => x.acc > 0);
        this.navStats.sina++;
        return { source: 'sina', navSeries, accSeries };
      }
    } catch {}

    this.navStats.failed++;
    return null;
  }

  async fetchSentiment(reviewDate, isLatestDay) {
    const dt = reviewDate.replace(/-/g, '');
    const out = {
      date: reviewDate,
      available: false,
      limitUpCount: null,
      limitDownCount: null,
      upCount: null,
      downCount: null,
      flatCount: null,
    };
    const used = [];

    try {
      const uDT = `https://push2ex.eastmoney.com/getTopicDTPool?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=1&sort=fund%3Aasc&date=${dt}`;
      const uZT = `https://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=1&sort=fbt%3Aasc&date=${dt}`;
      const [rDT, rZT] = await Promise.all([fetchJsonWithTimeout(uDT), fetchJsonWithTimeout(uZT)]);
      if (rDT?.data?.tc != null || rDT?.rc === 0) {
        out.limitDownCount = rDT?.data?.tc != null ? Number(rDT.data.tc) : 0;
        out.limitUpCount = rZT?.data?.tc != null ? Number(rZT.data.tc) : 0;
        out.available = true;
        used.push('东财涨跌停池');
      }
    } catch {}

    if (out.limitDownCount == null && isLatestDay) {
      try {
        const uSinaDT = 'https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page=1&num=80&sort=changepercent&asc=1&node=hs_a';
        const uSinaZT = 'https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page=1&num=100&sort=changepercent&asc=0&node=hs_a';
        const [arrDT, arrZT] = await Promise.all([fetchJsonWithTimeout(uSinaDT), fetchJsonWithTimeout(uSinaZT)]);
        if (Array.isArray(arrDT)) {
          out.limitDownCount = arrDT.filter(x => Number(x.changepercent) <= -9.85).length;
          out.limitUpCount = Array.isArray(arrZT) ? arrZT.filter(x => Number(x.changepercent) >= 9.85).length : null;
          out.available = true;
          used.push('新浪行情中心(备源)');
        }
      } catch {}
    }

    if (out.limitDownCount == null && isLatestDay) {
      try {
        const uC = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=0&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f3';
        const jC = await fetchJsonWithTimeout(uC, { Referer: 'https://quote.eastmoney.com/' });
        if (Array.isArray(jC?.data?.diff)) {
          out.limitDownCount = jC.data.diff.filter(x => typeof x.f3 === 'number' && x.f3 <= -9.85).length;
          out.available = true;
          used.push('东财全A扫描(备源)');
        }
      } catch {}
    }

    if (isLatestDay) {
      try {
        const uB = 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001,0.899050&fields=f12,f14,f104,f105,f106';
        const rB = await fetchJsonWithTimeout(uB, { Referer: 'https://quote.eastmoney.com/' });
        const diff = rB?.data?.diff;
        if (Array.isArray(diff) && diff.length) {
          out.upCount = diff.reduce((s, x) => s + (Number(x.f104) || 0), 0);
          out.downCount = diff.reduce((s, x) => s + (Number(x.f105) || 0), 0);
          out.flatCount = diff.reduce((s, x) => s + (Number(x.f106) || 0), 0);
          out.available = true;
          used.push('东财全A广度');
        }
      } catch {}
    }

    this.sentimentSource = used.length ? used.join(' + ') : '未获取到';
    return out;
  }

  getHealthSummary() {
    const kParts = Object.entries(this.klineStats).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`);
    const nParts = Object.entries(this.navStats).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`);
    return `K线[${kParts.join(', ') || 'cache'}] · 净值[${nParts.join(', ') || 'cache'}] · 情绪[${this.sentimentSource}]`;
  }
}

// ===================== 2. MarketSentiment Object =====================
export class MarketSentiment {
  constructor(raw = null, rules = {}) {
    this.raw = raw || { available: false };
    this.maxLimitDown = rules.maxLimitDown ?? 10;
    this.minAdvancing = rules.minAdvancing ?? 3000;
  }

  evaluate() {
    if (!this.raw || !this.raw.available) {
      return {
        available: false,
        pass: true,
        label: '⚪ 离线模式未抓取情绪（实盘请核对全A跌停<10 & 红盘>3000）',
        limitUpCount: null, limitDownCount: null, upCount: null, downCount: null, flatCount: null,
      };
    }
    const dtOk = this.raw.limitDownCount == null ? true : this.raw.limitDownCount < this.maxLimitDown;
    const upOk = this.raw.upCount == null ? true : this.raw.upCount > this.minAdvancing;
    const pass = dtOk && upOk;
    let label;
    if (pass) label = '🟢 情绪健康（亏钱效应止血 + 普涨承接）';
    else if (!dtOk && !upOk) label = '🔴 情绪冰点/恐慌（跌停偏多且普跌）';
    else if (!dtOk) label = `🔴 亏钱效应未止血（跌停 ${this.raw.limitDownCount} ≥ ${this.maxLimitDown}）`;
    else label = `🟡 情绪偏弱（红盘仅 ${this.raw.upCount} ≤ ${this.minAdvancing}）`;

    return {
      available: true, dtOk, upOk, pass, label,
      limitUpCount: this.raw.limitUpCount,
      limitDownCount: this.raw.limitDownCount,
      upCount: this.raw.upCount,
      downCount: this.raw.downCount,
      flatCount: this.raw.flatCount,
      maxLimitDown: this.maxLimitDown,
      minAdvancing: this.minAdvancing,
    };
  }
}

// ===================== 3. Stock Object (V3.1 Base B + Exit 4) =====================
export class Stock {
  constructor(meta, bars = []) {
    this.code = meta.code;
    this.market = meta.market;
    this.name = meta.name;
    this.tier = meta.tier || '';
    this.trackName = meta.trackName || '';
    this.fundamentalPass = meta.fundamentalPass !== false;
    this.isEtfSubstitute = Boolean(meta.isEtfSubstitute);
    this.allowMainboardAccount = Boolean(meta.allowMainboardAccount);
    this.q3Summary = meta.q3Summary || '';
    this.score = meta.score ?? null;
    this.bars = bars;
    this.snapshot = null;
  }

  get isMainboard() {
    return this.code.startsWith('60') || this.code.startsWith('00');
  }

  get isMainboardEligible() {
    return this.isMainboard || this.allowMainboardAccount;
  }

  get boardLabel() {
    if (this.isEtfSubstitute) return 'ETF替补';
    if (this.code.startsWith('688')) return '科创板';
    if (this.code.startsWith('30')) return '创业板';
    return '主板';
  }

  evaluate(targetDate = null, rules = {}) {
    if (!this.bars.length) return null;
    let idx = this.bars.length - 1;
    if (targetDate) {
      idx = -1;
      for (let i = this.bars.length - 1; i >= 0; i--) {
        if (this.bars[i].d <= targetDate) { idx = i; break; }
      }
    }
    if (idx < 60) return null;

    const volMin = rules.volBandMin ?? 1.20;
    const volMax = rules.volBandMax ?? 2.80;
    const divVolRatio = rules.divergenceVolRatio ?? 0.70;

    const b = this.bars[idx];
    const prev = this.bars[idx - 1];
    const prev2 = this.bars[idx - 2];

    const m5 = calcMA(this.bars, idx, 5);
    const m10 = calcMA(this.bars, idx, 10);
    const m20 = calcMA(this.bars, idx, 20);
    const pm20 = calcMA(this.bars, idx - 3, 20);
    const m60 = calcMA(this.bars, idx, 60);

    const m10Prev = calcMA(this.bars, idx - 1, 10);
    const m20Prev = calcMA(this.bars, idx - 1, 20);
    const pm20Prev = idx >= 24 ? calcMA(this.bars, idx - 4, 20) : null;
    const m60Prev = calcMA(this.bars, idx - 1, 60);

    const vm5 = calcVolMA(this.bars, idx, 5);
    const vm20 = calcVolMA(this.bars, idx, 20);
    const vm20Prev = calcVolMA(this.bars, idx - 1, 20);

    let high15 = 0;
    for (let j = idx - 15; j < idx; j++) if (this.bars[j].c > high15) high15 = this.bars[j].c;
    let high15Prev = 0;
    for (let j = Math.max(0, idx - 16); j < idx - 1; j++) if (this.bars[j].c > high15Prev) high15Prev = this.bars[j].c;
    let high10 = 0;
    for (let j = idx - 10; j < idx; j++) if (this.bars[j].c > high10) high10 = this.bars[j].c;

    let maxVma5_20 = 0;
    for (let j = Math.max(5, idx - 20); j < idx; j++) {
      const v5j = calcVolMA(this.bars, j, 5);
      if (v5j && v5j > maxVma5_20) maxVma5_20 = v5j;
    }

    const chgPct = ((b.c - prev.c) / prev.c) * 100;
    const chg = chgPct / 100;
    const chgPrev = prev2 ? (prev.c - prev2.c) / prev2.c : 0;
    const ret20Pct = ((b.c - this.bars[idx - 20].c) / this.bars[idx - 20].c) * 100;
    const peak60 = Math.max(...this.bars.slice(idx - 60, idx + 1).map(x => x.h));
    const dd60Pct = ((b.c - peak60) / peak60) * 100;

    const volRatio5d = vm5 > 0 ? b.v / vm5 : 1;
    const volRatio20d = vm20 > 0 ? b.v / vm20 : 1;
    const volRatio20dPrev = vm20Prev > 0 ? prev.v / vm20Prev : 1;

    const aboveMa20 = b.c > m20;
    const aboveMa60 = b.c > m60;
    const prevAboveMa60 = prev.c > m60Prev;
    const ma20Rising = m20 >= pm20 * 0.998;

    // V3.2-Lite Base B Hybrid Entry Signals (zombieDry pruned via ablation)
    // B1: Shrinking-volume pullback to rising MA10/MA20 support
    const nearSupport = (Math.abs(b.l - m10) / m10 <= 0.022 || Math.abs(b.l - m20) / m20 <= 0.025) && b.c >= m20 * 0.99;
    const isB1 = aboveMa60 && ma20Rising && m10 > m20 && nearSupport && b.v < vm5 * 0.85 && b.c >= b.o && chg >= -0.01 && chg <= 0.045;

    // B2-T1: Yesterday mild breakout (1.2-2.8x VMA20) + today non-engulfing hold
    const prevBreakout = Boolean(
      m20Prev && pm20Prev && m10Prev && m60Prev && vm20Prev &&
      prev.c > prev.o && prev.c > high15Prev && prev.c > m20Prev && prev.c > m60Prev &&
      m20Prev >= pm20Prev * 0.998 &&
      volRatio20dPrev >= volMin && volRatio20dPrev <= volMax &&
      chgPrev >= 0.015 && chgPrev <= 0.075
    );
    const todayHold = aboveMa60 && b.c >= prev.o && b.c >= Math.min(prev.c * 0.985, Math.max(m5, m10)) && b.c >= m10 * 0.995 && chg >= -0.025 && chg <= 0.06;
    const isB2_T1 = prevBreakout && todayHold;

    // B2-T0 Raw: Today mild breakout (needs Track sectorVolRatio>=1.0 & >=2 sync peers to trigger T0; else T+1 watch)
    const isB2_T0_Raw = aboveMa60 && b.c > high15 && aboveMa20 && ma20Rising &&
      volRatio20d >= volMin && volRatio20d <= volMax && chg >= 0.015 && chg <= 0.07;

    // Extreme climax breakout (>=3.0x VMA20) flagged for explicit V3.1 rejection
    const isClimaxReject = aboveMa60 && b.c > high15 && aboveMa20 && ma20Rising && volRatio20d >= 3.0 && chg >= 0.015;

    // Sector sync peer qualifier (close > open, > MA5, > MA10, vol >= 1.2x VMA20)
    const isSyncBull = b.c > b.o && b.c > m5 && b.c > m10 && volRatio20d >= volMin;

    // Exit 4 indicators
    const brokenMa20TwoDays = b.c < m20 && prev.c < m20Prev;
    const brokenMa60TwoDays = b.c < m60 && prev.c < m60Prev;
    const belowMa10 = b.c < m10;
    const priceNewHighVolDiv = b.c > high10 && vm5 > 0 && maxVma5_20 > 0 && vm5 < maxVma5_20 * divVolRatio;

    // Daily turnover & 20-day average turnover for track turnover ratio
    const turnover = b.v * b.c;
    let turnoverSum20 = 0;
    for (let j = idx - 20; j < idx; j++) turnoverSum20 += this.bars[j].v * this.bars[j].c;
    const turnoverAvg20 = turnoverSum20 / 20;

    this.snapshot = {
      date: b.d,
      close: +b.c.toFixed(this.isEtfSubstitute ? 3 : 2),
      prevClose: +prev.c.toFixed(this.isEtfSubstitute ? 3 : 2),
      chgPct: +chgPct.toFixed(2),
      ma5: +m5.toFixed(2),
      ma10: +m10.toFixed(2),
      ma20: +m20.toFixed(2),
      ma60: +m60.toFixed(2),
      distMa60Pct: +(((b.c - m60) / m60) * 100).toFixed(1),
      volRatio5d: +volRatio5d.toFixed(2),
      volRatio20d: +volRatio20d.toFixed(2),
      ret20Pct: +ret20Pct.toFixed(1),
      dd60Pct: +dd60Pct.toFixed(1),
      aboveMa20,
      aboveMa60,
      prevAboveMa60,
      ma20Rising,
      isB1,
      isB2_T1,
      isB2_T0_Raw,
      isClimaxReject,
      isSyncBull,
      brokenMa20TwoDays,
      brokenMa60TwoDays,
      belowMa10,
      priceNewHighVolDiv,
      turnover,
      turnoverAvg20,
      signal: null,       // Finalized in Track.evaluate() with sector resonance
      watchSignal: null,  // B2-待次日T+1确认
    };
    return this.snapshot;
  }
}

// ===================== 4. Track (Sector) Object =====================
export class Track {
  constructor(cfg, rules = {}) {
    this.id = cfg.id;
    this.name = cfg.name;
    this.etfProxy = cfg.etfProxy || '';
    this.policyTier = cfg.policyTier || '第一档·硬工程';
    this.watchOnly = Boolean(cfg.watchOnly);
    this.benchmarkCodes = cfg.benchmarkCodes || ['000300'];
    this.rules = rules;
    this.breadthThresholdPct = rules.breadthThresholdPct ?? 40;
    this.minSyncPeersForT0 = rules.minSyncPeersForT0 ?? 2;
    this.stocks = (cfg.stocks || []).map(s => new Stock({ ...s, trackName: cfg.name }));
    this.status = null;
  }

  evaluate(targetDate = null) {
    let valid = 0, aboveMa60 = 0, prevAboveMa60 = 0, aboveMa20 = 0;
    let syncBullCount = 0, secTurnover = 0, secTurnoverAvg20 = 0;

    for (const s of this.stocks) {
      const snap = s.evaluate(targetDate, this.rules);
      if (!snap) continue;
      // Keep track breadth & peer count strictly on constituent stocks (do not double-count ETF substitute)
      if (s.isEtfSubstitute) continue;
      valid++;
      if (snap.aboveMa60) aboveMa60++;
      if (snap.prevAboveMa60) prevAboveMa60++;
      if (snap.aboveMa20) aboveMa20++;
      if (snap.isSyncBull) syncBullCount++;
      secTurnover += snap.turnover;
      secTurnoverAvg20 += snap.turnoverAvg20;
    }

    const sectorVolRatio = secTurnoverAvg20 > 0 ? +(secTurnover / secTurnoverAvg20).toFixed(2) : 1.0;

    // Resolve final Base B Hybrid signals using sector turnover & peer resonance
    for (const s of this.stocks) {
      const snap = s.snapshot;
      if (!snap) continue;
      const peers = syncBullCount - (!s.isEtfSubstitute && snap.isSyncBull ? 1 : 0);
      const t0ResOk = snap.isB2_T0_Raw && sectorVolRatio >= 1.0 && peers >= this.minSyncPeersForT0;
      if (snap.isB2_T1) snap.signal = 'B2-T1确认';
      else if (t0ResOk) snap.signal = `B2-T0强共振(${peers}协同)`;
      else if (snap.isB1) snap.signal = 'B1缩量回踩';
      else if (snap.isB2_T0_Raw) snap.watchSignal = `B2初突待T+1确认(板块量${sectorVolRatio}x/协同${peers}只)`;
    }

    const breadthPct = valid ? +((aboveMa60 / valid) * 100).toFixed(1) : 0;
    const prevBreadthPct = valid ? +((prevAboveMa60 / valid) * 100).toFixed(1) : 0;
    const deltaPct = +(breadthPct - prevBreadthPct).toFixed(1);
    const isGreen = !this.watchOnly && breadthPct >= this.breadthThresholdPct;
    const isNearGreen = !this.watchOnly && !isGreen && breadthPct >= this.breadthThresholdPct - 10;
    const neededForGreen = Math.max(0, Math.ceil((this.breadthThresholdPct / 100) * valid) - aboveMa60);

    this.status = {
      id: this.id,
      name: this.name,
      etfProxy: this.etfProxy,
      watchOnly: this.watchOnly,
      total: valid,
      aboveMa60,
      prevAboveMa60,
      aboveMa20,
      breadthPct,
      prevBreadthPct,
      deltaPct,
      sectorVolRatio,
      syncBullCount,
      switchOpen: isGreen,
      switchLabel: this.watchOnly
        ? '👁️ 隔离观察(逻辑受损禁开)'
        : (isGreen ? '🟢 绿灯(允许开仓)' : (isNearGreen ? `🟡 准绿灯(差${neededForGreen}只)` : '🔴 红灯(禁止开仓)')),
      neededForGreen,
    };
    return this.status;
  }
}

// ===================== 5. V3.1 Strategy Object =====================
export class V3Strategy {
  constructor(portfolioCfg, tracks, benchmarksMap, sentimentObj = null, defenseETFs = [], globalRadar = []) {
    this.portfolio = portfolioCfg;
    this.rules = portfolioCfg.rules;
    this.tracks = tracks;
    this.benchmarksMap = benchmarksMap;
    this.sentimentObj = sentimentObj || new MarketSentiment(null, portfolioCfg.rules);
    this.defenseETFs = defenseETFs;   // [{ code, name, weight, bars, navInfo }]
    this.globalRadar = globalRadar;   // [{ code, name, qdii, bars, navInfo }]
  }

  _evalSingleIndex(idxObj, targetDate = null) {
    const bars = idxObj.bars || [];
    if (bars.length < 61) return null;
    let idx = bars.length - 1;
    if (targetDate) {
      idx = -1;
      for (let i = bars.length - 1; i >= 0; i--) {
        if (bars[i].d <= targetDate) { idx = i; break; }
      }
    }
    if (idx < 60) return null;
    const b = bars[idx], prev = bars[idx - 1];
    const m20 = calcMA(bars, idx, 20), m60 = calcMA(bars, idx, 60);
    const vm60 = calcVolMA(bars, idx, 60);
    const chgPct = +(((b.c - prev.c) / prev.c) * 100).toFixed(2);
    const above20 = b.c > m20, above60 = b.c > m60;
    const volRatio60d = vm60 > 0 ? +(b.v / vm60).toFixed(2) : null;

    let h60 = -Infinity, l60 = Infinity;
    for (let j = idx - 59; j <= idx; j++) {
      if (bars[j].h > h60) h60 = bars[j].h;
      if (bars[j].l < l60) l60 = bars[j].l;
    }
    const pos60Pct = h60 > l60 ? +(((b.c - l60) / (h60 - l60)) * 100).toFixed(0) : 50;
    const isDryVol = volRatio60d != null && volRatio60d < 0.70;
    const isHighClimax = pos60Pct >= 80 && volRatio60d != null && volRatio60d > 1.50;

    const status = above60
      ? (above20 ? '🟢 站稳MA60(多头)' : '🟢 站稳MA60(回踩)')
      : (above20 ? '🟡 MA60下反抽' : '🔴 破位MA60');

    return {
      code: idxObj.code, name: idxObj.name, style: idxObj.style,
      date: b.d, close: +b.c.toFixed(2), chgPct,
      ma20: +m20.toFixed(2), ma60: +m60.toFixed(2),
      above20, above60, volRatio60d, pos60Pct, isDryVol, isHighClimax, status
    };
  }

  evaluateMarketRegime(targetDate = null) {
    const indices = [];
    for (const obj of this.benchmarksMap.values()) {
      const ev = this._evalSingleIndex(obj, targetDate);
      if (ev) indices.push(ev);
    }
    const refDate = indices[0]?.date || targetDate;
    const total = indices.length || 1;
    const upCount = indices.filter(x => x.above60).length;
    const minUp = this.rules.fiveIndexFloorMinUp ?? 1;
    const allowNewEntries = upCount >= minUp;

    const dryCount = indices.filter(x => x.isDryVol).length;
    const smallClimaxCount = indices.filter(x => x.code !== '000300' && x.isHighClimax).length;

    const vpAlerts = [];
    if (dryCount >= 3) {
      vpAlerts.push(`💧 共振地量底部预警：${dryCount}/${total} 个宽基量能低于 60 日均量 0.70 倍（十年实证未来 20 日正收益胜率 ≈ 67%）`);
    }
    if (smallClimaxCount >= 2) {
      vpAlerts.push(`🔥 科技/小盘高位放量预警：${smallClimaxCount} 个成长宽基处 60 日高位 ≥80% 且放量 >1.5x（历史 5-10 日胜率 <40%，严禁追高）`);
    }

    let regime, exposureCap;
    if (upCount >= Math.ceil(total * 0.8)) {
      regime = `🟢 全面进攻期（${upCount}/${total} 宽基站稳 MA60）`;
      exposureCap = '100%（4满槽×25%）';
    } else if (allowNewEntries) {
      regime = `🟡 结构行情期（${upCount}/${total} 宽基站稳 MA60，放行绿灯赛道）`;
      exposureCap = '按绿灯赛道自然满槽（≤100%）';
    } else {
      regime = `🔴 五大宽基全灭底线触发（0/${total} 站稳 MA60 → 0% 新开仓）`;
      exposureCap = '0% 新开仓（闲钱进红利+国债哑铃）';
    }

    const indexByCode = Object.fromEntries(indices.map(x => [x.code, x]));
    return {
      date: refDate,
      indices,
      indexByCode,
      upCount,
      total,
      dryCount,
      smallClimaxCount,
      vpAlerts,
      regime,
      exposureCap,
      allowNewEntries,
      chgPct: +(indices.reduce((s, x) => s + x.chgPct, 0) / total).toFixed(2),
    };
  }

  /** Compute exact 100-share A-share integer lot plan & simplified V3.2-Lite exit tier */
  computeLotPlan(price, slotBudget) {
    const lotCost = +(price * 100).toFixed(0);
    const lots = Math.floor(slotBudget / (price * 100));
    const shares = lots * 100;
    const estAmount = +(shares * price).toFixed(0);
    let exitPlan;
    if (lots >= 2) {
      const trim = Math.max(1, Math.floor(lots * 0.5));
      const rem = lots - trim;
      exitPlan = `极简2档：+40%减${trim}手/留${rem}手守MA60(顶背离收MA10)`;
    } else if (lots === 1) {
      exitPlan = `1手全仓跟踪（+8%保本/顶背离收MA10/+40%守MA60）`;
    } else {
      exitPlan = `单手¥${lotCost.toLocaleString()}>单槽¥${Math.round(slotBudget).toLocaleString()}（跳过顺延）`;
    }
    return { lotCost, lots, shares, estAmount, affordable: lots >= 1, exitPlan };
  }

  auditHoldings(stockMap, reviewDate) {
    const results = [];
    const runnerTrig = this.rules.runnerTriggerPct ?? 40;
    const divTrig = this.rules.divergenceTriggerPct ?? 20;
    for (const pos of (this.portfolio.positions || [])) {
      const st = stockMap.get(pos.code);
      if (!st || !st.snapshot) {
        results.push({ ...pos, action: '⚠️ 未找到行情，需手动核对' });
        continue;
      }
      const s = st.snapshot;
      const pnlPct = +(((s.close - pos.avgCost) / pos.avgCost) * 100).toFixed(2);
      const prevPnlPct = s.prevClose ? +(((s.prevClose - pos.avgCost) / pos.avgCost) * 100).toFixed(2) : pnlPct;
      const hardStopPct = this.rules.hardStopPct ?? -10;
      const flashFloorPct = this.rules.flashCrashFloorPct ?? -15;
      const hardStopPrice = +(pos.avgCost * (1 + hardStopPct / 100)).toFixed(2);
      const breakevenPrice = +(pos.avgCost * (1 + this.rules.breakevenLockPct / 100)).toFixed(2);
      const runnerStopPrice = +(pos.avgCost * (1 + (this.rules.runnerStopLockPct ?? 15) / 100)).toFixed(2);
      const lots = Math.floor((pos.shares || 0) / 100);
      const isRunner = pos.wideMode === 'ma60';
      const isTight = Boolean(pos.tightMa10) || (!isRunner && pnlPct >= divTrig && s.priceNewHighVolDiv);

      let action = isRunner
        ? `🚀 零风险尾仓运行（守MA60=${s.ma60} / 保底+15%=${runnerStopPrice}）`
        : '✅ 正常持有（沿20日线跟踪）';

      if (pnlPct <= flashFloorPct) {
        action = `🔴 触及极端闪崩硬底线(${flashFloorPct}%) → 无条件立刻清仓`;
      } else if (pnlPct <= hardStopPct && prevPnlPct <= hardStopPct) {
        action = `🔴 连续2日收盘有效跌破(${hardStopPct}%) → 次日无条件清仓`;
      } else if (pnlPct <= hardStopPct) {
        action = `🟠 首日收盘破${hardStopPct}%（防盘中洗盘，观察明日收盘能否收回；破${flashFloorPct}%立刻走）`;
      } else if (isRunner && s.brokenMa60TwoDays) {
        action = '🔴 尾仓连续2日收破MA60 → 主升浪终结清仓';
      } else if (isTight && !isRunner && s.belowMa10) {
        action = `🔴 触发卖点④【价新高量背离+收破MA10(${s.ma10})】 → 立刻止盈落袋`;
      } else if (!isRunner && s.brokenMa20TwoDays) {
        action = '🔴 连续2日收破MA20 → 趋势结束清仓';
      } else if (!isRunner && pnlPct >= runnerTrig) {
        const trimLots = lots >= 2 ? Math.max(1, Math.floor(lots * (this.rules.runnerTrimRatio ?? 0.5))) : 0;
        action = trimLots > 0
          ? `🟣 浮盈达+${runnerTrig}% → 减半${trimLots}手落袋，余${lots - trimLots}手切【MA60宽尾仓+保底${runnerStopPrice}】，释放进攻槽位！`
          : `🟣 浮盈达+${runnerTrig}% → 切【MA60宽尾仓+保底${runnerStopPrice}】，释放进攻槽位！`;
      } else if (!isRunner && pnlPct >= divTrig && s.priceNewHighVolDiv) {
        action = `🟠 触发卖点④【价新高+量能背离(<0.70)】 → 止盈线从MA20(${s.ma20})收紧至MA10(${s.ma10})！`;
      } else if (pnlPct >= this.rules.breakevenTriggerPct) {
        action = `🟡 浮盈超+${this.rules.breakevenTriggerPct}% → 止损条件单上移至保本价 ${breakevenPrice}`;
      } else if (!st.fundamentalPass) {
        action = '🟠 季报已证伪 → 择机清仓移出';
      }

      results.push({
        code: pos.code, name: st.name, track: st.trackName,
        shares: pos.shares, lots, avgCost: pos.avgCost, close: s.close, pnlPct,
        ma10: s.ma10, ma20: s.ma20, ma60: s.ma60,
        volRatio20d: s.volRatio20d,
        priceNewHighVolDiv: s.priceNewHighVolDiv,
        mode: isRunner ? 'MA60宽尾仓' : (isTight ? 'MA10收紧' : 'MA20常规'),
        hardStopPrice: isRunner ? runnerStopPrice : hardStopPrice,
        action,
      });
    }
    return results;
  }

  /** Compute exact integer 100-share idle-cash barbell allocation (50% 512890 + 50% 511010 + Reverse Repo) */
  evaluateDefenseBarbell(idleCash, targetDate = null) {
    const items = [];
    let allocated = 0;
    for (const etf of this.defenseETFs) {
      const bars = etf.bars || [];
      let idx = bars.length - 1;
      if (targetDate) {
        idx = -1;
        for (let i = bars.length - 1; i >= 0; i--) if (bars[i].d <= targetDate) { idx = i; break; }
      }
      const b = idx >= 0 ? bars[idx] : null;
      const m60 = idx >= 59 ? calcMA(bars, idx, 60) : null;
      const price = b ? +b.c.toFixed(3) : null;
      const targetAmt = idleCash * (etf.weight ?? 0.5);
      const lotCost = price ? +(price * 100).toFixed(1) : null;
      const lots = price ? Math.floor(targetAmt / (price * 100)) : 0;
      const actualAmt = price ? +(lots * 100 * price).toFixed(0) : 0;
      allocated += actualAmt;
      items.push({
        code: etf.code, name: etf.name, weightPct: Math.round((etf.weight ?? 0.5) * 100),
        date: b?.d || '-', price, ma60: m60 ? +m60.toFixed(3) : null,
        lotCost, lots, shares: lots * 100, actualAmt,
        note: etf.code === '512890' ? '纯红利底仓（不做MA60择时，防来回打脸）' : '十年国债安全垫（整手买入，零头走逆回购）'
      });
    }
    const repoRemainder = Math.max(0, Math.round(idleCash - allocated));
    return {
      idleCash: Math.round(idleCash),
      items,
      allocated: Math.round(allocated),
      repoRemainder,
      oddLotFallback: this.rules.defenseBarbell?.oddLotFallback || '国债逆回购(131810/204001)',
    };
  }

  /** Read-only Seven-Star Global ETF NAV Premium Radar */
  evaluateGlobalRadar(targetDate = null) {
    const rows = [];
    for (const etf of this.globalRadar) {
      const bars = etf.bars || [];
      let idx = bars.length - 1;
      if (targetDate) {
        idx = -1;
        for (let i = bars.length - 1; i >= 0; i--) if (bars[i].d <= targetDate) { idx = i; break; }
      }
      if (idx < 25) continue;
      const b = bars[idx];
      const prev = bars[idx - 1];
      const m60 = idx >= 59 ? calcMA(bars, idx, 60) : null;
      const chgPct = +(((b.c - prev.c) / prev.c) * 100).toFixed(2);

      // Official NAV match (nearest date <= b.d)
      let nav = null, navDate = null, premPct = null, mom25 = null;
      const ns = etf.navInfo?.navSeries || [];
      const accs = etf.navInfo?.accSeries || [];
      for (let i = ns.length - 1; i >= 0; i--) {
        if (ns[i].d <= b.d) { nav = ns[i].nav; navDate = ns[i].d; break; }
      }
      if (nav && nav > 0) premPct = +(((b.c - nav) / nav) * 100).toFixed(2);

      // 25d momentum using official accNav if available (>=25 pts), else close
      const validAcc = accs.filter(x => x.d <= b.d).slice(-25).map(x => x.acc);
      if (validAcc.length >= 20) mom25 = calcMom25(validAcc);
      else mom25 = calcMom25(bars.slice(idx - 24, idx + 1).map(x => x.c));

      let premStatus = '⚪ 无净值';
      if (premPct != null) {
        if (premPct > 6) premStatus = '🔴 高溢价(>6%严禁买)';
        else if (premPct > 3) premStatus = '🟡 溢价偏高(3~6%)';
        else if (premPct < -1.5) premStatus = '🟢 折价';
        else premStatus = '🟢 正常(≤3%)';
      }

      rows.push({
        code: etf.code, name: etf.name, qdii: Boolean(etf.qdii),
        date: b.d, close: +b.c.toFixed(3), chgPct,
        ma60: m60 ? +m60.toFixed(3) : null,
        above60: m60 ? b.c > m60 : null,
        nav: nav ? +nav.toFixed(4) : null,
        navDate: navDate || '-',
        premPct, premStatus, mom25,
      });
    }
    rows.sort((a, b) => (b.mom25 ?? -999) - (a.mom25 ?? -999));
    return rows;
  }

  /** Build last-20-day composite market down-day map for the "大跌逆势照妖镜" resilience mirror */
  buildDownDays20(reviewDate) {
    const dayRets = new Map();
    for (const obj of this.benchmarksMap.values()) {
      const bars = obj.bars || [];
      let endIdx = bars.length - 1;
      for (let i = bars.length - 1; i >= 0; i--) if (bars[i].d <= reviewDate) { endIdx = i; break; }
      const startIdx = Math.max(1, endIdx - 19);
      for (let i = startIdx; i <= endIdx; i++) {
        const ret = ((bars[i].c - bars[i - 1].c) / bars[i - 1].c) * 100;
        const d = bars[i].d;
        if (!dayRets.has(d)) dayRets.set(d, { sum: 0, cnt: 0 });
        const rec = dayRets.get(d); rec.sum += ret; rec.cnt++;
      }
    }
    const all20 = [...dayRets.entries()]
      .map(([d, r]) => ({ d, mktChg: r.sum / r.cnt }))
      .sort((a, b) => a.d.localeCompare(b.d));
    let downDays = all20.filter(x => x.mktChg <= -0.8);
    if (downDays.length < 2) downDays = [...all20].sort((a, b) => a.mktChg - b.mktChg).slice(0, 4);
    return downDays;
  }

  /** Compute a stock's 20-day market down-day resilience ("照妖镜": how often & by how much it beat down days) */
  computeResilience20d(stock, downDays) {
    if (!downDays.length || !stock.bars.length) return { beat: 0, total: 0, avgExcess: 0, label: '-' };
    const retByDate = new Map();
    for (let i = 1; i < stock.bars.length; i++) {
      retByDate.set(stock.bars[i].d, ((stock.bars[i].c - stock.bars[i - 1].c) / stock.bars[i - 1].c) * 100);
    }
    let beat = 0, total = 0, excessSum = 0;
    for (const dd of downDays) {
      const sr = retByDate.get(dd.d);
      if (sr == null) continue;
      total++;
      const ex = sr - dd.mktChg;
      excessSum += ex;
      if (sr >= 0 || ex >= 0.8) beat++;
    }
    if (!total) return { beat: 0, total: 0, avgExcess: 0, label: '-' };
    const avgExcess = +(excessSum / total).toFixed(1);
    const star = beat >= Math.ceil(total * 0.65) && avgExcess >= 0.8 ? '🔥' : '';
    return {
      beat, total, avgExcess,
      label: `${beat}/${total}天 (${avgExcess >= 0 ? '+' : ''}${avgExcess}%)${star}`
    };
  }

  run(targetDate = null) {
    const market = this.evaluateMarketRegime(targetDate);
    const sentiment = this.sentimentObj.evaluate();
    const trackStatuses = this.tracks.map(t => t.evaluate(market.date));
    const downDays20 = this.buildDownDays20(market.date);

    const stockMap = new Map();
    for (const t of this.tracks) for (const s of t.stocks) stockMap.set(s.code, s);

    const holdingsAudit = this.auditHoldings(stockMap, market.date);
    const positions = this.portfolio.positions || [];
    const heldCodes = new Set(positions.map(p => p.code));
    // Option D: +40% wideMode='ma60' runners do NOT occupy an attack slot!
    const occupiedSlots = positions.filter(p => p.wideMode !== 'ma60').length;
    const trackHeldCount = {};
    for (const p of positions) {
      const tk = stockMap.get(p.code)?.trackName;
      if (tk) trackHeldCount[tk] = (trackHeldCount[tk] || 0) + 1;
    }

    const totalEquity = this.portfolio.totalEquity || 100000;
    const slotBudget = totalEquity / (this.rules.maxSlots || 4);
    const slotsLeft = Math.max(0, (this.rules.maxSlots || 4) - occupiedSlots);
    const allowEtfSub = this.rules.allowEtfSubstitute !== false;

    const actionableBuys = [];
    const blockedSignals = [];
    const t1WatchList = [];
    const climaxRejects = [];
    const resilientWatch = [];

    for (const t of this.tracks) {
      for (const s of t.stocks) {
        if (!s.snapshot) continue;
        const eligible = !this.rules.mainboardOnly || s.isMainboard || (allowEtfSub && s.allowMainboardAccount);
        if (!eligible) continue;
        const snap = s.snapshot;
        const mirror = this.computeResilience20d(s, downDays20);

        if (!t.watchOnly && s.fundamentalPass && (snap.aboveMa60 || (mirror.total >= 2 && mirror.beat >= Math.ceil(mirror.total * 0.65) && mirror.avgExcess >= 0.8 && snap.distMa60Pct > -8))) {
          resilientWatch.push({
            code: s.code, name: s.name, track: t.name, tier: s.tier,
            isEtfSubstitute: s.isEtfSubstitute,
            close: snap.close, chgPct: snap.chgPct, distMa60Pct: snap.distMa60Pct,
            volRatio20d: snap.volRatio20d, aboveMa60: snap.aboveMa60,
            ret20Pct: snap.ret20Pct, mirror, score: s.score, q3Summary: s.q3Summary
          });
        }

        if (heldCodes.has(s.code)) continue;

        if (snap.isClimaxReject && s.fundamentalPass && t.status.switchOpen) {
          climaxRejects.push({
            code: s.code, name: s.name, track: t.name,
            close: snap.close, chgPct: snap.chgPct, volRatio20d: snap.volRatio20d,
          });
        }

        if (snap.watchSignal && s.fundamentalPass && t.status.switchOpen && market.allowNewEntries) {
          t1WatchList.push({
            code: s.code, name: s.name, track: t.name,
            close: snap.close, chgPct: snap.chgPct, volRatio20d: snap.volRatio20d,
            ret20Pct: snap.ret20Pct, note: snap.watchSignal,
          });
        }

        if (!snap.signal) continue;

        const lotPlan = this.computeLotPlan(snap.close, slotBudget);
        const blocks = [];
        if (t.watchOnly) blocks.push('赛道处于逻辑隔离观察期');
        if (!market.allowNewEntries) blocks.push(`五大宽基全灭(0/${market.total}在MA60上)`);
        if (sentiment.available && !sentiment.pass) blocks.push(`全A情绪未过关(跌停${sentiment.limitDownCount ?? '-'}/红盘${sentiment.upCount ?? '-'})`);
        if (!t.watchOnly && !t.status.switchOpen) blocks.push(`赛道宽度${t.status.breadthPct}%<${this.rules.breadthThresholdPct}%`);
        if (!s.fundamentalPass) blocks.push('季报扣非未过关');
        if (slotsLeft <= 0) blocks.push(`已满${this.rules.maxSlots}个进攻槽`);
        if ((trackHeldCount[t.name] || 0) >= this.rules.maxPerTrack) blocks.push(`同赛道已达${this.rules.maxPerTrack}只上限`);
        if (!lotPlan.affordable) blocks.push(`单手¥${lotPlan.lotCost.toLocaleString()}>单槽¥${Math.round(slotBudget).toLocaleString()}(跳过顺延)`);

        const rec = {
          code: s.code, name: s.name, track: t.name, tier: s.tier,
          isEtfSubstitute: s.isEtfSubstitute,
          signal: snap.signal, close: snap.close, chgPct: snap.chgPct,
          volRatio20d: snap.volRatio20d,
          ma10: snap.ma10, ma20: snap.ma20, ma60: snap.ma60, ret20Pct: snap.ret20Pct,
          stopPrice: +(snap.close * (1 + this.rules.hardStopPct / 100)).toFixed(s.isEtfSubstitute ? 3 : 2),
          lotPlan, mirror,
          score: s.score,
          blocks
        };

        if (blocks.length === 0) actionableBuys.push(rec);
        else blockedSignals.push(rec);
      }
    }

    actionableBuys.sort((a, b) => b.ret20Pct - a.ret20Pct);
    t1WatchList.sort((a, b) => b.ret20Pct - a.ret20Pct);
    resilientWatch.sort((a, b) => (b.aboveMa60 - a.aboveMa60) || (b.mirror.avgExcess - a.mirror.avgExcess) || (b.distMa60Pct - a.distMa60Pct));

    // Calculate idle cash after reserving slots for actionable buys
    const plannedBuySlots = Math.min(slotsLeft, actionableBuys.length);
    const reservedForBuys = actionableBuys.slice(0, plannedBuySlots).reduce((s, x) => s + x.lotPlan.estAmount, 0);
    const currentCash = this.portfolio.cash ?? totalEquity;
    const idleCash = Math.max(0, currentCash - reservedForBuys);
    const defensePlan = this.evaluateDefenseBarbell(idleCash, market.date);
    const globalRadarRows = this.evaluateGlobalRadar(market.date);

    let verdict;
    if (actionableBuys.length > 0) {
      const picks = actionableBuys.slice(0, slotsLeft)
        .map(x => `${x.name}(${x.code}, ${x.lotPlan.lots}手≈¥${x.lotPlan.estAmount.toLocaleString()})`).join('、');
      verdict = `🟢 允许进攻：按满额 4 槽模式 B（单槽预算 ¥${Math.round(slotBudget).toLocaleString()}，同赛道 ≤2 只），尾盘确认后按 20 日动量优先执行 ${picks}，收盘 2 日有效跌破 ${this.rules.hardStopPct}% 止损（盘中闪崩底线 ${this.rules.flashCrashFloorPct ?? -15}%）；剩余闲置资金 ¥${defensePlan.idleCash.toLocaleString()} 泊入红利+国债哑铃。`;
    } else if (!market.allowNewEntries) {
      const bestTrack = [...trackStatuses].filter(x => !x.watchOnly).sort((a, b) => b.breadthPct - a.breadthPct)[0] || trackStatuses[0];
      verdict = `🔴 全面防御（五大宽基全破 MA60，0% 新开仓）：闲置资金 ¥${defensePlan.idleCash.toLocaleString()} 按 50/50 停泊【512890 红利低波(${defensePlan.items[0]?.lots ?? 0}手) + 511010 国债(${defensePlan.items[1]?.lots ?? 0}手) + 逆回购 ¥${defensePlan.repoRemainder.toLocaleString()}】；第一观察赛道【${bestTrack.name}】（宽度 ${bestTrack.breadthPct}%）。`;
    } else {
      verdict = `🟡 持币/守仓等待：大盘未触发全灭底线（${market.upCount}/${market.total} 在 MA60 上），但今日主板白名单无同时通过所有 V3.2-Lite 量价锁的可买信号；闲钱 ¥${defensePlan.idleCash.toLocaleString()} 继续在红利+国债哑铃生息${t1WatchList.length ? `，明日重点盯 ${t1WatchList.slice(0, 3).map(x => x.name).join('、')} 的 T+1 不吞没确认` : ''}。`;
    }

    return {
      version: this.rules.version || 'V3.2-Lite',
      generatedAt: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ') + ' (CST)',
      reviewDate: market.date,
      totalEquity,
      slotBudget: Math.round(slotBudget),
      slotsLeft,
      accountMode: `${this.rules.mainboardOnly ? '纯主板(60/00)' : '全A'} · 满额${this.rules.maxSlots}槽模式B(单槽¥${Math.round(slotBudget).toLocaleString()}) · V3.2-Lite(17项精简)`,
      market,
      sentiment,
      tracks: trackStatuses,
      holdingsAudit,
      actionableBuys,
      blockedSignals,
      t1WatchList: t1WatchList.slice(0, 8),
      climaxRejects,
      resilientWatch: resilientWatch.slice(0, 10),
      defensePlan,
      globalRadar: globalRadarRows,
      verdict,
    };
  }
}

// Backward-compatible export alias
export const V2Strategy = V3Strategy;

// ===================== 6. Markdown Report Formatter =====================
function formatMarkdown(r) {
  const lines = [];
  lines.push(`# 📊 A 股 V3.2-Lite 极简量价哑铃 · 盘后体检报告（${r.reviewDate}）`);
  lines.push(`> 账户模式：\`${r.accountMode}\` | 总权益：\`¥${r.totalEquity.toLocaleString()}\` | 剩余进攻槽：\`${r.slotsLeft}/${r.totalEquity ? Math.round(r.totalEquity / r.slotBudget) : 4}\` | 生成时间：${r.generatedAt}`);
  if (r.dataHealth) lines.push(`> 数据源健康度：\`${r.dataHealth}\`\n`);
  else lines.push('');
  if (r.dataFreshness?.staleStockCount > 0) {
    lines.push(`> ⚠️ **数据新鲜度警告**：有 \`${r.dataFreshness.staleStockCount}\` 只个股 K 线末根日期落后于指数（\`${r.dataFreshness.indexLatestDate}\`），赛道宽度与个股信号可能滞后，建议切换 \`--provider eastmoney\` 或稍后重试！\n`);
  }

  lines.push(`## 一、五大宽基 MA60 全灭底线 & 量价气象站：${r.market.regime}`);
  lines.push(`- **底线规则**：仅当 5 大宽基 **全部 ≤ MA60**（0/5）时强制封锁开仓；只要 ≥1 个站稳 MA60 即放行给绿灯赛道。`);
  lines.push(`- **仓位上限**：\`${r.market.exposureCap}\` | 新开仓总闸：${r.market.allowNewEntries ? '✅ 开放' : '🔴 关闭'}`);
  if (r.market.vpAlerts.length) {
    for (const al of r.market.vpAlerts) lines.push(`- **量价雷达提示**：${al}`);
  }
  lines.push(`| 宽基指数 | 对应风格 | 收盘价（当日） | MA20 | MA60 | 60日量比 / 位置 | 状态 |`);
  lines.push(`| :--- | :--- | :---: | :---: | :---: | :---: | :---: |`);
  for (const ix of r.market.indices) {
    const vTag = `${ix.volRatio60d ?? '-'}x${ix.isDryVol ? '💧' : (ix.isHighClimax ? '🔥' : '')} / ${ix.pos60Pct}%`;
    lines.push(`| **${ix.name}** (\`${ix.code}\`) | ${ix.style} | ${ix.close} (${ix.chgPct >= 0 ? '+' : ''}${ix.chgPct}%) | ${ix.ma20} (${ix.above20 ? '上' : '下'}) | ${ix.ma60} (${ix.above60 ? '上' : '下'}) | ${vTag} | ${ix.status} |`);
  }
  if (r.sentiment?.available) {
    const s = r.sentiment;
    const upPart = s.upCount != null ? `红盘 \`${s.upCount}\` 家（${s.upOk ? '✅ >' : '❌ ≤'}${s.minAdvancing}） / 绿盘 \`${s.downCount}\` 家` : '历史回放仅核对涨跌停';
    lines.push(`- **全 A 情绪硬刻度**：${s.label} — 涨停 \`${s.limitUpCount ?? '-'}\` 家 / 跌停 \`${s.limitDownCount ?? '-'}\` 家（${s.dtOk ? '✅ <' : '❌ ≥'}${s.maxLimitDown}）| ${upPart}\n`);
  } else {
    lines.push(`- **全 A 情绪硬刻度**：${r.sentiment?.label || '未获取'}\n`);
  }

  lines.push(`## 二、四大赛道 V3.2-Lite 宽度与量能协同（宽度 ≥ 40% 解锁）`);
  lines.push(`| 赛道 | 站稳 MA60 宽度 | 较前日变化 | 板块量比(vs20日) | 放量协同标的 | 开关状态 | 对应 ETF |`);
  lines.push(`| :--- | :---: | :---: | :---: | :---: | :--- | :---: |`);
  for (const t of r.tracks) {
    const dStr = t.deltaPct === 0 ? '持平' : (t.deltaPct > 0 ? `+${t.deltaPct}% ↑` : `${t.deltaPct}% ↓`);
    lines.push(`| **${t.name}** | ${t.aboveMa60}/${t.total} (**${t.breadthPct}%**) | ${dStr} | ${t.sectorVolRatio}x ${t.sectorVolRatio >= 1 ? '✅' : ''} | ${t.syncBullCount} 只 | ${t.switchLabel} | \`${t.etfProxy}\` |`);
  }
  lines.push('');

  lines.push(`## 三、V3.2-Lite 底盘 B 混合量价信号扫描与手数落地方案`);
  if (r.actionableBuys.length) {
    lines.push(`### ✅ 通过全部锁的【可执行买点】（按 20 日动量排序，单槽预算 ¥${r.slotBudget.toLocaleString()}）`);
    lines.push(`| 赛道 | 代码 / 名称 | 信号 | 现价(当日) | 20日量比 | 20日动量 | 建议手数 / 金额 | 止损(-10%) | 极简止盈适配 |`);
    lines.push(`| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |`);
    for (const b of r.actionableBuys) {
      lines.push(`| ${b.track} | \`${b.code}\` **${b.name}** | **${b.signal}** | ${b.close} (${b.chgPct>=0?'+':''}${b.chgPct}%) | ${b.volRatio20d}x | ${b.ret20Pct>=0?'+':''}${b.ret20Pct}% | **${b.lotPlan.lots}手** (¥${b.lotPlan.estAmount.toLocaleString()}) | \`${b.stopPrice}\` | ${b.lotPlan.exitPlan} |`);
    }
  } else {
    lines.push(`- **可执行开仓信号**：\`0 只\`（当前无通过全部 V3.2-Lite 锁与手数门槛的标的）。`);
  }

  if (r.t1WatchList.length) {
    lines.push(`\n### 👀 今日温和放量初突（待明日 T+1 不吞没确认）`);
    for (const w of r.t1WatchList) {
      lines.push(`- \`${w.code}\` **${w.name}**（${w.track}）收 \`${w.close}\`（${w.chgPct>=0?'+':''}${w.chgPct}%，20日量比 \`${w.volRatio20d}x\`）→ ${w.note}；若明日收盘不跌破今日开盘价且守住 MA10，即触发 **B2-T1确认**。`);
    }
  }

  if (r.climaxRejects.length) {
    lines.push(`\n### 🚫 高潮天量（≥3.0x 均量）自动否决警示`);
    for (const c of r.climaxRejects) {
      lines.push(`- \`${c.code}\` **${c.name}**（${c.track}）收 \`${c.close}\`（+${c.chgPct}%），量比达 \`${c.volRatio20d}x\` ≥ 3.0x → 疑似派发高潮，V3.1 强制禁追。`);
    }
  }

  if (r.blockedSignals.length) {
    lines.push(`\n### 🛡️ 触发形态但被 V3.2-Lite 锁【自动拦截 / 顺延】的信号`);
    for (const b of r.blockedSignals) {
      lines.push(`- \`${b.code}\` **${b.name}**（${b.track}）收 \`${b.close}\`（${b.chgPct >= 0 ? '+' : ''}${b.chgPct}%，量比${b.volRatio20d}x），触发 **${b.signal}** → **拦截原因**：\`${b.blocks.join(' + ')}\``);
    }
  }

  if (r.resilientWatch.length) {
    lines.push(`\n### ⭐ 财报合格 + 强势抗跌「近20日大跌照妖镜」观察池（含半导体 ETF 替补位）`);
    lines.push(`| 赛道 | 代码 / 名称 | 现价(当日) | 距 MA60 | 20日大跌逆势(照妖镜) | 20日动量 | 季报要点 |`);
    lines.push(`| :--- | :--- | :---: | :---: | :---: | :---: | :--- |`);
    for (const w of r.resilientWatch) {
      const tag = w.isEtfSubstitute ? ' [ETF替补]' : '';
      lines.push(`| ${w.track} | \`${w.code}\` **${w.name}**${tag} | ${w.close} (${w.chgPct>=0?'+':''}${w.chgPct}%) | ${w.distMa60Pct>=0?'+':''}${w.distMa60Pct}% ${w.aboveMa60?'✅':''} | ${w.mirror?.label || '-'} | ${w.ret20Pct>=0?'+':''}${w.ret20Pct}% | ${w.q3Summary} |`);
    }
  }

  if (r.holdingsAudit.length) {
    lines.push(`\n## 四、当前持仓 V3.2-Lite 卖点④（量价对称 + 方案D宽尾仓）风控体检`);
    lines.push(`| 代码 / 名称 | 持仓 | 成本 → 现价 | 浮盈亏 | 跟踪模式 | MA10 / MA20 / MA60 | 执行动作 |`);
    lines.push(`| :--- | :---: | :---: | :---: | :---: | :---: | :--- |`);
    for (const h of r.holdingsAudit) {
      lines.push(`| \`${h.code}\` **${h.name}** | ${h.lots}手(${h.shares}股) | ${h.avgCost} → ${h.close} | ${h.pnlPct>=0?'+':''}${h.pnlPct}% | ${h.mode} | ${h.ma10} / ${h.ma20} / ${h.ma60} | ${h.action} |`);
    }
  }

  lines.push(`\n## 五、闲置资金防御哑铃方案（50% 红利低波 + 50% 国债 + 零头逆回购）`);
  lines.push(`- **当前闲置资金**：\`¥${r.defensePlan.idleCash.toLocaleString()}\`（已整手配置 \`¥${r.defensePlan.allocated.toLocaleString()}\` + 零头 \`¥${r.defensePlan.repoRemainder.toLocaleString()}\` 转入 **${r.defensePlan.oddLotFallback}**）`);
  lines.push(`| 防御 ETF | 目标权重 | 现价(MA60) | 单手门槛 | 建议买入手数 | 实际占用金额 | 纪律说明 |`);
  lines.push(`| :--- | :---: | :---: | :---: | :---: | :---: | :--- |`);
  for (const d of r.defensePlan.items) {
    lines.push(`| \`${d.code}\` **${d.name}** | ${d.weightPct}% | ${d.price ?? '-'} (${d.ma60 ?? '-'}) | ¥${d.lotCost?.toLocaleString() ?? '-'} | **${d.lots}手** (${d.shares}股) | ¥${d.actualAmt.toLocaleString()} | ${d.note} |`);
  }

  if (r.globalRadar.length) {
    lines.push(`\n## 六、七星全球大类资产溢价雷达（只读参考，严防 QDII 高溢价踩坑）`);
    lines.push(`| ETF | 场内收盘(当日) | 官方净值(日期) | 场内溢价率 | 溢价警示 | 25日动量(斜率×R²) | 站稳MA60 |`);
    lines.push(`| :--- | :---: | :---: | :---: | :---: | :---: | :---: |`);
    for (const g of r.globalRadar) {
      const pStr = g.premPct != null ? `${g.premPct >= 0 ? '+' : ''}${g.premPct}%` : '-';
      const mStr = g.mom25 != null ? `${g.mom25 >= 0 ? '+' : ''}${g.mom25}%` : '-';
      lines.push(`| \`${g.code}\` **${g.name}** | ${g.close} (${g.chgPct>=0?'+':''}${g.chgPct}%) | ${g.nav ?? '-'} (${g.navDate}) | **${pStr}** | ${g.premStatus} | ${mStr} | ${g.above60 ? '✅' : '❌'} |`);
    }
  }

  lines.push(`\n## 七、次日一句话执行指令`);
  lines.push(`> **${r.verdict}**\n`);
  lines.push(`*(注：本报告由 V3.2-Lite 极简规则引擎基于公开行情自动计算生成，仅用于交易纪律辅助，不构成任何投资建议。)*`);
  return lines.join('\n');
}

// ===================== 7. Main Entrypoint =====================
async function main() {
  const args = parseArgs(process.argv);
  const watchlistCfg = JSON.parse(fs.readFileSync(args.watchlist, 'utf8'));
  const portfolioPath = fs.existsSync(args.portfolio)
    ? args.portfolio
    : path.join(SKILL_ROOT, 'config', 'portfolio.example.json');
  const portfolioCfg = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));

  const tracks = watchlistCfg.tracks.map(t => new Track(t, portfolioCfg.rules));
  const provider = new DataProvider(args.provider);
  const autoCachePath = path.join(SKILL_ROOT, 'config', '.last_cache.json');

  const benchConfigs = watchlistCfg.benchmarks || [
    { code: '000300', market: 'sh', name: '沪深300', style: '大盘蓝筹' },
    { code: '399006', market: 'sz', name: '创业板指', style: '成长/算力' },
    { code: '000688', market: 'sh', name: '科创50', style: '硬科技/半导体' },
    { code: '000905', market: 'sh', name: '中证500', style: '中盘制造' },
    { code: '000852', market: 'sh', name: '中证1000', style: '中小盘专精特新' }
  ];
  const defenseConfigs = watchlistCfg.defenseETFs || [
    { code: '512890', market: 'sh', name: '红利低波ETF', weight: 0.5, qdii: false },
    { code: '511010', market: 'sh', name: '国债ETF', weight: 0.5, qdii: false },
  ];
  const radarConfigs = watchlistCfg.globalSevenStarRadar || [];

  const benchmarksMap = new Map();
  let sentimentRaw = null;
  const etfBarCache = new Map();
  const etfNavCache = new Map();

  if (args.cache && fs.existsSync(args.cache)) {
    const cached = JSON.parse(fs.readFileSync(args.cache, 'utf8'));
    for (const bc of benchConfigs) {
      const bars = cached.benchmarksByCode?.[bc.code] || (bc.code === '000300' ? cached.hs300 : []);
      if (bars?.length) benchmarksMap.set(bc.code, { ...bc, bars });
    }
    sentimentRaw = cached.sentiment || null;
    provider.sentimentSource = sentimentRaw?.available ? '本地缓存' : '离线缓存(无情绪)';
    for (const t of tracks) for (const s of t.stocks) s.bars = cached.barsByCode?.[s.code] || [];
    for (const [k, v] of Object.entries(cached.etfBarsByCode || {})) etfBarCache.set(k, v);
    for (const [k, v] of Object.entries(cached.etfNavByCode || {})) etfNavCache.set(k, v);
  } else {
    // 1. Fetch 5 major benchmarks in parallel
    await Promise.all(benchConfigs.map(async bc => {
      const bars = await provider.fetchKline(bc.market, bc.code, 160, true);
      if (bars.length) benchmarksMap.set(bc.code, { ...bc, bars });
    }));
    if (!benchmarksMap.size) {
      throw new Error('All K-line providers failed for benchmark indices. Try --cache config/.last_cache.json');
    }

    const firstBars = benchmarksMap.values().next().value.bars;
    const latestDate = firstBars[firstBars.length - 1].d;
    const effectiveDate = args.date || latestDate;
    const isLatestDay = !args.date || args.date >= latestDate;
    const sentimentPromise = provider.fetchSentiment(effectiveDate, isLatestDay);

    // 2. Fetch unique watchlist stocks in batches of 8 (enforce freshness against benchmark latestDate)
    const uniqueStocks = new Map();
    for (const t of tracks) for (const s of t.stocks) uniqueStocks.set(s.code, s);
    const barCache = new Map();
    const entries = [...uniqueStocks.values()];
    for (let i = 0; i < entries.length; i += 8) {
      const batch = entries.slice(i, i + 8);
      await Promise.all(batch.map(async s => {
        barCache.set(s.code, await provider.fetchKline(s.market, s.code, 160, false, latestDate));
      }));
    }
    for (const t of tracks) for (const s of t.stocks) s.bars = barCache.get(s.code) || [];

    // 3. Fetch Defense & Seven-Star Global ETF K-lines + official NAVs in parallel
    const uniqueEtfs = new Map();
    for (const e of [...defenseConfigs, ...radarConfigs]) uniqueEtfs.set(e.code, e);
    await Promise.all([...uniqueEtfs.values()].map(async e => {
      const [bars, navInfo] = await Promise.all([
        provider.fetchKline(e.market, e.code, 160, false, latestDate),
        provider.fetchEtfNav(e.code),
      ]);
      if (bars.length) etfBarCache.set(e.code, bars);
      if (navInfo) etfNavCache.set(e.code, navInfo);
    }));

    sentimentRaw = await sentimentPromise;

    // Persist hot cache snapshot
    try {
      const barsByCode = {};
      for (const [k, v] of barCache.entries()) if (v.length) barsByCode[k] = v;
      const benchmarksByCode = {};
      for (const [k, v] of benchmarksMap.entries()) benchmarksByCode[k] = v.bars;
      const etfBarsByCode = Object.fromEntries(etfBarCache.entries());
      const etfNavByCode = Object.fromEntries(etfNavCache.entries());
      fs.writeFileSync(autoCachePath, JSON.stringify({
        savedAt: new Date().toISOString(),
        hs300: benchmarksByCode['000300'] || [],
        benchmarksByCode,
        sentiment: sentimentRaw,
        barsByCode,
        etfBarsByCode,
        etfNavByCode,
      }));
    } catch {}
  }

  const defenseETFs = defenseConfigs.map(e => ({ ...e, bars: etfBarCache.get(e.code) || [], navInfo: etfNavCache.get(e.code) || null }));
  const globalRadar = radarConfigs.map(e => ({ ...e, bars: etfBarCache.get(e.code) || [], navInfo: etfNavCache.get(e.code) || null }));

  const sentimentObj = new MarketSentiment(sentimentRaw, portfolioCfg.rules);
  const strategy = new V3Strategy(portfolioCfg, tracks, benchmarksMap, sentimentObj, defenseETFs, globalRadar);
  const report = strategy.run(args.date);

  // Freshness self-check: compare benchmark latest bar date vs stock latest bar dates
  const idxLatest = report.market?.date || '-';
  const stockDates = [];
  for (const t of tracks) for (const s of t.stocks) if (s.snapshot?.date) stockDates.push(s.snapshot.date);
  const maxStockDate = stockDates.length ? stockDates.reduce((a, b) => (a > b ? a : b)) : '-';
  const staleCount = idxLatest !== '-' ? stockDates.filter(d => d < idxLatest).length : 0;
  const freshTag = staleCount > 0
    ? `指数末根[${idxLatest}] · 个股末根[${maxStockDate}] ⚠️${staleCount}只滞后`
    : `指数末根[${idxLatest}] · 个股末根[${maxStockDate}] ✅同步`;
  report.dataFreshness = { indexLatestDate: idxLatest, stockLatestDate: maxStockDate, staleStockCount: staleCount };
  report.dataHealth = `${provider.getHealthSummary()} · ${freshTag}`;

  if (args.format === 'json') console.log(JSON.stringify(report, null, 2));
  else console.log(formatMarkdown(report));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error('[daily_review] Fatal:', err.message); process.exit(1); });
}
