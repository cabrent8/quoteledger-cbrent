import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  ChargeStatus,
  EvaluatedCharge,
  EvaluatedSupplierWholeRfq,
} from '../types/rfq';
import {
  ESTIMATE_CONFIRM,
  formatMoney,
  NOT_STATED_CLARIFY,
} from '../lib/procurementEngine';
import { formatTsv } from '../lib/clipboard';
import { CopyActionButton } from './CopyActionButton';

interface WholeRfqTableProps {
  rows: EvaluatedSupplierWholeRfq[];
  isPolicyGateActive: boolean;
}

function formatChargeTsv(
  evalCharge: EvaluatedCharge,
  currency: string,
  fxMissing: boolean,
  breakevenCad?: number | null
): string {
  let base: string;
  if (evalCharge.status === ChargeStatus.INCLUDED) {
    base = 'CAD 0.00 (Included)';
  } else if (
    evalCharge.status === ChargeStatus.STATED_AMOUNT ||
    evalCharge.status === ChargeStatus.ESTIMATED_AMOUNT
  ) {
    const cadPart =
      fxMissing || evalCharge.cadAmount === null
        ? 'Not stated'
        : formatMoney(evalCharge.cadAmount, 'CAD');
    const origPart =
      currency !== 'CAD' && evalCharge.originalAmount !== null
        ? ` (Orig: ${formatMoney(evalCharge.originalAmount, currency)})`
        : '';
    const estPart = evalCharge.isEstimated ? ` · ${ESTIMATE_CONFIRM}` : '';
    base = `${cadPart}${origPart}${estPart}`;
  } else {
    base = NOT_STATED_CLARIFY;
  }

  if (evalCharge.isUnstatedGap && breakevenCad !== null && breakevenCad !== undefined) {
    base += ` (Max freight breakeven: ${formatMoney(breakevenCad, 'CAD')})`;
  }
  return base;
}

export function buildWholeRfqTsv(
  rows: EvaluatedSupplierWholeRfq[],
  isPolicyGateActive: boolean
): string {
  const headers = [
    'Rank',
    'Supplier & Quote Ref',
    'Goods (CAD)',
    'Freight (CAD)',
    'Handling (CAD)',
    'Certifications (CAD)',
    'Delivered Pre-Tax (CAD)',
    'Lead Time',
    'Payment Terms',
    'Expiry Date',
  ];

  const dataRows = rows.map((row) => {
    const ccy = row.fx.currency;
    const fxMissing = ccy !== 'CAD' && row.fx.effectiveRate === null;

    const rankCell = isPolicyGateActive
      ? 'Withheld (<3 quotes)'
      : row.rank === null
        ? 'Unranked'
        : row.isProvisional
          ? `#${row.rank} · Provisional (${row.provisionalReasons.join(' · ')})`
          : `#${row.rank} · Firm`;

    const quoteRef = row.quote.quoteNumber?.trim() || NOT_STATED_CLARIFY;
    const fxSuffix =
      ccy !== 'CAD'
        ? row.fx.effectiveRate !== null
          ? ` [${ccy} @ ${row.fx.effectiveRate.toFixed(4)} CAD (${
              row.fx.source === 'OVERRIDE'
                ? 'Buyer override'
                : `BoC ${row.fx.observationDate}`
            })]`
          : ` [${ccy} → CAD rate: Not stated]`
        : '';
    const supplierCell = `${row.supplierDisplayName} (Quote #: ${quoteRef})${fxSuffix}`;

    const goodsCell =
      row.goodsOriginal === null
        ? NOT_STATED_CLARIFY
        : `${
            fxMissing || row.goodsCad === null
              ? 'Not stated'
              : formatMoney(row.goodsCad, 'CAD')
          }${
            ccy !== 'CAD'
              ? ` (Orig: ${formatMoney(row.goodsOriginal, ccy)})`
              : ''
          }${row.hasMissingAllLines ? ' · Partial line coverage' : ''}`;

    const freightCell = formatChargeTsv(
      row.freightEval,
      ccy,
      fxMissing,
      row.maxExcludedFreightCad
    );
    const handlingCell = formatChargeTsv(row.handlingEval, ccy, fxMissing);
    const certsCell = formatChargeTsv(row.certificationsEval, ccy, fxMissing);

    let deliveredCell: string;
    if (fxMissing) {
      deliveredCell = `Not stated${
        row.knownSubtotalOriginal !== null
          ? ` (Orig: ${formatMoney(row.knownSubtotalOriginal, ccy)})`
          : ''
      }`;
    } else if (row.deliveredPreTaxCad !== null) {
      deliveredCell = `${formatMoney(row.deliveredPreTaxCad, 'CAD')}${
        ccy !== 'CAD' && row.deliveredPreTaxOriginal !== null
          ? ` (Orig: ${formatMoney(row.deliveredPreTaxOriginal, ccy)})`
          : ''
      }${
        row.freightEval.isEstimated ||
        row.handlingEval.isEstimated ||
        row.certificationsEval.isEstimated
          ? ' · Includes estimated charge'
          : ''
      }`;
    } else if (row.knownSubtotalCad !== null) {
      deliveredCell = `${formatMoney(row.knownSubtotalCad, 'CAD')}*${
        ccy !== 'CAD' && row.knownSubtotalOriginal !== null
          ? ` (Orig: ${formatMoney(row.knownSubtotalOriginal, ccy)}*)`
          : ''
      } · *Quoted subtotal (${NOT_STATED_CLARIFY} on excluded charges)`;
    } else {
      deliveredCell = NOT_STATED_CLARIFY;
    }

    const leadTimeCell = row.quote.leadTimeText?.trim() || NOT_STATED_CLARIFY;
    const paymentCell = row.quote.paymentTermsText?.trim() || NOT_STATED_CLARIFY;
    const expiryCell = row.quote.expiryDate?.trim()
      ? `${row.quote.expiryDate}${row.isExpired ? ' (Expired quote)' : ''}`
      : NOT_STATED_CLARIFY;

    return [
      rankCell,
      supplierCell,
      goodsCell,
      freightCell,
      handlingCell,
      certsCell,
      deliveredCell,
      leadTimeCell,
      paymentCell,
      expiryCell,
    ];
  });

  return formatTsv([headers, ...dataRows]);
}

const ChargeCellContent: React.FC<{
  evalCharge: EvaluatedCharge;
  currency: string;
  fxMissing: boolean;
}> = ({ evalCharge, currency, fxMissing }) => {
  if (evalCharge.status === ChargeStatus.INCLUDED) {
    return (
      <div className="space-y-0.5">
        <div className="font-mono tabular-nums text-slate-900">CAD 0.00</div>
        <div className="text-[11px] text-slate-500">Included</div>
      </div>
    );
  }

  if (
    evalCharge.status === ChargeStatus.STATED_AMOUNT ||
    evalCharge.status === ChargeStatus.ESTIMATED_AMOUNT
  ) {
    return (
      <div className="space-y-0.5">
        <div className="font-mono tabular-nums text-slate-900">
          {fxMissing || evalCharge.cadAmount === null
            ? 'Not stated'
            : formatMoney(evalCharge.cadAmount, 'CAD')}
        </div>
        {currency !== 'CAD' && evalCharge.originalAmount !== null && (
          <div className="font-mono tabular-nums text-[11px] text-slate-500">
            Orig: {formatMoney(evalCharge.originalAmount, currency)}
          </div>
        )}
        {evalCharge.isEstimated && (
          <div className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>{ESTIMATE_CONFIRM}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="text-xs text-amber-800 font-medium leading-snug">
      {NOT_STATED_CLARIFY}
    </div>
  );
};

export const WholeRfqTable: React.FC<WholeRfqTableProps> = ({
  rows,
  isPolicyGateActive,
}) => {
  return (
    <section
      id="whole-rfq"
      aria-labelledby="heading-whole-rfq"
      className="scroll-mt-20 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="heading-whole-rfq"
            className="font-display text-base sm:text-lg font-bold text-slate-900"
          >
            02. Whole-RFQ Comparison Table
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranked by Delivered Pre-Tax Cost (CAD) · Lead Time · Payment Terms
          </p>
        </div>

        <CopyActionButton
          label="Copy table"
          getText={() => buildWholeRfqTsv(rows, isPolicyGateActive)}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-xs font-semibold text-slate-700">
                <th className="py-3 px-3.5 whitespace-nowrap">Rank</th>
                <th className="py-3 px-3.5 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 whitespace-nowrap">
                  Supplier &amp; Quote Ref
                </th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Goods (CAD)</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Freight (CAD)</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Handling (CAD)</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">
                  Certifications (CAD)
                </th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">
                  Delivered Pre-Tax (CAD)
                </th>
                <th className="py-3 px-3.5 whitespace-nowrap">Lead Time</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Payment Terms</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Expiry Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => {
                const ccy = row.fx.currency;
                const fxMissing = ccy !== 'CAD' && row.fx.effectiveRate === null;
                const isTopRank = !isPolicyGateActive && row.rank === 1;

                return (
                  <tr
                    key={row.quote.quoteId}
                    className={`align-top transition-colors hover:bg-slate-50/80 ${
                      isTopRank ? 'bg-slate-50/50' : 'bg-white'
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {isPolicyGateActive ? (
                        <div className="text-xs font-medium text-slate-500">
                          Withheld (&lt;3 quotes)
                        </div>
                      ) : row.rank === null ? (
                        <div className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Unranked</span>
                        </div>
                      ) : row.isProvisional ? (
                        <div className="space-y-0.5">
                          <div className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>#{row.rank} · Provisional</span>
                          </div>
                          <div className="text-[11px] text-slate-600 max-w-[170px] whitespace-normal leading-tight">
                            {row.provisionalReasons.join(' · ')}
                          </div>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>#{row.rank} · Firm</span>
                        </div>
                      )}
                    </td>

                    {/* Supplier & Quote Ref */}
                    <td className="py-3 px-3.5 sticky left-0 bg-white z-10 border-r border-slate-200 min-w-[200px]">
                      <div className="font-semibold text-slate-900">
                        {row.supplierDisplayName}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        <span>Quote #: </span>
                        {row.quote.quoteNumber?.trim() ? (
                          <span className="font-mono tabular-nums text-slate-800">
                            {row.quote.quoteNumber}
                          </span>
                        ) : (
                          <span className="text-amber-800 font-medium">
                            {NOT_STATED_CLARIFY}
                          </span>
                        )}
                      </div>
                      {ccy !== 'CAD' && (
                        <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                          {row.fx.effectiveRate !== null ? (
                            <span>
                              {ccy} @ {row.fx.effectiveRate.toFixed(4)} CAD (
                              {row.fx.source === 'OVERRIDE'
                                ? 'Buyer override'
                                : `BoC ${row.fx.observationDate}`}
                              )
                            </span>
                          ) : (
                            <span className="text-red-700 font-sans font-medium">
                              {ccy} → CAD rate: Not stated
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Goods */}
                    <td className="py-3 px-3.5 text-right">
                      {row.goodsOriginal === null ? (
                        <span className="text-xs text-red-700 font-medium">
                          {NOT_STATED_CLARIFY}
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="font-mono tabular-nums font-medium text-slate-900">
                            {fxMissing || row.goodsCad === null
                              ? 'Not stated'
                              : formatMoney(row.goodsCad, 'CAD')}
                          </div>
                          {ccy !== 'CAD' && (
                            <div className="font-mono tabular-nums text-[11px] text-slate-500">
                              Orig: {formatMoney(row.goodsOriginal, ccy)}
                            </div>
                          )}
                          {row.hasMissingAllLines && (
                            <div className="text-[11px] text-red-700">
                              Partial line coverage
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Freight + Breakeven */}
                    <td className="py-3 px-3.5 text-right max-w-[230px]">
                      <ChargeCellContent
                        evalCharge={row.freightEval}
                        currency={ccy}
                        fxMissing={fxMissing}
                      />
                      {row.freightEval.isUnstatedGap &&
                        row.maxExcludedFreightCad !== null && (
                          <div className="mt-1 text-[11px] text-slate-700 font-mono tabular-nums">
                            Max freight breakeven:{' '}
                            <span className="font-semibold text-slate-900">
                              {formatMoney(row.maxExcludedFreightCad, 'CAD')}
                            </span>
                          </div>
                        )}
                    </td>

                    {/* Handling */}
                    <td className="py-3 px-3.5 text-right max-w-[190px]">
                      <ChargeCellContent
                        evalCharge={row.handlingEval}
                        currency={ccy}
                        fxMissing={fxMissing}
                      />
                    </td>

                    {/* Certifications */}
                    <td className="py-3 px-3.5 text-right max-w-[190px]">
                      <ChargeCellContent
                        evalCharge={row.certificationsEval}
                        currency={ccy}
                        fxMissing={fxMissing}
                      />
                    </td>

                    {/* Delivered Pre-Tax Cost (CAD) */}
                    <td className="py-3 px-3.5 text-right">
                      {fxMissing ? (
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-red-700">
                            Not stated
                          </div>
                          {row.knownSubtotalOriginal !== null && (
                            <div className="font-mono tabular-nums text-[11px] text-slate-500">
                              Orig: {formatMoney(row.knownSubtotalOriginal, ccy)}
                            </div>
                          )}
                        </div>
                      ) : row.deliveredPreTaxCad !== null ? (
                        <div className="space-y-0.5">
                          <div className="font-mono tabular-nums font-bold text-slate-900">
                            {formatMoney(row.deliveredPreTaxCad, 'CAD')}
                          </div>
                          {ccy !== 'CAD' && row.deliveredPreTaxOriginal !== null && (
                            <div className="font-mono tabular-nums text-[11px] text-slate-500">
                              Orig: {formatMoney(row.deliveredPreTaxOriginal, ccy)}
                            </div>
                          )}
                          {(row.freightEval.isEstimated ||
                            row.handlingEval.isEstimated ||
                            row.certificationsEval.isEstimated) && (
                            <div className="text-[11px] text-amber-800">
                              Includes estimated charge
                            </div>
                          )}
                        </div>
                      ) : row.knownSubtotalCad !== null ? (
                        <div className="space-y-0.5">
                          <div className="font-mono tabular-nums font-semibold text-amber-900">
                            {formatMoney(row.knownSubtotalCad, 'CAD')}*
                          </div>
                          {ccy !== 'CAD' && row.knownSubtotalOriginal !== null && (
                            <div className="font-mono tabular-nums text-[11px] text-slate-500">
                              Orig: {formatMoney(row.knownSubtotalOriginal, ccy)}*
                            </div>
                          )}
                          <div className="text-[11px] text-amber-800">
                            *Quoted subtotal ({NOT_STATED_CLARIFY} on excluded charges)
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-red-700 font-medium">
                          {NOT_STATED_CLARIFY}
                        </span>
                      )}
                    </td>

                    {/* Lead Time */}
                    <td className="py-3 px-3.5">
                      {row.quote.leadTimeText?.trim() ? (
                        <span className="text-slate-800">{row.quote.leadTimeText}</span>
                      ) : (
                        <span className="text-xs text-amber-800 font-medium">
                          {NOT_STATED_CLARIFY}
                        </span>
                      )}
                    </td>

                    {/* Payment Terms */}
                    <td className="py-3 px-3.5">
                      {row.quote.paymentTermsText?.trim() ? (
                        <span className="text-slate-800">
                          {row.quote.paymentTermsText}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-800 font-medium">
                          {NOT_STATED_CLARIFY}
                        </span>
                      )}
                    </td>

                    {/* Expiry Date */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {row.quote.expiryDate?.trim() ? (
                        <div className="space-y-0.5">
                          <div
                            className={`font-mono tabular-nums ${
                              row.isExpired
                                ? 'font-semibold text-red-700'
                                : 'text-slate-800'
                            }`}
                          >
                            {row.quote.expiryDate}
                          </div>
                          {row.isExpired && (
                            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>Expired quote</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-800 font-medium whitespace-normal">
                          {NOT_STATED_CLARIFY}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
