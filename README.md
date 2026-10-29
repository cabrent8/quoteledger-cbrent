# QuoteLedger

Built for the **ENTI 633 Agent Bootcamp**.

## Overview

QuoteLedger is a procurement workbench that compares multiple supplier quotes (uploaded PDFs or pasted quote text) for a single Request for Quotation (RFQ) and recommends a purchase order (PO) award, enforcing a minimum three-quote policy gate unless sole-source is confirmed.

## Five Output Sections

1. **01. Award Recommendation** — Summarizes the recommended PO award (or holds the award behind the three-quote / sole-source gate), freight breakeven basis, fallback supplier, and required pre-PO clarifications.
2. **02. Whole-RFQ Comparison Table** — Ranks all suppliers for full-RFQ award by delivered pre-tax cost in CAD, delivery lead time, and payment terms.
3. **03. Split-Award Comparison (Line-by-Line & Order MOQs)** — Compares line-level pricing across every bidder alongside order-level freight/handling/certification charges and minimum order requirements to evaluate net split-award savings.
4. **04. Technical Comparison Table (SME Review)** — Cross-references CC#, manufacturer and part number, supplier line specifications (highlighting differences across suppliers), quantities/UOM/pack sizes, and technical substitutes held provisional pending SME approval.
5. **05. Clarification & Compliance Flags** — Lists every missing value, estimated charge, technical substitute, expired quote, quantity/UOM/pack discrepancy, and ignored embedded instruction by action owner.

## Architecture & Safeguards

- **AI Extraction Only, Deterministic Math in Code** — Uses `gemini-3.5-flash-lite` strictly on the server to extract structured quote fields and align RFQ lines; all currency conversions, subtotals, delivered totals, freight breakeven thresholds, split-award calculations, and rankings are computed deterministically in TypeScript code.
- **Bank of Canada Exchange Rates** — Foreign currency quotes are converted to CAD using live observations fetched directly from the Bank of Canada Valet API in server code (with optional buyer override rates if a rate is unavailable).
- **Synthetic Data Only** — Built and demonstrated exclusively with synthetic, fictional supplier quotes; do not upload confidential supplier pricing.
- **Secrets Management** — The Gemini API key (`GEMINI_API_KEY`) is stored in AI Studio Secrets on the server and is never placed in source code or exposed to the client.
