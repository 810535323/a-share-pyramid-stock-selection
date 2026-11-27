# A-Share Pyramid Stock Selection Skill (V3.2-Lite)

A systematic A-share institutional swing stock-selection, post-close signal screening, and risk-control skill (**"Policy-to-Money → Industry Chain → Earnings & Pricing Power → Volume-Price Confirmation → Execution & Barbell Defense"**).

## Highlights (V3.2-Lite · 17 Core Rules)

- **5-Index MA60 Floor Gate**: Monitors `000300`, `399006`, `000688`, `000905`, `000852`. Blocks new entries only when all 5 indices are simultaneously `<= MA60`, preserving structural bull tracks while locking out systemic crashes.
- **Sector Breadth & Sub-Chain Isolation**: Requires `>= 40%` sector leaders above `MA60` and isolates structurally divergent sub-chains (e.g., domestic vs. overseas AI supply chain) via `watchOnly`.
- **Base B Hybrid Volume-Price Entry**: Mild `1.2–2.8x` 20-day volume expansion with either **T+1 non-engulfing hold** or **T-day sector resonance** (`sectorVolRatio >= 1.0` & `>= 2` sync peers), plus low-volume `B1` pullbacks.
- **Anti-Washout Exit 4 + Option D Runner**:
  - `-10%` hard stop confirmed by **2 consecutive closes** (plus `-15%` flash-crash floor).
  - `+8%` breakeven lock (`+1%`).
  - **Volume-Divergence Tightening**: At `>= +20%` gain, 10-day price new high with shrinking 5-day volume (`< 0.70x` 20d peak) tightens trailing stop to `MA10`.
  - **Option D Wide Runner**: At `+40%`, trim half (`>= 2 lots`) and trail remainder on `MA60` with `+15%` floor, freeing the attack slot.
- **ETF Penetration Substitute & Idle-Cash Barbell**: Supports high-purity sector ETF substitutes (`588170`) for Mainboard-only accounts, parks idle cash into `50% 512890 + 50% 511010 + reverse repo`, and displays a read-only 7-Star Global ETF NAV premium radar + 20-day down-day resilience mirror.

## Quick Start

> Requires Node.js `>= 18` (zero external npm dependencies).

1. Copy the sanitized portfolio template locally (`config/portfolio.json` is git-ignored to protect your personal holdings & balance):

```bash
cp config/portfolio.example.json config/portfolio.json
```

2. Run the automated post-close review:

```bash
node scripts/daily_review.mjs --format md
```

3. Run normalized multi-stock drawdown comparison:

```bash
node scripts/normalize_drawdown.mjs --beg 20260701 --stocks "上游:002371:北方华创,上游:688019:安集科技,中游:688981:中芯国际,基准:588170:科创半导ETF"
```

## Directory Structure

```text
a-share-pyramid-stock-selection/
├── SKILL.md                                  # Core skill instructions & workflow
├── config/
│   ├── portfolio.example.json                # Sanitized account & V3.2-Lite rules template
│   └── watchlist.json                        # Quarterly audited tracks, ETF proxies & benchmarks
├── references/
│   ├── execution-risk-and-sentiment.md       # Regime filters, sentiment & behavioral locks
│   ├── industry-chain-valuation-rules.md     # Per-layer valuation rulers & traps
│   └── stock-discovery-sop.md                # 5-minute industry-chain stock discovery SOP
└── scripts/
    ├── daily_review.mjs                      # Multi-source V3.2-Lite daily review engine
    └── normalize_drawdown.mjs                # Normalized multi-stock drawdown verifier
```

> **Disclaimer**: This repository is strictly for quantitative strategy research and trading discipline assistance. It does not constitute investment advice.
