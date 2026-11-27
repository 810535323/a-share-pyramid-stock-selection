# Execution, A-Share Sentiment Gauges & Risk-Control Rules

Stock selection decides *what* to watch; regime filters, sentiment gauges, position sizing, and exit rules decide *whether the account survives and compounds*.

## 1. Three-Layer Cadence, Quarterly Audit & Dual-Lock Regime Filter

Stock selection must operate on a strict **Point-in-Time (zero-lookahead) cadence** rather than static multi-year holding or daily rumor chasing:

### 1.1 Annual Mainline + Quarterly Whitelist Audit (4 Fixed A-Share Windows)
Perform a structured audit in the first trading week after each A-share reporting deadline:
- **Jan 31** (Annual Earnings Previews) -> **Apr 30** (Annual + Q1 — most critical) -> **Aug 31** (H1 Interim) -> **Oct 31** (Q3 Report).
- **Three Audit Switches**:
  1. **Sector Switch**: Monitor chain-wide gross margin direction, CAPEX/construction-in-progress (overcapacity warning), and spot price trends. Remove sectors entering cyclical overcapacity (e.g., 2022H2 PV/Lithium) from the active whitelist.
  2. **Chain-Tier Rotation**: Reallocate focus inside the active mainline toward the tier with accelerating deducted profit, rising gross margin, and expanding contract liabilities.
  3. **Stock Veto**: Immediately remove any ticker with **2 consecutive quarters of negative deducted-profit YoY** or steep gross-margin deterioration — never attempt technical dip-buying on fundamentally broken former leaders.
- **Between Earnings Windows**: Operate strictly mechanically inside the audited 5–10 stock whitelist; forbid impulsive theme switching.

### 1.2 The "Lagging Earnings Trap" & Dual-Lock Entry/Exit Rule
Financial statements are **lagging indicators** (e.g., 2022Q3 PV/Lithium leaders posted +100% to +400% YoY earnings *after* their stock prices had already topped in July 2022). Prevent peak-earnings traps via a strict Dual Lock:
- **Entry (`AND` Lock — all 3 required)**:
  1. Passes latest **Quarterly Whitelist Audit**;
  2. **Individual Trend Filter**: `Close > MA60` (never buy inside a medium-term bear downtrend);
  3. **Sector Breadth Shield**: `>= 40%` of the sector's core leaders are trading above their `MA60` (automatically forces cash during sector-wide bear markets).
- **Exit (`OR` Lock — either triggers exit)**:
  - `Quarterly Fundamental Falsification` **OR** `Price/Trend Breakdown` (respect institutional capital leaving ahead of the next earnings report).

### 1.3 Broad Market Regime Filter (Total Exposure Cap)

Determine total portfolio exposure before opening any new position:
- **Offensive Regime (Uptrend)**: Major indices (CSI 300 / ChiNext / STAR 50) above 20-day & 60-day MAs, healthy volume expansion, sustained leadership -> **Max Total Exposure: 70%–80%**.
- **Choppy / Structural Regime**: Indices range-bound, sector rotation active -> **Max Total Exposure: 40%–60%**; buy pullbacks/divergence only, never chase climax acceleration.
- **Breakdown / Ice-Point Regime**: Indices break below 20-day MA, limit-down stocks spike (`> 30`), high-flyers suffer catch-up crashes -> **Max Total Exposure: 0%–20%**; park cash in treasury reverse repos (GC001/R-001) or money-market ETFs (e.g., 511880), stop opening new positions, and only tag resilient stocks on watchlist.

## 2. Objective A-Share Sentiment Gauges (Replacing Gut Feelings)

In sentiment-driven A-share markets, do not rely on lagging oscillators alone *or* vague intuition. Require all three objective checks before re-entering or adding during volatile markets:
1. **Loss-Effect Containment**: Market-wide limit-down stocks `< 10` and advancing stocks `> 3,000`.
2. **Sector Leadership**: Recognizable high-capacity sector leaders stabilize and lead upward (not isolated 10-minute rumor spikes).
3. **14:30 Late-Session Confirmation**: Ignore morning 9:30–11:30 V-reversals (frequently quantitative traps in weak markets). Only act after **14:30** if both the market and target hold firmly above intraday VWAP (分时均价线), confirming overnight capital commitment.

## 3. Position Sizing & Entry Discipline

- **Risk-Budget Formula (以损定仓)**:
  `Target Position = Max Risk Per Trade (1.0%–1.5% of Total Equity) / Stop-Loss Distance (%)`
- **Concentration & Correlation Caps (4-Slot Multi-Track Standard — `Mode B`)**:
  - **Unified Account 4-Slot Architecture**: Manage a multi-track watchlist (covering 3–4 Tier-1 policy mainlines) in one unified account capped at **4 simultaneous positions (`25%` equity per slot)**.
  - **Hard Single-Track Cap (`<= 2 stocks / <= 50%`)**: Never hold more than **2 stocks simultaneously from the same industry chain/track** (even tighter `<= 35–40%` during recovery/rehab phases). Cross-cycle real-account testing proved enforcing `max 2 per track` (`Mode B`: `+30.17%`, `-13.73%` MaxDD after Oct 2025; `+10.14%` after Mar 2026) decisively outperformed unconstrained 4-slot rotation (`Mode A`: `+23.25%` / `-6.44%`).
  - **Point-in-Time Tie-Breaker**: When multiple candidates trigger `B1`/`B2` simultaneously with limited slots, prioritize strictly by **point-in-time 20-day relative strength (20日动量最强龙头优先)** — zero lookahead.
  - **Single-Stock Cap**: `<= 25%` (`<= 20%` during account rehab).
- **No-Chase Ban**: Do not buy stocks already up `> 5%` intraday (ETFs `> 3%`), extended `> 5%` above the 5-day MA, or after 3 consecutive large green candles.
- **Positive Pyramiding Only**: Enter `50%` of planned single-stock budget at pivot/pullback support; add `30%` (and optional `20%`) **only after the initial tranche is profitable (`+3% to +5%`) and trend confirms**. **Strictly forbid averaging down into losing positions.**
- **Grid-Order Safety Boundary**: Grid orders fit range-bound broad/sector ETFs, *not* single falling high-beta tech stocks. If a user insists on a stock grid, enforce: small lot per grid (e.g., 100 shares), explicit **lower price floor** where auto-buying terminates, **maximum share cap**, and physical cash isolation via reverse repo so the grid cannot drain account cash.

## 4. Four-Tier Exit Framework (Preventing "Logic Didn't Change" Bag-Holding)

Strip fundamental narrative of veto power over stop-losses: *logic decides what to buy; price and rules decide when to exit.*

1. **Tier 1 — Hard Stop-Loss (Survival)**: Set automated broker conditional stop immediately after fill at structural support or `-7% to -8%` (`-6%` for ETFs). Execute unconditionally.
2. **Tier 2 — Time Stop (Capital Efficiency)**: If flat/lagging for **10–15 trading days** while the market stabilizes or peers rally, reduce or rotate out.
3. **Tier 3 — Breakeven Lock & 30/70 Trend Trailing ("Let Core Profits Run")**:
   - Once unrealized gain reaches `+8%`, raise stop-loss conditional order to `cost + 1%` (cures premature profit-taking anxiety).
   - At `+20%` (or high-volume stalling), **trim only 30%** (upgraded from 50% after cross-cycle ablation testing showed cutting 50% at +18% prematurely capped bull-market compounding); **retain 70% core position** and trail it with the **20-day MA** (exit full remaining position if 2 consecutive closes below MA20).
   - **Tight Entry Discipline (Validated by Ablation)**: Keep strict high-quality entries (`B1` shrinking-volume pullback to MA10/MA20 support OR `B2` volume-confirmed 15-day breakout with moderate `1.5%–7%` daily gain); do *not* loosen entries to chase weak MA10 dead-cat bounces, which degrades performance in choppy regimes.
4. **Tier 4 — Fundamental Falsification / Climax Top ("Before the Last Baton Drops")**: Exit in tranches (inverted pyramid) when core drivers break (order growth slows, product prices stall/drop) or euphoria peaks (universal consensus + parabolic gap-ups + giant-volume reversal).

## 5. Behavioral Hard Locks (Especially for Statement Audits)

When auditing a user's past trade logs, check for and prescribe locks against:
- **High-Frequency Intraday T-Churning**: Cap weekly trades `<= 4`; forbid same-day round-trip T-trading in downtrends.
- **Revenge All-In Switching**: Enforce a **48-hour mandatory cooldown** after any major stop-out or full liquidation before opening a new position.
- **Minimum-Commission "Ant Trades"**: Forbid trades under 10,000 RMB when subject to 5 RMB minimum brokerage commission; park idle cash in reverse repos/money-market ETFs.
- **90-Day Obsession Blacklist**: Blacklist any ticker that caused a major realized loss (e.g., `> 5–8%` of account equity) for 90 days after exit to break revenge-trading bias.

## 6. Cross-Cycle Empirical Verification Benchmarks (Zero Lookahead, Zero Retuning)

The V2.0 closed-loop rules (Policy Tiering -> Quarterly Audit -> Sector Breadth `>= 40%` + `Close > MA60` Dual Lock -> Strict `B1`/`B2` Entry -> `-8%` Stop / `+8%` Breakeven / `+20%` Trim 30% & Trail 70% on 20-Day MA -> `Mode B` 4-Slot Max-2-Per-Track Portfolio) were stress-tested out-of-sample with identical parameters across 5 independent full-sample universes (80 total stocks, zero survivorship bias):
- **14th FYP New Energy (15 stocks, 2020.11–2023.12 full 3-yr bull+bear)**: V2.0 `+25.65%` (MaxDD `-10.01%`, Calmar `2.56`) vs Buy&Hold `+1.17%` (`-63.19%`) & CSI 300 `-28.72%`.
- **15th FYP Industrial Mother Machines (16 stocks, 2025.10–2026.11)**: V2.0 `+28.08%` (`-9.69%`, Calmar `2.90`) vs Buy&Hold `-4.98%` (`-58.28%`).
- **15th FYP Full-Chain Semiconductors (17 stocks, 2025.10–2026.11)**: V2.0 `+18.09%` (`-8.94%`, Calmar `2.02`) vs Buy&Hold `+2.67%` (`-54.01%`).
- **15th FYP New Power Grid (16 stocks, 2025.10–2026.11)**: V2.0 `+13.98%` (`-6.33%`, Calmar `2.21`) vs Buy&Hold `-5.92%` (`-44.20%`).
- **15th FYP AI Compute (16 stocks, 2025.10–2026.11)**: V2.0 `+5.78%` (`-2.62%`, Calmar `2.21`) vs Buy&Hold `-26.63%` (`-57.29%`).
- **Unified Real-Account 4-Slot Mainboard Simulation (All 34 `60/00` Mainboard stocks across 4 tracks, 200k RMB initial, 100-share lots, real fees/tax, `Mode B` max 2/track)**:
  - Post-Proposal (`2025-10-29 ~ 2026-11-25`): **`+30.17%`** (MaxDD `-13.73%`, Calmar `2.20`, 54 trades, `50.0%` WR, **`3.26:1` payoff**, auto-cash from Aug 25) vs 34-stock Buy&Hold **`-9.71%`** (`-51.25%`) & CSI 300 `-17.88%`.
  - Post-Outline (`2026-03-16 ~ 2026-11-25`): **`+10.14%`** (MaxDD `-14.67%`) vs 34-stock Buy&Hold **`-26.81%`** (`-47.41%`).
