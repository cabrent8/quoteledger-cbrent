import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { RecommendationResult, SoleSourceDecision } from '../types/rfq';
import { CopyActionButton } from './CopyActionButton';

interface RecommendationSectionProps {
  recommendation: RecommendationResult;
  soleSourceDecision: SoleSourceDecision;
  onConfirmSoleSource: () => void;
  onAwaitMoreQuotes: () => void;
}

export function formatRecommendationPlainText(
  recommendation: RecommendationResult
): string {
  if (recommendation.status === 'policy_gate_fewer_than_three') {
    return `Awaiting buyer answer—no award\n${recommendation.primaryText}`;
  }

  const lines: string[] = [recommendation.primaryText];

  if (recommendation.freightBreakevenCallout) {
    lines.push(
      `Freight Breakeven Basis: ${recommendation.freightBreakevenCallout}`
    );
  }

  if (recommendation.fallbackText) {
    lines.push(recommendation.fallbackText);
  }

  if (recommendation.conditions.length > 0) {
    lines.push('Conditions & Pre-PO Clarifications:');
    for (const cond of recommendation.conditions) {
      lines.push(`- ${cond}`);
    }
  }

  return lines.join('\n');
}

export const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  recommendation,
  soleSourceDecision,
  onConfirmSoleSource,
  onAwaitMoreQuotes,
}) => {
  const isPolicyGate = recommendation.status === 'policy_gate_fewer_than_three';
  const isBlocking = recommendation.status === 'clarification_blocking';

  if (isPolicyGate) {
    return (
      <section
        id="recommendation"
        aria-labelledby="heading-recommendation"
        className="scroll-mt-20 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="heading-recommendation"
              className="font-display text-base sm:text-lg font-bold text-slate-900"
            >
              01. Award Recommendation — Action Required
            </h2>
            <div className="text-xs font-medium text-red-800 mt-0.5">
              <span className="font-mono tabular-nums">
                {recommendation.quoteCount} of 3 minimum quotes provided
              </span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>No award recommended yet</span>
            </div>
          </div>

          <CopyActionButton
            label="Copy recommendation"
            getText={() => formatRecommendationPlainText(recommendation)}
          />
        </div>

        <div
          role="region"
          aria-label="Minimum Three Quotes Clarification"
          className="rounded-lg border border-red-300 bg-red-50/60 p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-start gap-3.5">
            <AlertCircle className="w-6 h-6 text-red-700 shrink-0 mt-0.5" />
            <div className="space-y-2 min-w-0 flex-1">
              <p className="font-display text-base sm:text-lg font-bold text-slate-950 leading-snug">
                {recommendation.primaryText}
              </p>
              {recommendation.conditions.map((cond, idx) => (
                <p key={idx} className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                  {cond}
                </p>
              ))}
              {recommendation.buyerRequestNote && (
                <p className="text-xs sm:text-sm text-slate-700">
                  {recommendation.buyerRequestNote}
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs sm:text-sm font-semibold text-slate-900">
              Select how to proceed:
            </span>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onAwaitMoreQuotes}
                className={`min-h-11 sm:min-h-10 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md border focus-visible:outline-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0 ${
                  soleSourceDecision === SoleSourceDecision.AWAITING_MORE_QUOTES
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50'
                }`}
              >
                More Quotes Are Coming (Add Quotes)
              </button>
              <button
                type="button"
                onClick={onConfirmSoleSource}
                className="min-h-11 sm:min-h-10 px-4 py-2 text-xs sm:text-sm font-semibold text-amber-950 bg-amber-100 border border-amber-400 rounded-md hover:bg-amber-200/80 focus-visible:outline-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0"
              >
                Confirm Sole-Source Purchase
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const containerStyle = isBlocking
    ? 'border-red-200 bg-red-50/40'
    : recommendation.isProvisionalAward
      ? 'border-amber-300 bg-amber-50/35'
      : 'border-emerald-200 bg-emerald-50/35';

  return (
    <section
      id="recommendation"
      aria-labelledby="heading-recommendation"
      className="scroll-mt-20 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="heading-recommendation"
            className="font-display text-base sm:text-lg font-bold text-slate-900"
          >
            01. Award Recommendation
          </h2>
          <div className="text-xs text-slate-600 mt-0.5">
            <span className="font-mono tabular-nums">
              {recommendation.quoteCount} {recommendation.quoteCount === 1 ? 'quote' : 'quotes'} in session
            </span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>
              {isBlocking
                ? 'Clarification required before award'
                : recommendation.isProvisionalAward
                  ? 'Conditional / Provisional recommendation'
                  : 'Firm award recommendation'}
            </span>
          </div>
        </div>

        <CopyActionButton
          label="Copy recommendation"
          getText={() => formatRecommendationPlainText(recommendation)}
        />
      </div>

      <div className={`rounded-lg border p-4 sm:p-6 space-y-4 ${containerStyle}`}>
        <div className="flex items-start gap-3">
          {isBlocking ? (
            <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          ) : recommendation.isProvisionalAward ? (
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          )}

          <div className="space-y-2 min-w-0 flex-1">
            <p className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
              {recommendation.primaryText}
            </p>

            {recommendation.freightBreakevenCallout && (
              <p className="text-xs sm:text-sm text-slate-800 pt-1">
                <span className="font-semibold">Freight Breakeven Basis: </span>
                <span>{recommendation.freightBreakevenCallout}</span>
              </p>
            )}

            {recommendation.fallbackText && (
              <p className="text-xs sm:text-sm text-slate-700">
                {recommendation.fallbackText}
              </p>
            )}

            {recommendation.buyerRequestNote && (
              <p className="text-xs text-slate-600 pt-1">
                {recommendation.buyerRequestNote}
              </p>
            )}
          </div>
        </div>

        {recommendation.conditions.length > 0 && (
          <div className="pt-3 border-t border-slate-200/80 space-y-1.5">
            <h3 className="text-xs font-semibold text-slate-800">
              Conditions &amp; Pre-PO Clarifications
            </h3>
            <ul className="space-y-1 text-xs sm:text-sm text-slate-700 list-disc pl-5">
              {recommendation.conditions.map((cond, idx) => (
                <li key={idx}>{cond}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};
