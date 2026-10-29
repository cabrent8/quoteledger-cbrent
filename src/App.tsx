/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  AnalyzeRfqResponse,
  PastedQuoteInput,
  SoleSourceDecision,
  UploadedPdfInput,
} from './types/rfq';
import { evaluateRfqWorkbook } from './lib/procurementEngine';
import {
  createSamplePastedQuotes,
  SAMPLE_DATA_LABEL,
} from './lib/sampleQuotes';
import { QuoteIntakePanel } from './components/QuoteIntakePanel';
import { FxRateBar } from './components/FxRateBar';
import { RecommendationSection } from './components/RecommendationSection';
import { WholeRfqTable } from './components/WholeRfqTable';
import { SplitAwardTable } from './components/SplitAwardTable';
import { TechnicalTable } from './components/TechnicalTable';
import { FlagsSection } from './components/FlagsSection';

const AI_BUSY_MESSAGE =
  'The AI service is busy. Your quotes are still loaded—please try again in a minute.';
const NO_QUOTES_MESSAGE =
  'Add at least one supplier quote PDF or pasted quote to compare.';

function getLocalSessionDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function createInitialPastedSlots(): PastedQuoteInput[] {
  return [
    { id: 'paste-1', label: 'Supplier Quote 1', text: '' },
    { id: 'paste-2', label: 'Supplier Quote 2', text: '' },
    { id: 'paste-3', label: 'Supplier Quote 3', text: '' },
  ];
}

export default function App() {
  const [pdfs, setPdfs] = useState<UploadedPdfInput[]>([]);
  const [pastedQuotes, setPastedQuotes] = useState<PastedQuoteInput[]>(
    createInitialPastedSlots
  );
  const [buyerRequest, setBuyerRequest] = useState<string>('');
  const [isIntakeOpen, setIsIntakeOpen] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [analysisResponse, setAnalysisResponse] =
    useState<AnalyzeRfqResponse | null>(null);
  const [fxOverrides, setFxOverrides] = useState<Record<string, number | null>>(
    {}
  );
  const [soleSourceDecision, setSoleSourceDecision] =
    useState<SoleSourceDecision>(SoleSourceDecision.UNASKED);

  const isSampleDataActive = useMemo(
    () =>
      pdfs.length === 0 &&
      pastedQuotes.some(
        (p) =>
          p.text.trim().length > 0 &&
          (p.label.includes(SAMPLE_DATA_LABEL) ||
            p.text.includes(SAMPLE_DATA_LABEL))
      ),
    [pdfs, pastedQuotes]
  );

  const hasAnyCurrentInputs = useMemo(() => {
    const hasPastedContent = pastedQuotes.some((p, idx) => {
      const defaultLabel = `Supplier Quote ${idx + 1}`;
      return p.text.trim().length > 0 || p.label.trim() !== defaultLabel;
    });
    return (
      pdfs.length > 0 ||
      hasPastedContent ||
      buyerRequest.trim().length > 0 ||
      analysisResponse !== null
    );
  }, [pdfs, pastedQuotes, buyerRequest, analysisResponse]);

  const workbook = useMemo(() => {
    if (!analysisResponse) return null;
    return evaluateRfqWorkbook({
      rfqTitle: analysisResponse.rfqTitle,
      sessionDate: analysisResponse.sessionDate,
      quotes: analysisResponse.quotes,
      canonicalLines: analysisResponse.canonicalLines,
      fxObservations: analysisResponse.fxRates,
      fxOverrides,
      soleSourceDecision,
      buyerRequest,
      buyerRequestSummary: analysisResponse.buyerRequestSummary,
    });
  }, [analysisResponse, fxOverrides, soleSourceDecision, buyerRequest]);

  const handleAddPdfs = (files: UploadedPdfInput[]) => {
    setPdfs((prev) => [...prev, ...files]);
  };

  const handleRemovePdf = (id: string) => {
    setPdfs((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAddPastedSlot = () => {
    setPastedQuotes((prev) => [
      ...prev,
      {
        id: `paste-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: `Supplier Quote ${prev.length + 1}`,
        text: '',
      },
    ]);
  };

  const handleUpdatePastedSlot = (
    id: string,
    field: 'label' | 'text',
    value: string
  ) => {
    setPastedQuotes((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, [field]: value } : slot))
    );
  };

  const handleRemovePastedSlot = (id: string) => {
    setPastedQuotes((prev) => prev.filter((slot) => slot.id !== id));
  };

  const handleSetFxOverride = (currency: string, rate: number | null) => {
    setFxOverrides((prev) => ({
      ...prev,
      [currency]: rate,
    }));
  };

  const handleLoadSampleQuotes = () => {
    // Replace current inputs strictly in this session without adding any PDFs
    setPdfs([]);
    setPastedQuotes(createSamplePastedQuotes());
    setBuyerRequest('');
    setAnalysisResponse(null);
    setFxOverrides({});
    setSoleSourceDecision(SoleSourceDecision.UNASKED);
    setErrorMessage(null);
    setIsIntakeOpen(true);
  };

  const handleResetSession = () => {
    setPdfs([]);
    setPastedQuotes(createInitialPastedSlots());
    setBuyerRequest('');
    setAnalysisResponse(null);
    setFxOverrides({});
    setSoleSourceDecision(SoleSourceDecision.UNASKED);
    setErrorMessage(null);
    setIsIntakeOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCompareQuotes = async () => {
    // Ignore empty or whitespace-only paste slots so they never count as quotes or trigger errors
    const activePasted = pastedQuotes.filter((p) => p.text.trim().length > 0);
    if (pdfs.length === 0 && activePasted.length === 0) {
      setErrorMessage(NO_QUOTES_MESSAGE);
      setIsIntakeOpen(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSoleSourceDecision(SoleSourceDecision.UNASKED);

    try {
      const response = await fetch('/api/rfq/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfs: pdfs.map((f) => ({
            id: f.id,
            fileName: f.fileName,
            base64Data: f.base64Data,
            mimeType: f.mimeType,
          })),
          pastedQuotes: activePasted,
          buyerRequest,
          sessionDate: getLocalSessionDate(),
        }),
      });

      let payload: (AnalyzeRfqResponse & {
        errorCode?: string;
        userMessage?: string;
      }) | null = null;

      try {
        payload = (await response.json()) as AnalyzeRfqResponse & {
          errorCode?: string;
          userMessage?: string;
        };
      } catch (parseErr) {
        console.error('[App] Non-JSON server response on /api/rfq/analyze:', {
          status: response.status,
          parseErr,
        });
      }

      if (!response.ok || !payload || !Array.isArray(payload.quotes)) {
        console.error('[App] Quote comparison returned non-OK response:', {
          status: response.status,
          payload,
        });
        const safeUserMessage =
          payload &&
          typeof payload.userMessage === 'string' &&
          [
            'AI_BUSY',
            'DAILY_QUOTA_REACHED',
            'NO_QUOTES',
            'UNREADABLE_FILE',
          ].includes(payload.errorCode || '')
            ? payload.userMessage
            : AI_BUSY_MESSAGE;

        setErrorMessage(safeUserMessage);
        setIsIntakeOpen(true);
        return;
      }

      setAnalysisResponse(payload);
      setIsIntakeOpen(false);
    } catch (err) {
      // Log technical details to console only; keep loaded quotes intact on screen
      console.error('[App] Network or unexpected error during quote comparison:', err);
      setErrorMessage(AI_BUSY_MESSAGE);
      setIsIntakeOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const isPolicyGateActive =
    workbook?.recommendation.status === 'policy_gate_fewer_than_three';

  return (
    <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar: Strict 3-Zone Single-Row Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-8">
        <a
          href="#top"
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          QuoteLedger
        </a>

        <nav
          aria-label="RFQ Output Sections"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <a
            href="#recommendation"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-opacity whitespace-nowrap shrink-0"
          >
            Recommendation
          </a>
          <a
            href="#whole-rfq"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-opacity whitespace-nowrap shrink-0"
          >
            Whole-RFQ
          </a>
          <a
            href="#split-award"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-opacity whitespace-nowrap shrink-0"
          >
            Split Award
          </a>
          <a
            href="#technical"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-opacity whitespace-nowrap shrink-0"
          >
            Technical
          </a>
          <a
            href="#flags"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-opacity whitespace-nowrap shrink-0"
          >
            Flags
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleResetSession}
            className="min-h-10 sm:min-h-9 px-3.5 sm:px-4 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition-opacity whitespace-nowrap shrink-0"
          >
            New RFQ Session
          </button>
        </div>
      </header>

      {/* Main Single-Screen Workspace */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 sm:space-y-8">
        {/* Page Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 text-balance">
              RFQ Supplier Quote Comparison &amp; Award Workbench
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
              Compare supplier quotes in CAD using live Bank of Canada exchange rates, calculate maximum excluded freight breakevens, flag substitutes for SME review, and verify competitive-bidding readiness on one screen.
            </p>
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums shrink-0">
            Session Date: {workbook?.sessionDate ?? getLocalSessionDate()}
          </div>
        </div>

        {/* Collapsible Quote Intake Panel */}
        <QuoteIntakePanel
          isOpen={isIntakeOpen}
          onToggleOpen={() => setIsIntakeOpen((prev) => !prev)}
          onEnsureOpen={() => setIsIntakeOpen(true)}
          pdfs={pdfs}
          onAddPdfs={handleAddPdfs}
          onRemovePdf={handleRemovePdf}
          pastedQuotes={pastedQuotes}
          onAddPastedSlot={handleAddPastedSlot}
          onUpdatePastedSlot={handleUpdatePastedSlot}
          onRemovePastedSlot={handleRemovePastedSlot}
          buyerRequest={buyerRequest}
          onChangeBuyerRequest={setBuyerRequest}
          onLoadSampleQuotes={handleLoadSampleQuotes}
          isSampleDataActive={isSampleDataActive}
          hasAnyCurrentInputs={hasAnyCurrentInputs}
          onSubmit={() => void handleCompareQuotes()}
          isLoading={isLoading}
          hasResults={Boolean(workbook)}
          parsedQuoteCount={workbook ? workbook.quoteCount : null}
          errorMessage={errorMessage}
          onClearError={() => setErrorMessage(null)}
        />

        {/* Mobile Non-Sticky Section Jump Strip (keeps mobile sticky header <= 15% viewport) */}
        {workbook && !isLoading && (
          <nav
            aria-label="Mobile section navigation"
            className="md:hidden flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 text-xs font-medium text-slate-700"
          >
            <a
              href="#recommendation"
              className="min-h-10 inline-flex items-center px-2.5 whitespace-nowrap shrink-0 hover:text-slate-900"
            >
              01. Recommendation
            </a>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <a
              href="#whole-rfq"
              className="min-h-10 inline-flex items-center px-2.5 whitespace-nowrap shrink-0 hover:text-slate-900"
            >
              02. Whole-RFQ
            </a>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <a
              href="#split-award"
              className="min-h-10 inline-flex items-center px-2.5 whitespace-nowrap shrink-0 hover:text-slate-900"
            >
              03. Split Award
            </a>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <a
              href="#technical"
              className="min-h-10 inline-flex items-center px-2.5 whitespace-nowrap shrink-0 hover:text-slate-900"
            >
              04. Technical
            </a>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <a
              href="#flags"
              className="min-h-10 inline-flex items-center px-2.5 whitespace-nowrap shrink-0 hover:text-slate-900"
            >
              05. Flags ({workbook.flags.length})
            </a>
          </nav>
        )}

        {/* Loading Skeleton */}
        {isLoading && (
          <div
            aria-live="polite"
            aria-busy="true"
            className="space-y-6 animate-pulse"
          >
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
              <div className="h-4 w-48 bg-slate-200 rounded" />
              <div className="h-5 w-full max-w-2xl bg-slate-200 rounded" />
              <div className="h-4 w-3/4 bg-slate-100 rounded" />
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
              <div className="h-4 w-56 bg-slate-200 rounded mb-4" />
              <div className="h-9 w-full bg-slate-100 rounded" />
              <div className="h-9 w-full bg-slate-50 rounded" />
              <div className="h-9 w-full bg-slate-100 rounded" />
            </div>
          </div>
        )}

        {/* Empty State (Before First Session Comparison) */}
        {!workbook && !isLoading && (
          <section className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8">
            <div className="max-w-3xl space-y-4">
              <h2 className="font-display text-base sm:text-lg font-semibold text-slate-900">
                Ready to Evaluate Current Session Quotes
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Upload supplier quote PDFs or paste vendor quote text above, then select{' '}
                <span className="font-semibold text-slate-900">Compare Quotes</span>. QuoteLedger evaluates only the quotes provided in this session and generates all five procurement sections on this screen:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 pt-2 text-xs text-slate-700 border-t border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900">01. Recommendation</span>
                  <p className="text-slate-500 mt-0.5">
                    PO award, CAD savings, freight breakeven cap, fallback vendor, and 3-quote policy check.
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-900">02. Whole-RFQ Table</span>
                  <p className="text-slate-500 mt-0.5">
                    Goods, freight, handling, certifications, delivered CAD cost, lead time, terms, expiry, and rank.
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-900">03. Split-Award Table</span>
                  <p className="text-slate-500 mt-0.5">
                    Lowest-cost supplier per line across all vendors with order-level charges and MOQs.
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-900">04. Technical Table</span>
                  <p className="text-slate-500 mt-0.5">
                    Matched by CC#, manufacturer, and MPN; flags substitutes and specs for SME review.
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-900">05. Clarification Flags</span>
                  <p className="text-slate-500 mt-0.5">
                    Missing values, supplier estimates, expired quotes, UOM/pack differences, and ignored embedded instructions.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Populated 5-Section Single-Screen Output */}
        {workbook && !isLoading && (
          <div className="space-y-8">
            {/* 01. Award Recommendation / <3 Quotes Gate — Always at very top of results, above FX bar and all tables */}
            <RecommendationSection
              recommendation={workbook.recommendation}
              soleSourceDecision={soleSourceDecision}
              onConfirmSoleSource={() =>
                setSoleSourceDecision(SoleSourceDecision.CONFIRMED_SOLE_SOURCE)
              }
              onAwaitMoreQuotes={() => {
                setSoleSourceDecision(SoleSourceDecision.AWAITING_MORE_QUOTES);
                setIsIntakeOpen(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />

            {/* Inline Foreign Currency Bar & Buyer Override */}
            <FxRateBar
              foreignCurrencies={workbook.foreignCurrencies}
              onSetOverride={handleSetFxOverride}
            />

            {/* 02. Whole-RFQ Comparison Table */}
            <WholeRfqTable
              rows={workbook.wholeRfqRows}
              isPolicyGateActive={Boolean(isPolicyGateActive)}
            />

            {/* 03. Split-Award Comparison Table */}
            <SplitAwardTable
              splitLines={workbook.splitLines}
              supplierSummaries={workbook.splitSupplierSummaries}
              splitTotalDeliveredCad={workbook.splitTotalDeliveredCad}
              splitSavingsVsBestWholeCad={workbook.splitSavingsVsBestWholeCad}
              isPolicyGateActive={Boolean(isPolicyGateActive)}
            />

            {/* 04. Technical Comparison Table (SME Review) */}
            <TechnicalTable
              canonicalLines={analysisResponse?.canonicalLines ?? []}
              rows={workbook.wholeRfqRows}
            />

            {/* 05. Clarification & Compliance Flags */}
            <FlagsSection flags={workbook.flags} />
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 sm:px-6 lg:px-8 py-4 mt-8">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            QuoteLedger · Session-only synthetic RFQ quote comparison · Foreign exchange rates sourced in code via Bank of Canada
          </span>
          <span>No external account connections or outbound transmissions</span>
        </div>
      </footer>
    </div>
  );
}
