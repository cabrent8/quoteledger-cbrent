# QuoteLedger — RFQ Quote Comparison & Award Workbench

QuoteLedger eliminates manual spreadsheet reconciliation for supply chain buyers by comparing uploaded supplier quote PDFs and pasted quote text on a single screen, enforcing competitive-bidding guardrails, converting foreign currencies via live Bank of Canada rates, and recommending a defensible purchase order award in CAD.

## User Review & Critical Decisions

> [!IMPORTANT]
> The scope and visual architecture below incorporate your confirmed preferences from our initial review alongside strict procurement compliance rules.

- **Confirmed Input Scope**: Manual supplier quote PDF uploads and raw quote text pasting only—no preloaded synthetic scenario buttons or external account connections.
- **Confirmed Output Surface**: Pure on-screen decision tables and recommendation display with zero export, copy, email, or sharing controls.
- **Confirmed Layout & Theme**: Crisp light financial ledger aesthetic featuring a collapsible top input panel and fluid responsive ergonomics across desktop, laptop, and phone screens.
- **Estimated Charges Rule**: Supplier-estimated charges (e.g., *"freight estimated, actual billed"*) are treated as stated amounts—counting as complete bids for Whole-RFQ ranking and freight breakeven calculations—while flagged `"Estimate—confirm with supplier"`.
- **Untrusted Quote Boundary**: Any text inside uploaded PDFs or pasted quotes is treated strictly as quote content, never executed as commands; Section 05 flags `"Embedded instruction ignored"` **only** when quote text addresses an AI/assistant or attempts to alter the evaluation (e.g., *"Note to AI"*, *"ignore other quotes"*, *"award to us"*), never for standard commercial terms (payment, delivery, returns, cancellation, or warranty conditions).
- **Strict Numerical Integrity**: Gemini parses unstructured PDFs and messy text quotes verbatim without inventing missing figures, while application code fetches live Bank of Canada Valet API exchange rates and computes all CAD conversions, totals, rankings, and freight breakeven thresholds deterministically.

---

## 1. Overview & Core Concept

- **What It Does**: Ingests supplier quotes (PDF documents and/or pasted unformatted text) plus an optional buyer instruction for a single RFQ session, normalizes cross-supplier line items by CC#, manufacturer, and manufacturer part number (MPN), converts foreign prices to CAD using official Bank of Canada daily observations (with inline buyer overrides), and renders five structured decision views on one screen: Award Recommendation, Whole-RFQ Comparison, Split-Award Analysis, Technical SME Review Matrix, and Compliance/Clarification Flags.
- **Target Audience / Persona**: Supply chain and procurement buyers evaluating three or more vendor quotes per RFQ under time pressure who need protection against silent errors—such as treating excluded freight as zero, overlooking UOM/pack-size mismatches, missing expired quotes, or issuing POs without three competitive bids.
- **Key Value**: Cuts 30+ minutes of manual weekly quote normalization down to seconds while guaranteeing audit-grade guardrails: missing data is explicitly marked `"Not stated—supplier clarification required"`, rankings remain provisional when cost or technical gaps exist, and unquoted freight is bounded by an exact CAD breakeven threshold against the next-best complete quote.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Quote Intake (Collapsible Input Panel)**:
   - On arrival, the collapsible Quote Intake Panel is open at the top of the screen.
   - The buyer drags or selects one or more supplier quote PDFs, and/or adds one or more pasted quote text entries (supporting messy email bodies without quote numbers or CC# codes), plus an optional buyer request field (e.g., *"Recommend the award so I can issue the PO today."*).
   - Submitting runs extraction and Bank of Canada currency lookup; once results arrive, the intake panel collapses into a compact summary bar (showing quote count, detected currencies, and an `Edit Quotes` toggle) to maximize vertical space for the five comparison sections.
2. **Minimum 3-Quote Policy Gate**:
   - If fewer than three distinct supplier quotes are provided in the session, the workbench halts award generation immediately.
   - The Recommendation section states the exact quote count received versus the three-quote minimum and prompts the buyer directly: **Confirm Sole-Source Justification** (unlocks evaluation and records sole-source basis) or **More Quotes Coming** (re-opens the Quote Intake Panel to add remaining quotes while withholding any award).
3. **Foreign Currency Bar & Live Buyer Override**:
   - Whenever any quote uses a non-CAD currency, an inline Exchange Rate Ledger strip displays each foreign currency code, the fetched Bank of Canada Valet API rate, the observation date (`YYYY-MM-DD`), or `"Not stated"` if no rate could be retrieved.
   - Buyers can type an override rate for any foreign currency and apply or reset to the Bank of Canada rate; overriding immediately recalculates all CAD line prices, order totals, breakeven freight figures, rankings, and the recommendation without re-uploading quotes.
4. **Single-Screen Five-Part Review**:
   - **Section 1 — Recommendation**: Displays the structured award statement (matching the required phrasing with supplier, CAD total, lead time, payment terms, exact CAD savings vs. next-best quote, freight breakeven condition, and fallback supplier), or surfaces blocking clarification questions when essential data is missing.
   - **Section 2 — Whole-RFQ Table**: Compares every supplier side-by-side across Goods, Freight, Handling, Certifications, Delivered Pre-Tax Cost (showing both original currency + FX basis and CAD), Lead Time, Payment Terms, Expiry Date, and Rank. Supplier-estimated charges (e.g., *"freight estimated, actual billed"*) are included at their stated amount as complete bids for ranking and freight breakeven math with an inline `"Estimate—confirm with supplier"` note, whereas truly unstated/excluded charges keep rankings provisional.
   - **Section 3 — Split-Award Table**: Shows each matched RFQ line item with the lowest-cost supplier per line (CAD), alongside supplier MOQs, order-level freight/handling/certification charges, and net split-award cost vs. whole-RFQ cost.
   - **Section 4 — Technical Table (SME Review)**: Lists requested line identifiers (CC#, Manufacturer, MPN) alongside every supplier's quoted part number, technical specifications, proposed substitutes/alternatives, unit/line prices (original and CAD), and explicit SME review flags keeping affected lines provisional prior to sign-off.
   - **Section 5 — Clarification & Risk Flags**: Consolidates every missing value (`"Not stated—supplier clarification required"`), estimated charge (`"Estimate—confirm with supplier"`), AI/evaluation-manipulation text inside quote documents (`"Embedded instruction ignored"`, excluding normal commercial terms), substitute or part-number change, expired quote, and quantity, UOM, or pack-size discrepancy—filterable by flag category so buyers can review supplier, SME, and security action items rapidly.

### Visual Identity & Theme

- **Aesthetic Direction**: Utilitarian institutional procurement ledger—calm, authoritative, high-density tabular clarity with zero decorative clutter, zero badge sandwiches, and zero fake telemetry.
- **Color Palette & Mood (60-30-10 Light Ledger)**:
  - *60% Dominant Neutral Canvas*: Crisp ledger white (`#FFFFFF`) on cool paper slate (`#F8FAFC`).
  - *30% Structural Surfaces*: Subdued table header bands (`#F1F5F9`), `1px solid #E2E8F0` hairline grid dividers, primary ink (`#0F172A`), and secondary slate prose (`#475569`).
  - *10% Semantic & Action Accents*: Deep Slate Navy (`#0F172A`) for primary buttons and active segmented tabs; Forest Green (`#15803D`) paired with explicit text/icons for complete lowest-cost rankings; Amber (`#B45309`) paired with warning icons/labels for provisional rankings, unstated freight breakevens, and SME technical reviews; Crimson (`#B91C1C`) paired with alert icons/labels for `< 3` quote blocks, expired quotes, and missing exchange rates.
- **Typography & Hierarchy (2+1 Rule)**:
  - *Display & Section Headings*: `Plus Jakarta Sans` (600–700 weight, balanced wrapping) for the brand wordmark, recommendation header, and numbered section headings (`01. Recommendation` through `05. Clarification Flags`).
  - *Body & Analytical Prose*: `Public Sans` (400/600 weight, 13px–15px) for clear supplier notes, conditions, and specifications.
  - *Financial Figures, Rates, Dates & Part Numbers*: `IBM Plex Mono` with strict `tabular-nums` alignment across every price, FX rate, quantity, MOQ, expiry date, and rank column.
- **Component Styling & Responsive Multi-Device Layout**:
  - **Desktop (`1440px+`) & Laptop (`1024px–1366px`)**: Fluid centered container (`max-w-[1360px]` with responsive horizontal padding) using single-elevation flat bordered surfaces (`border border-slate-200`), compact `38px–42px` high-density table rows, right-aligned numeric columns, left-aligned text columns, sticky identifier columns on wide multi-vendor matrices, and unboxed inline metadata separated by `·` dividers (strictly zero pill enclosures or thick `border-l-4` stripes).
  - **Phone & Small Viewports (`< 768px`)**: Single-column stacked PDF/paste intake inputs with `>= 44px` touch targets, responsive Exchange Rate override controls, smooth horizontal table scroll containers (`overflow-x-auto`) with sticky left `Supplier` / `Line` columns so tabular numbers never wrap or clip, and a compact header obeying the `<= 15%` mobile sticky viewport height cap (with a horizontally scrollable section jump strip below the fold on narrow screens).
  - Top bar obeys the strict 3-zone single-row contract: Brand wordmark on the left, 5 single-line section jump links in the center (`Recommendation`, `Whole-RFQ`, `Split Award`, `Technical`, `Flags` on `md+`), and a single `New RFQ Session` reset button on the right.
- **Interactive Feedback & Motion**:
  - Instantaneous (`150ms`) collapsible drawer transitions using opacity/transform, structured table row skeletons while Gemini extracts PDF/text quotes, subtle row hover highlights across wide multi-supplier tables, and live client-side recalculation when adjusting FX overrides or confirming sole-source justification.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Hybrid AI Extraction + Deterministic Code Calculation**
  - *Chosen Approach*: Use Gemini (`gemini-3.8-flash`) strictly for multimodal PDF/messy-text extraction, cross-supplier line matching (by CC#, manufacturer, and part number), and grounded prose phrasing—while performing all Bank of Canada FX lookups, currency conversions, delivered totals, rankings, expiry date comparisons, and maximum excluded freight breakeven calculations in deterministic TypeScript code.
  - *Why*: Eliminates LLM arithmetic drift and strictly enforces the rule that exchange rates are fetched in code (never by Gemini) and unstated freight is never treated as zero.
  - *Alternatives Considered*: Letting Gemini compute converted CAD totals and rankings directly—rejected because LLMs can hallucinate FX rates or miscalculate cent-level breakeven thresholds.

- **Decision 2: Pre-Award Quote Count Detection Across Mixed Inputs**
  - *Chosen Approach*: Extract structured supplier quotes from all uploaded PDFs and pasted text blocks first, then evaluate the exact distinct supplier quote count before running any award logic.
  - *Why*: Accurately handles both buyers who add separate PDF/text entries per vendor and buyers who paste multiple vendor quotes into a single text area, while guaranteeing a hard stop with zero award recommendation whenever fewer than three quotes exist without sole-source confirmation.
  - *Alternatives Considered*: Counting raw UI input fields before submission—rejected because one pasted block may contain three quotes, or two uploaded pages might belong to the same quote.

- **Decision 3: Estimated Charges vs. Unstated Charges**
  - *Chosen Approach*: Distinguish supplier-estimated charges (`estimated_amount`, e.g., *"Freight: $180 estimated, actual billed"*) from unstated charges (`not_stated`, e.g., *"Freight extra"* or omitted). Estimated amounts are summed into Delivered Pre-Tax Cost so the bid counts as complete for ranking and serves as a valid comparator for excluded-freight breakeven calculations, while generating an `"Estimate—confirm with supplier"` flag.
  - *Why*: Prevents penalizing or disqualifying transparent suppliers who provide good-faith freight/handling estimates while ensuring the buyer confirms final billing terms before PO issuance.
  - *Alternatives Considered*: Treating estimates as missing/unstated—rejected because a stated estimate gives a concrete cost basis for ranking and breakeven comparison.

- **Decision 4: Scoped Prompt-Injection Detection vs. Normal Commercial Terms**
  - *Chosen Approach*: Wrap all PDF contents and pasted quote text in strict untrusted-data boundaries so nothing inside a quote is ever executed as a command, while scoping the `"Embedded instruction ignored"` flag strictly to text that addresses an AI/assistant/model or tries to manipulate the evaluation or award (e.g., *"Note to AI"*, *"ignore other quotes"*, *"award to us"*). Normal commercial clauses—such as payment instructions, shipping/delivery conditions, RMA/returns, cancellation windows, or warranty terms—are parsed as ordinary quote content and never flagged as embedded instructions.
  - *Why*: Protects the evaluation against prompt injection without creating false-positive noise on standard legal and commercial boilerplate present on virtually every vendor quote.
  - *Alternatives Considered*: Broadly flagging any imperative phrasing—rejected because standard vendor terms routinely use imperative commercial language (*"Remit payment to..."*, *"Notify carrier within 5 days..."*).

- **Decision 5: Session-Only Ephemeral Memory**
  - *Chosen Approach*: Hold all uploaded files, parsed quotes, FX rates, and buyer overrides strictly in active browser session state with a one-click `New RFQ Session` clear action; zero database, `localStorage`, or cross-session persistence.
  - *Why*: Directly satisfies the rule to use only quotes provided in the current session and never reuse quotes from earlier sessions.
  - *Alternatives Considered*: Persisting quote history in browser storage—rejected to prevent accidental cross-RFQ contamination.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SINGLE-SCREEN BUYER WORKBENCH                        │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Top Bar: Brand Wordmark  │  5 Section Anchor Links  │  New RFQ Session │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│  ┌───────────────────────────────────▼────────────────────────────────────┐  │
│  │ Collapsible Quote Intake Panel                                         │  │
│  │  • Multi-PDF Upload Dropzone     • Multi-Slot Raw Quote Text Paste     │  │
│  │  • Optional Buyer Request Input  • Compare Quotes Trigger              │  │
│  └───────────────────────────────────┬────────────────────────────────────┘  │
│                                      │ POST (PDF base64 + text + session dt) │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ APPLICATION SERVER API                                                 │  │
│  │  1. Gemini Multimodal Parser (gemini-3.8-flash + strict JSON schema)   │  │
│  │     → Untrusted quote isolation (captures embedded instructions)       │  │
│  │     → Verbatim headers, firm/estimated/unstated charges, lines, specs  │  │
│  │     → Canonical line matching (CC# → Manufacturer + MPN → Description) │  │
│  │  2. Bank of Canada Valet FX Fetcher (Code-only HTTP GET)               │  │
│  │     → /valet/observations/FX{CCY}CAD/json?recent=1 (rate + obs date)   │  │
│  └───────────────────────────────────┬────────────────────────────────────┘  │
│                                      │ Normalized Quotes + Official FX Rates │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ DETERMINISTIC PROCUREMENT ENGINE (In-Memory Session State)             │  │
│  │  • < 3 Quotes Gate (Halts award until Sole-Source vs. More Quotes)     │  │
│  │  • FX Converter (BoC Rate or Buyer Override; "Not stated" fallback)    │  │
│  │  • Cost & Ranking Engine (Firm + Estimated Charges = Complete Bid)     │  │
│  │  • Excluded Freight Breakeven Calculator (vs. Next-Best Complete Bid)  │  │
│  │  • Flag Detector (Missing, Estimates, Ignored Instructions, Tech/UOM)  │  │
│  └──────┬──────────────┬───────────────┬───────────────┬──────────────┬───┘  │
│         ▼              ▼               ▼               ▼              ▼      │
│  ┌────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐ │
│  │ 01. Award  │ │ 02. Whole-  │ │ 03. Split-  │ │ 04. Tech    │ │ 05. Risk │ │
│  │ Recommen-  │ │ RFQ Ledger  │ │ Award Line  │ │ SME Review  │ │ & Gap    │ │
│  │ dation /   │ │ Table       │ │ & MOQ Table │ │ Matrix      │ │ Flags    │ │
│  │ Policy Gate│ │ (+ FX Bar)  │ │             │ │             │ │ Filter   │ │
│  └────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **Session Input State**: Holds uploaded PDF descriptors (filename, byte size, base64 payload), dynamic pasted-quote text entries, optional buyer instruction string, and collapse/expand panel state.
- **Extracted Quote & Canonical Line Model**:
  - *Supplier Quote*: Supplier name, quote number (or `null` → `"Not stated—supplier clarification required"`), currency code, quote date, expiry date, lead time text + normalized days for tie-breaking, payment terms text + normalized net days for tie-breaking, order-level MOQ/minimum order value, explicit status-typed charges (`included`, `stated_amount`, `estimated_amount`, or `not_stated`) for Freight, Handling, and Certifications, and `embeddedInstructions` (populated strictly when text addresses an AI/assistant or attempts to influence ranking/award, excluding normal commercial terms like payment, delivery, returns, cancellation, or warranty).
  - *Canonical RFQ Line*: Matched across vendors via `CC#`, `Manufacturer + Part Number`, or cross-referenced substitute; tracks requested baseline vs. each supplier's quoted part number, manufacturer, specifications, quantity, UOM, pack size, line MOQ, unit price, extended price, `isEstimatedPrice` indicator if applicable, and `isSubstitute` / `partNumberChanged` flags.
- **Currency Exchange Ledger**: Maps each non-CAD currency code to its official Bank of Canada Valet observation (`rate`, `observationDate`, `seriesCode`, `fetchStatus`) plus an optional buyer `overrideRate`.
- **Policy & Computed Comparison State**: Stores `soleSourceStatus` (`unasked`, `confirmed_sole_source`, `awaiting_more_quotes`), supplier whole-RFQ cost rollups (treating `included`, `stated_amount`, and `estimated_amount` as complete cost components), provisional vs. firm rank indicators, freight breakeven allowance and basis statement, per-line split-award winners with order-charge impact, and categorized audit flags (`Missing Values`, `Estimates`, `Substitutes / SME`, `Expired Quotes`, `Qty / UOM / Pack`, and `Ignored Instructions`).

### Interactive Component & State Mapping

- **Quote Intake Controls**: Adding/removing PDF files and pasted text slots updates session input state across desktop, laptop, and touch screens; submitting validates that at least one quote source is present, triggers loading skeletons, and auto-collapses the intake drawer upon response.
- **Policy Clarification Gate (`< 3` Quotes)**: Renders inside Section 01 whenever `quotes.length < 3` and `soleSourceStatus !== "confirmed_sole_source"`. Selecting *Confirm Sole-Source* sets `soleSourceStatus = "confirmed_sole_source"` and immediately computes and reveals the recommendation; selecting *More Quotes Coming* sets `soleSourceStatus = "awaiting_more_quotes"`, keeps award hidden, and expands the Quote Intake Panel.
- **Inline FX Rate Override Controls**: Typing a custom numeric rate for any foreign currency updates `overrideRate` in state and immediately recomputes all CAD prices, supplier rankings, freight breakevens, split-award winners, and recommendation phrasing; clicking *Reset to Bank of Canada* restores the fetched official rate (or `"Not stated"` if unavailable).
- **Flag Category Filter & Responsive Navigation**: Interactive segmented filter buttons on Section 05 (`All Flags`, `Missing Values`, `Estimates`, `Substitutes / SME`, `Expired Quotes`, `Qty / UOM / Pack`, `Ignored Instructions`) filter the flags table client-side with horizontal scroll support on narrow screens, while section links jump smoothly to Sections 01–05.
- **Session Reset (`New RFQ Session`)**: Clears all session quotes, FX rates, overrides, and sole-source confirmations in memory, reopening a clean Quote Intake Panel.

### Key Sequences & Integrations

- **Gemini Multimodal Extraction (`gemini-3.8-flash`)**: Invoked exclusively from the backend server using structured `responseSchema` output. Quote PDFs and pasted text are demarcated strictly as untrusted supplier data—never instructions. Only text that addresses an AI/assistant or tries to alter the evaluation (e.g., *"Note to AI"*, *"ignore other quotes"*, *"award to us"*) is recorded in `embeddedInstructions` to raise `"Embedded instruction ignored"` in Section 05, whereas standard commercial terms (payment, delivery, returns, cancellation, warranty) are treated strictly as normal quote content without flagging. System instructions forbid inventing missing prices, freight, specifications, or exchange rates, distinguish `estimated_amount` (`"Estimate—confirm with supplier"`) from `not_stated` (`"Not stated—supplier clarification required"`), and leave buyer-request handling exclusively to the trusted top-level buyer request field.
- **Bank of Canada Valet API Integration**: Invoked directly in backend server code via `https://www.bankofcanada.ca/valet/observations/FX{CURRENCY}CAD/json?recent=1`. Extracts the latest observation value and date; gracefully handles unsupported currencies or network failures by returning `fetchStatus: "unavailable"` so the UI displays `"Not stated"` for CAD conversion until the buyer enters an override rate.
