# 5-Minute Industry-Chain Stock Discovery SOP

Use this 4-step pipeline to map **any** unfamiliar A-share policy theme or industry into pure, authoritative upstream, midstream, and downstream leader candidates without memorizing tickers.

## Step 1: Extract the Chain Map (1–2 Minutes)
- **Broker/Portal Chain Maps**: Use Tonghuashun (同花顺) or Eastmoney (东方财富) "产业链图谱" (Industry Chain Map) for the target theme.
- **Sort by Market Cap Descending**: Inside each sub-node (Upstream / Midstream / Downstream), always sort by **total market cap (总市值)**, not 1-day percentage gain. The top 2–3 names per sub-node capture ~90% of institutional leaders.

## Step 2: Cross-Check Against Sub-Sector ETF Top-10 Holdings (1 Minute)
- Look up the purest thematic ETFs tracking the target segment (e.g., `半导体材料设备ETF`, `芯片ETF`, `电网设备ETF`, `机器人ETF`, `创新药ETF`).
- Inspect **Top-10 Holdings (前十大重仓股)** in fund F10. Index providers have already screened for business purity, market cap, and liquidity.
- Comparing two ETFs (e.g., an upstream equipment/materials ETF vs. a broad chip ETF) immediately separates chain tiers cleanly.

## Step 3: Verify Niche Positioning via Broker Deep-Dive Reports (1 Minute)
- Search Eastmoney Research / HuiBo / Luobo Invest for `"<Industry> 行业深度 产业链梳理"`.
- Jump straight to the **Industry Chain Diagram**, **Market Share Table**, and **Domestic Substitution Rate Table** to identify bottlenecks and sole/duopoly suppliers.

## Step 4: Purity & Margin Filter via F10 Revenue Breakdown (1 Minute)
- Open each candidate's **F10 -> Operating Analysis -> Main Business Composition (主营构成按产品分类)**.
- **Purity Cutoff**: Require target core business revenue share **`>= 50%`** (prefer `>= 70%`). Immediately reject peripheral concept stocks with `< 20%` exposure.
- **Segment Margin Check**: Record the **segment gross margin** right next to revenue share—this immediately distinguishes high-margin bottleneck links from low-margin commoditized links.

## Step 5: Mitigating Passive ETF Rebalance & Reporting Lag
Passive thematic ETFs carry **two structural lags**: (a) CSI indices typically rebalance **semi-annually** (effective after market close on the 2nd Friday of June and December), and (b) quarterly fund reports disclose Top-10 holdings ~15 trading days after quarter-end, weighted by *past* market cap. Close this gap with three habits:
1. **Use Daily PCF Lists (Zero Disclosure Lag)**: Check the ETF's daily **PCF (申购赎回清单)** on exchange/broker apps for exact real-time full constituents rather than waiting for quarterly Top-10 reports.
2. **Watch Late-May / Late-Nov Rebalance Notices**: CSI announces constituent changes ~2 weeks prior; avoid chasing newly added names right before effective dates (short-term passive-buying spikes often fade) and never catch falling knives being deleted from an index.
3. **Treat ETFs as a Baseline Map, Not the Sole Pool**: Combine full ETF constituents with **quarterly whole-sector financial screens** (after Apr 30 / Aug 31 / Oct 31: `Deducted Profit YoY > 30%`, `Gross Margin QoQ ↑`, `Market Cap >= 10B RMB`) to surface emerging leaders before they climb into ETF Top-10 (e.g., 沪电股份, 平高电气, 华锐精密, 欧科亿, 金盘科技).

## Step 6: Mainboard-Only Account (`60xxxx` / `00xxxx`) Adaptation
When a user lacks `688` STAR Market (500k RMB threshold) or `300/301` ChiNext (100k RMB threshold) permissions:
- Filter every industry-chain universe explicitly to **Shanghai (`60xxxx`) & Shenzhen (`00xxxx`) Mainboard tickers** (100-share lots) and rank them transparently via the 5-dimension V2.0 scorecard (Growth 30 / Pricing Power 20 / Valuation 15 / Trend & MA60 Resilience 20 / V2.0 Swing Fit 15).
- Explicitly warn when a sector's strongest core leaders sit predominantly on `688`/`300` (e.g., Semiconductors and Optical Modules) — offer liquid **Mainboard-tradable thematic ETFs** (e.g., `159326` Grid, `159667` CNC, `515880` Telecom) as clean permission-free proxies when that sector passes the V2.0 `>= 40%` breadth green light.
