# 🇵🇪 Peru Elige 2026
### Real-Time Election Analytics Platform

A real-time analytics platform built to monitor, validate, visualize, and forecast Peru's 2026 presidential runoff election using official ONPE data.

🔴 Live election monitoring  
📊 Historical trend tracking  
🗺️ Regional vote analysis  
⚡ Automated data validation  
📈 Outcome forecasting  
🔄 Near real-time updates

---

## Live Dashboard

👉 **Dashboard:** https://mrsprintalot.github.io/Peru_Elecciones_2026_2da/

---

## Project Overview

Election results arrive gradually throughout election night as polling stations submit their official vote counts.

The challenge is not simply displaying percentages. Decision-makers, journalists, analysts, and citizens need to understand:

- Who is leading?
- Is the lead growing or shrinking?
- Which regions are driving the result?
- How stable is the trend?
- How much uncertainty remains?
- Are all official data sources reporting consistently?

This project transforms raw election data into actionable insights through automated ingestion, validation, historical tracking, forecasting, and interactive visualization.

---

## Why This Project Matters

Election nights generate large volumes of partial and constantly changing information.

Raw vote counts alone provide limited context. This platform was designed to answer higher-value analytical questions:

- How is the election evolving over time?
- Which regions explain the national result?
- Are reporting patterns consistent?
- Can we estimate the likely final outcome before 100% of votes are counted?

The goal is transparency, data quality, and insight generation using official public data.

This relevance was tested in the most demanding scenario possible: the 2026 runoff was decided by a margin near 0.02 percentage points, with the final outcome resting on roughly 1,550 observed ballots ("actas") still under review by the electoral juries (JEE). In that context, the platform's focus on communicating uncertainty — rather than prematurely declaring a winner — became its core value.

---

# Dashboard Preview

![Dashboard Screenshot](docs/dashboard-preview.png)

> _Note: add a screenshot at `docs/dashboard-preview.png` for this preview to render._

---

# Skills Demonstrated

## Business Analysis

- Trend analysis
- Forecasting
- Data validation
- KPI design
- Stakeholder-focused reporting
- Geographic performance analysis
- Executive dashboard design

## Data Analytics

- Real-time metrics
- Historical trend monitoring
- Statistical reasoning
- Exploratory analysis
- Data interpretation
- Variance analysis

## Data Engineering

- API ingestion
- Automated refresh workflows
- Data quality controls
- Anti-bot proxy design (Cloudflare Worker)
- Cache optimization
- Data normalization

## Data Visualization

- Interactive dashboards
- Geographic visualizations (D3.js + TopoJSON)
- Time-series analysis
- Information hierarchy design
- Decision-oriented reporting

---

# Recruiter Playbook

## Business Problem

Election results are released progressively as polling stations report their vote counts.

Stakeholders need a reliable way to monitor trends, understand regional dynamics, validate official reporting, and estimate likely outcomes before the final count is complete.

---

## Approach

1. Retrieve official election results from ONPE APIs
2. Normalize incoming datasets
3. Validate national and regional consistency
4. Track reporting progress over time
5. Monitor trend evolution
6. Generate visual insights
7. Estimate final outcomes based on reporting progress

---

## Key Insights Generated

- National vote distribution
- Regional voting patterns
- Vote-count progression
- Lead stability analysis
- Historical trend evolution
- Official data consistency monitoring
- Outcome sensitivity to pending (JEE) ballots

---

## Business Value

- Faster interpretation of election trends
- Increased transparency
- Better understanding of regional voting behavior
- Continuous monitoring of official reporting
- Data-driven election analysis
- Responsible communication of uncertainty in a tight race

---

# Technical Deep Dive

## Architecture

```text
Official ONPE APIs
        │
        ▼
Cloudflare Worker  (anti-bot proxy + CORS + KV)
        │
        ▼
Data Normalization & Parsing  (by candidate DNI)
        │
        ▼
Trend Tracking  (cut-by-cut history in Cloudflare KV)
        │
        ▼
Forecasting Logic  (regional-lean projection + sensitivity band)
        │
        ▼
Interactive Dashboard  (vanilla JS · Chart.js · D3.js)
        │
        ▼
GitHub Pages Deployment
```

---

## Data Sources

### Primary Source

- Official ONPE Election Results API (national totals + per-candidate results)

### Supporting Sources

- Regional election endpoints (26 departments + overseas vote)
- JEE (Jurado Electoral Especial) pending-ballot figures

---

## Data Quality Controls

The platform performs validation checks to identify:

- Missing regional records
- National vs regional discrepancies
- Invalid vote totals
- Reporting delays
- Inconsistent aggregation results

Real-world datasets are rarely perfect. Detecting anomalies is often as important as visualizing the data itself.

A notable engineering challenge was ONPE's anti-bot protection: requests not resembling a real browser received an Angular shell instead of JSON. The Cloudflare Worker was tuned (header set, no `Origin`/`X-Requested-With`, realistic `sec-fetch-*`) to reliably retrieve official data.

---

## Trend Tracking

Each reporting "cut" is recorded to Cloudflare KV, building a timeline of how the count evolved (percentage processed and each candidate's share over time).

This enables:

- Trend analysis
- Vote evolution monitoring
- Lead-change detection
- Forecasting inputs

> _Full per-region snapshot archiving is on the roadmap (see Future Improvements)._

---

## Forecast Methodology

The forecasting component estimates the likely final result from the ballots still pending (mostly observed ballots under JEE review). It evaluates:

- Each region's **current vote distribution** (the pending ballots are projected using the lean of their own region)
- **Reporting progress by region** (how many ballots remain where)
- **Valid votes per acta** (to estimate how many votes each pending ballot contributes)
- An **adjustable annulment rate** for observed ballots, since the JEE can validate, correct, or annul votes

The output is a **band, not a single point**: optimistic / base / pessimistic scenarios, plus a **sensitivity chart** showing at which annulment rate the result would flip. A complementary metric reports the share of pending ballots the trailing candidate would need to overturn the lead.

The objective is not to predict voter behavior. It is to estimate likely final outcomes — with explicit uncertainty — based on official results already reported.

> The model does not declare a winner. Under Peruvian law, only the JNE (National Jury of Elections) proclaims the official result.

---

## Technology Stack

### Frontend

- HTML5
- CSS3
- JavaScript (vanilla, no frameworks)

### Visualization

- Chart.js (time-series, sensitivity charts)
- D3.js + TopoJSON (choropleth map of Peru, world map for overseas vote)

### Data Layer

- ONPE APIs
- Cloudflare Workers + KV

### Deployment

- GitHub Pages

### Version Control

- Git
- GitHub

---

# AI-Assisted Development

This project was developed using a modern AI-assisted workflow with **Claude Code (Claude Fable 5)**.

AI accelerated implementation and iteration speed, while project direction, analytical logic, validation requirements, testing, and final decision-making remained human-driven.

### My Responsibilities

- Product vision
- Feature definition
- Data source research
- Validation logic design
- Forecasting requirements
- Dashboard UX decisions
- Quality assurance
- Testing and verification
- Deployment and maintenance

### AI-Assisted Responsibilities

- Code generation
- Refactoring
- Boilerplate implementation
- Documentation drafting
- Rapid prototyping

This reflects the increasingly common Human + AI workflow used in modern software, analytics, and product development.

---

# Challenges Solved

## Anti-Bot Data Access

ONPE's results sit behind anti-bot protection that returned an HTML shell instead of JSON. A Cloudflare Worker was configured to replicate a real browser's request signature, restoring reliable access to official data.

## Data Consistency

Official national and regional datasets occasionally reported discrepancies. The platform surfaces these so they can be tracked rather than hidden.

## Near Real-Time Updates

The dashboard refreshes automatically while balancing responsiveness and API utilization, staying within Cloudflare's free-tier subrequest limits via a split-fetch pattern.

## Information Density

Election data contains thousands of records across multiple aggregation levels. The dashboard surfaces the most important insights without overwhelming users, organized into focused tabs (national results, overseas vote, projection).

---

# Lessons Learned

This project reinforced several real-world analytics skills:

- Working with imperfect data
- Designing stakeholder-friendly dashboards
- Building validation frameworks
- Communicating uncertainty responsibly
- Managing near real-time data flows
- Combining analytics with product thinking
- Leveraging AI-assisted development effectively

---

# Future Improvements

- Full per-region snapshot archiving (object storage) for post-election audit
- Country-level drilldown for the overseas vote
- National vs regional consistency verifier
- Historical election comparisons
- Additional anomaly detection rules (e.g., Benford's Law)
- Exportable reports

---

# About Me

## Rafael Vasquez

Business Analyst | Data Analyst | BI Analyst

8+ years of experience transforming data into business decisions through analytics, automation, reporting, and process improvement.

### Core Skills

- SQL
- Power BI
- Excel
- Azure Data Factory
- Data Analytics
- Business Analysis
- Dashboard Development
- Process Automation

### Links

- LinkedIn: https://linkedin.com/in/rafaelvasquezba/
- GitHub: https://github.com/MrSprintALot

---

### Disclaimer

This project is an independent analytical and educational initiative.

Election data belongs to the corresponding official public institutions. Results displayed are sourced from official ONPE reporting systems.
