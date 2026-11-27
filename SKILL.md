---
name: a-share-pyramid-stock-selection
description: >-
  Systematic A-share institutional swing stock-selection and risk-control workflow
  ("Policy-to-Money -> Industry Chain -> Earnings & Pricing Power -> Valuation/Expectation Gap/Price-Volume -> Execution & Risk Locks").
  Use whenever a user asks to pick A-share stocks or sector ETFs, interpret China Five-Year Plan / industrial policies,
  break down upstream/midstream/downstream industry chains, screen stocks via financial reports (deducted net profit, gross margin, contract liabilities),
  audit trading statements/holdings, compare normalized multi-stock drawdowns, or build a disciplined A-share swing trading plan.
---

# A-Share Pyramid Stock Selection & Execution Skill

This skill guides an AI agent to perform rigorous, source-verified A-share sector/stock selection and trading-system design based on the **Institutional Prosperity Swing Framework** ("政策落到钱上 + 产业链拆解 + 财报与定价权验真 + 估值/预期差/量价确认 + 风控纪律闭环").

## Core Operating Principles

1. **Step 0 Profile Gate First (When Designing Personal Plans)**:
   - Before prescribing position sizes, holding horizons, or execution tactics for a user, determine their **trading time availability, risk/drawdown limit, psychological friction, capital size, and board permissions (688 STAR = 500k RMB / 200-share lot; 300 ChiNext = 100k RMB; Mainboard = 100-share lot)**.
   - Reject mode mismatch: never apply short-term speculative/intraday tactics to office workers, and never use long-term macro policy narratives to justify holding broken short-term positions.
2. **Evidence & Freshness First**:
   - Never rely on stale memory for financial figures, market caps, PE/PB, or K-line prices. Always retrieve the **latest quarterly/annual filings** and **current market quotes/K-lines** before drawing conclusions, and explicitly state data dates and limitations.
3. **Objective Separation of Research vs. Trading**:
   - Clearly state that passing fundamental screening (Steps 1–3) is **never** a direct buy signal; entries require Step 4 (valuation/expectation gap/price-volume confirmation) and Step 5 (market regime & risk budget).
   - Never provide guaranteed return claims or personalized investment advice; frame all stock picks as structured research & educational screening outputs.

---

## Standard 4-Step Stock Selection Workflow

Follow these four sequential filters when analyzing any A-share policy theme or industry:

### Step 1: Policy "Money-Landing" Tiering & Industry Prosperity Check
Filter raw policies (e.g., Five-Year Plan major projects, ministry circulars) into three tiers:
- **Tier 1 (Hard Engineering & Rigid Budgets — Primary Pool)**: Backed by special bonds, national funds, SOE/grid/telecom/fab rigid annual CAPEX, and verifiable tender orders.
- **Tier 2 (Commercialization Ramp / Anti-Involution Turnaround — Selective Watchlist)**: Early 0-to-1 ramp or supply-side capacity clearing; requires strict earnings/margin verification.
- **Tier 3 (Long-Term Future Industries — Exclude from Swing Pool)**: 5–10 year lab/R&D themes without scalable revenue; classify as speculative themes only.

Verify the **Prosperity Triad**: `Order Growth ↑` + `Capacity Utilization Full` + `Product Price Trend ↑`, and confirm the catalyst is **structural/persistent** (tech-route shift, domestic substitution, supply-demand reversal) rather than a one-off news spike.

### Step 2: Industry Chain Decomposition & Ticker Discovery
Split the target industry into **Upstream (resources / core tech barriers)**, **Midstream (capacity / cost / depreciation)**, and **Downstream (channels / brands / product cycles)**.
- Core rule: **Follow where profit pools accumulate and where pricing power sits.**
- To discover pure, authoritative tickers for any unfamiliar industry, load [stock-discovery-sop.md](./references/stock-discovery-sop.md) (4-method pipeline: industry-chain maps sorted by market cap, sub-sector ETF top-10 holdings, broker deep-dive tables, and F10 revenue-purity filter `>= 50%`).

### Step 3: Company Screening ("Growth Four Questions" + 5-Item Minefield Veto + F10 Audit)
Filter down to liquid institutional leaders (**hard market-cap floor `>= 15B RMB`**, strictly excluding `2B–9B` easily manipulated small-caps) and pass the **5-Item Fundamental Minefield Veto Checklist** before scoring:
- **Hard Veto Red Lines**: (a) Major shareholder / controller reduction notices, (b) large lockup expirations within 3 months, (c) consecutive losses or sudden earnings blow-ups, (d) CSRC/exchange regulatory investigations, (e) isolated theme/name-speculation limit-ups with no sector resonance.
- Audit the latest earnings report using five checks:
1. **Revenue vs. Deducted Profit Match**: Revenue YoY `> 15%` and **Deducted Net Profit (扣非净利润)** growing faster than or in line with revenue. Always inspect deducted profit to catch *both* inflated non-recurring gains (equity sales / fair-value swings) and distorted apparent losses.
2. **Marginal Acceleration**: Compare **latest single-quarter YoY growth vs. cumulative YTD YoY growth** to identify accelerating vs. decelerating leaders.
3. **Order Visibility**: Check balance-sheet **Contract Liabilities (合同负债)** and inventory trends as leading order indicators.
4. **Pricing Power Verification**: Inspect **4-quarter Gross Margin (毛利率) level and direction**. Rising or resilient high gross margin = true pricing power ("can raise prices without losing customers"); sliding gross margin = price-war trap.
5. **Penetration / Substitution Stage**: Prefer the **10%–40%** rapid ramp zone over saturated `> 80%` markets.

### Step 4: Valuation Traps, Expectation Gaps & Price-Volume Verification
Before finalizing any watchlist or entry assessment, load [industry-chain-valuation-rules.md](./references/industry-chain-valuation-rules.md) to apply the correct valuation ruler per chain tier:
- **Upstream (Tech Barriers)**: Compute **Deducted PE (扣非真实 PE)**; flag `> 100x` deducted PE or `> 10x PB` as stretched odds.
- **Midstream (Heavy-Asset Manufacturing)**: Pair PE with **PB (市净率)** and **Capacity Utilization**; watch operating leverage turning points vs. post-expansion depreciation overhang.
- **Cyclical / Commodity-Linked Downstream (e.g., Memory, Metals, Chemicals)**: Explicitly warn against the **"Cycle-Peak Low-PE Trap"** (ultra-low PE + explosive margins often mark peak pricing; track spot/contract price inflection instead of PE).
- **Expectation Gap & Profit Reallocation**: Explain cross-tier divergence by checking *which tier just beat pessimistic consensus* and *whether price hikes in one tier squeeze margins in another*.
- **Extraordinary Price-Volume Action**: Verify real historical price behavior during market sell-offs ("market drops sharply, stock drops little; market stabilizes, stock leads higher"). Distinguish **low/mid-base resilience** from **high-level late-stage catch-up risk**.

### Automated Daily Review Pipeline (Agent + Deterministic Engine)
To eliminate manual calculation drift and make daily post-close reviews 100% repeatable, separate **quarterly qualitative research (Agent)** from **daily quantitative computation (Script)**:
- **Config Layer (Agent updates quarterly after `1/31`, `4/30`, `8/31`, `10/31`)**:
  - [config/watchlist.json](./config/watchlist.json): Holds each `Track` (sector) and its full core `Stock[]` roster with `fundamentalPass` flags and latest quarterly summaries.
  - [config/portfolio.json](./config/portfolio.json): Holds account constraints (`mainboardOnly`, `maxSlots: 4`, `maxPerTrack: 2`, risk parameters) and current open `positions[]`.
- **Execution Engine ([scripts/daily_review.mjs](./scripts/daily_review.mjs))**: Implements modular `DataProvider` (4-tier K-line failover + 3-tier A-share sentiment failover + ETF official NAV premium lookup + auto hot-cache) -> `MarketSentiment` -> `Stock` -> `Track` -> `V3Strategy` objects to compute **V3.2-Lite (17-Feature Ablation-Pruned VPTS × 5-Index MA60 Floor × Barbell Defense)** signals, exact 100-share lot sizing (with automatic skip/fallback for unaffordable high-price stocks and simplified 1-lot/2+-lot exit adaptation), idle-cash 50% Dividend / 50% Treasury ETF parking, and read-only Seven-Star global premium radar:

```bash
# Daily post-close review (auto failover, Markdown report)
node scripts/daily_review.mjs --format md

# Force backup K-line provider or emit JSON / offline hot-cache replay
node scripts/daily_review.mjs --provider eastmoney --format md
node scripts/daily_review.mjs --date 2026-11-25 --cache config/.last_cache.json --format json
```

### Quantitative Price & Normalized Drawdown Verification (Executable Script)
When comparing multiple candidates or verifying which chain tier actually showed resilience, run [normalize_drawdown.mjs](./scripts/normalize_drawdown.mjs) to fetch real forward-adjusted (前复权) daily K-lines, compute peak drawdowns, and output group-averaged normalized comparison tables:

```bash
node scripts/normalize_drawdown.mjs --beg 20260701 --stocks "上游:002371:北方华创,上游:688019:安集科技,中游:688981:中芯国际,基准:588170:科创半导ETF"
```

---

## Trading Execution, Quarterly Cadence & Risk-Control Layer

Whenever the user asks to turn selected stocks into a **complete executable trading plan**, review **existing holdings/statements**, or manage **entry/exit/position sizing**, load [execution-risk-and-sentiment.md](./references/execution-risk-and-sentiment.md) and enforce the **Cross-Cycle Verified V2.0 Closed-Loop Rules**:
- **Three-Layer Operating Cadence (年定主线 · 季做体检 · 日守风控)**:
  - **Annual / Multi-Year**: Lock onto 3–5 Tier-1 policy mainlines from the Five-Year Plan (anchor to the Oct *Proposal / 建议* rather than waiting for the March *Outline / 纲要* whenever possible).
  - **Quarterly Audit (4 Fixed Windows: Jan 31 Previews, Apr 30 Annual+Q1, Aug 31 H1, Oct 31 Q3)**: Run a point-in-time whitelist audit across mainlines to (1) rotate out of overcapacity/margin-declining sectors, (2) shift toward the highest-margin chain tier, and (3) eliminate any stock with 2 consecutive quarters of negative deducted-profit YoY or collapsing gross margin.
  - **Between Earnings Seasons**: Trade strictly mechanically inside the audited whitelist; forbid rumor-chasing theme switches.
- **Earnings × Trend Dual Lock (防财报滞后陷阱)**:
  - **Entry (`AND` Lock)**: Require `Quarterly Fundamental Whitelist Passed` **AND** `Stock > MA60` **AND** `Sector Breadth >= 40% of leaders above MA60` (prevents catching falling knives in multi-year bear markets like 2022–2023 PV/Lithium).
  - **Exit (`OR` Lock)**: Exit immediately upon `Fundamental Falsification` **OR** `Trend Breakdown` (never bag-hold peak-earnings value traps like 2022Q3 PV/Lithium when price has already broken trend).
- **Market Regime Filter & A-Share Sentiment Gauges**: Total exposure cap by regime (`70–80%` / `40–60%` / `0–20%`), limit-down `< 10`, advancing `> 3,000`, leader confirmation, and **14:30 late-session VWAP hold**.
- **Risk-Budget & 4-Slot Multi-Track Portfolio Spec (`Mode B`)**: Cap simultaneous holdings at **4 slots (`25%` equity each)** across 3–4 policy mainlines, with a hard **Max 2 simultaneous stocks per single track** (prevents false diversification; tie-break simultaneous `B1`/`B2` signals by point-in-time 20-day relative strength). Pair with Risk-Budget sizing (`Position = Risk Budget / Stop Distance`) and Positive Pyramiding Only.
- **ETF Penetration Substitute & Sub-Chain Isolation**: Supplement passive ETF Top-10 holdings with daily **PCF lists** (zero disclosure lag) and apply the **Penetration Test** ("look through the top 3–10 holdings & weights — would you buy those exact leaders if you had STAR/ChiNext permission?"). For Mainboard-only (`60xxxx`/`00xxxx`) accounts blocked from STAR-dominated upstream tracks (e.g., semiconductor equipment/foundry), allow a high-purity sector ETF (`588170 科创半导体ETF`, >70% top-10 equipment/material purity, stamp-tax free) as an eligible attack-slot substitute. Always isolate structurally divergent sub-chains (e.g., **Domestic AI Compute** vs. **Overseas AI Supply Chain** in `watchOnly` mode) so external-shock selloffs do not pollute domestic track breadth.
- **Cross-Cycle Verified V3.2-Lite Closed-Loop Entry & Exit Spec (11-Year 3-FYP Verified & 20-Feature Ablation-Pruned to 17 Core Rules)**:
  - **5-Index MA60 Floor Gate**: Monitor `000300 沪深300`, `399006 创业板指`, `000688 科创50`, `000905 中证500`, `000852 中证1000`. Hard-stop new equity entries (`0%` attack) ONLY when **all 5 indices are simultaneously `<= MA60`** (preserves 2017/2021/2025 independent bull tracks while locking out 2018/2022/2026H2 systemic crashes). Also display **5-Index Synchronized Dry-Volume (`<0.70x 60d avg vol`)** bottom alert and **Small/Tech Climax (`>=80% 60d pos & >1.5x vol`)** top warning.
  - **Hybrid Volume-Price Entry (Base B, Pruned)**: Require `Quarterly Whitelist Passed` AND `Sector Breadth >= 40%` AND `Stock > MA60` AND `1.2–2.8x` mild volume expansion (reject `>=3.0x` extreme climax) with **T+1 non-engulfing confirmation OR T-day strong sector sync (`>=2` synchronized sector peers + sector turnover `>= 20d avg`)**; retain low-volume `B1` pullback entries. Display read-only **20-Day Down-Day Resilience Mirror (大跌逆势照妖镜)** in the watch pool to spotlight institutionally defended leaders.
  - **Symmetric Volume-Price Exit (Exit 4 + Option D Runner, Pruned & Anti-Washout)**: **`-10%` hard stop confirmed by 2 consecutive closes** (prevents intraday stop-hunt washouts, paired with a **`-15%` intraday flash-crash emergency floor**), `+8%` breakeven lock (`cost + 1%`), **Price New High + Shrinking 5d Volume Divergence (`<70%` of 20d peak 5d avg vol at `>=+20%` gain) tightens trailing stop to `MA10`**, **`+40%` trim 50% (`>=2 lots`) and leave 50% zero-risk runner trailing `MA60` with `+15%` floor (frees full attack slot)**; otherwise exit on 2 consecutive closes below `MA20`. *(Pruned redundant 15-day time stop & premature `+20%` mechanical trim via 3-era ablation.)*
  - **Idle-Cash Barbell Defense & Lot Sizing**: Park idle cash in **`50% Low-Vol Dividend ETF (512890) + 50% Treasury Bond ETF (511010)`** (odd-lot bond remainder `<1 lot` goes to `国债逆回购 131810/204001`). Simplified lot exit: `>=2 lots` hold full to `+40%` then trim half & trail MA60; `1 lot` full-position trailing; `0 lots` auto-skip & fall back to next-strongest affordable leader.
- **Behavioral Hard Locks**: No intraday T-churning in downtrends, 48h cooldown after major stop-outs, no sub-10k RMB minimum-commission "ant trades", 90-day blacklist on major loss-inducing tickers.

---

## Required Output Contract

Every stock-selection response produced with this skill should contain:
1. **Policy & Prosperity Tiering** (with concrete funding/order evidence, not slogans).
2. **Upstream / Midstream / Downstream Comparison Table** (profit pool, margin range, valuation ruler).
3. **Candidate Audit Table** (latest filing date, YTD & single-quarter revenue YoY, deducted net profit YoY, gross margin & trend, real valuation, board/lot threshold).
4. **Expectation Gap & Price-Volume Verdict** (who is actually resilient vs. crowded/overvalued, backed by retrieved prices or `normalize_drawdown.mjs` output).
5. **Explicit Risk Flags & Data Freshness Statement** (filing period, quote cutoff date, non-advice disclaimer).
