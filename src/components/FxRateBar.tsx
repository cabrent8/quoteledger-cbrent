import React, { useEffect, useState } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { EffectiveFxInfo } from '../types/rfq';

interface FxRateBarProps {
  foreignCurrencies: EffectiveFxInfo[];
  onSetOverride: (currency: string, rate: number | null) => void;
}

const CurrencyOverrideRow: React.FC<{
  fx: EffectiveFxInfo;
  onSetOverride: (currency: string, rate: number | null) => void;
}> = ({ fx, onSetOverride }) => {
  const [draftValue, setDraftValue] = useState<string>(
    fx.overrideRate !== null ? String(fx.overrideRate) : ''
  );
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraftValue(fx.overrideRate !== null ? String(fx.overrideRate) : '');
  }, [fx.overrideRate]);

  const applyDraft = () => {
    const trimmed = draftValue.trim();
    if (!trimmed) {
      setValidationMsg(null);
      onSetOverride(fx.currency, null);
      return;
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) {
      setValidationMsg('Enter a valid exchange rate greater than zero.');
      return;
    }
    setValidationMsg(null);
    onSetOverride(fx.currency, num);
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="space-y-1 min-w-0 flex-1">
        {fx.bocRate !== null ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
            <span className="font-mono font-semibold text-slate-900">
              1 {fx.currency} → CAD
            </span>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span className="text-slate-700">
              Bank of Canada rate:{' '}
              <span className="font-mono tabular-nums font-medium text-slate-900">
                {fx.bocRate.toFixed(4)}
              </span>{' '}
              <span className="text-slate-500">
                (Date: <span className="font-mono tabular-nums">{fx.observationDate}</span>)
              </span>
            </span>
          </div>
        ) : fx.overrideRate === null ? (
          <div
            role="alert"
            className="flex items-start gap-2 text-xs sm:text-sm text-red-800 font-medium"
          >
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
            <span>
              The Bank of Canada rate for {fx.currency} couldn’t be retrieved. Conversions are marked ‘Not stated’—enter an override rate to continue.
            </span>
          </div>
        ) : (
          <div className="text-xs sm:text-sm text-slate-700">
            Bank of Canada rate for {fx.currency} was unavailable — using buyer override rate below.
          </div>
        )}

        {(fx.bocRate !== null || fx.overrideRate !== null) && (
          <div className="text-xs text-slate-600">
            <span>Active Conversion Rate: </span>
            {fx.source === 'OVERRIDE' && fx.effectiveRate !== null ? (
              <span className="font-mono tabular-nums font-semibold text-amber-800">
                1 {fx.currency} = {fx.effectiveRate.toFixed(4)} CAD (Buyer Override)
              </span>
            ) : fx.source === 'BOC' && fx.effectiveRate !== null ? (
              <span className="font-mono tabular-nums font-medium text-emerald-800">
                1 {fx.currency} = {fx.effectiveRate.toFixed(4)} CAD (Bank of Canada · {fx.observationDate})
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Buyer Override Controls */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <label
          htmlFor={`fx-override-${fx.currency}`}
          className="text-xs font-medium text-slate-600 whitespace-nowrap"
        >
          Override ({fx.currency}/CAD):
        </label>
        <input
          id={`fx-override-${fx.currency}`}
          type="number"
          step="0.0001"
          min="0.0001"
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyDraft();
            }
          }}
          placeholder={fx.bocRate !== null ? fx.bocRate.toFixed(4) : 'e.g. 1.3850'}
          className="w-28 min-h-11 sm:min-h-8 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono tabular-nums text-slate-900 focus:border-slate-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={applyDraft}
          className="min-h-11 sm:min-h-8 px-3 py-1 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0"
        >
          Apply Rate
        </button>
        {fx.overrideRate !== null && (
          <button
            type="button"
            onClick={() => {
              setDraftValue('');
              setValidationMsg(null);
              onSetOverride(fx.currency, null);
            }}
            className="inline-flex items-center gap-1 min-h-11 sm:min-h-8 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
        {validationMsg && (
          <span className="text-xs text-red-700 w-full sm:w-auto">{validationMsg}</span>
        )}
      </div>
    </div>
  );
};

export const FxRateBar: React.FC<FxRateBarProps> = ({
  foreignCurrencies,
  onSetOverride,
}) => {
  if (foreignCurrencies.length === 0) return null;

  return (
    <section
      aria-label="Foreign Currency Exchange Rates"
      className="bg-white border border-slate-200 rounded-lg px-4 sm:px-6 py-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
        <h2 className="font-display text-sm font-semibold text-slate-900">
          Foreign Currency Exchange Rates (Bank of Canada)
        </h2>
        <span className="text-xs text-slate-500">
          Override any rate to recalculate all CAD prices live
        </span>
      </div>

      <div className="divide-y divide-slate-200">
        {foreignCurrencies.map((fx) => (
          <CurrencyOverrideRow
            key={fx.currency}
            fx={fx}
            onSetOverride={onSetOverride}
          />
        ))}
      </div>
    </section>
  );
};
