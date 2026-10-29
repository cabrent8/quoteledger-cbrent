import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  EvaluatedSplitLine,
  SplitAwardSupplierOrderSummary,
} from '../types/rfq';
import { formatMoney, NOT_STATED_CLARIFY } from '../lib/procurementEngine';
import { formatTsv } from '../lib/clipboard';
import { CopyActionButton } from './CopyActionButton';

interface SplitAwardTableProps {
  splitLines: EvaluatedSplitLine[];
  supplierSummaries: SplitAwardSupplierOrderSummary[];
  splitTotalDeliveredCad: number | null;
  splitSavingsVsBestWholeCad: number | null;
  isPolicyGateActive: boolean;
}

export function buildSplitAwardTsv(
  splitLines: EvaluatedSplitLine[],
  supplierSummaries: SplitAwardSupplierOrderSummary[],
  splitTotalDeliveredCad: number | null,
  splitSavingsVsBestWholeCad: number | null,
  isPolicyGateActive: boolean
): string {
  const lineHeaders = [
    'RFQ Line Item',
    'Baseline Qty',
    ...supplierSummaries.map((s) => s.supplierName),
    'Lowest-Cost Line Supplier',
  ];

  const lineRows = splitLines.map((sl) => {
    const cl = sl.canonicalLine;
    const itemLabel = `Line ${cl.lineIndex}: ${cl.description} (CC#: ${
      cl.ccNumber || 'Not stated'
    } · MPN: ${cl.requestedPartNumber || 'Not stated'})`;
    const qtyLabel =
      cl.requestedQuantity !== null
        ? `${cl.requestedQuantity} ${cl.requestedUom || ''}`.trim()
        : 'Not stated';

    const supplierCols = sl.supplierCells.map((cell) => {
      if (!cell.quotedLine) return NOT_STATED_CLARIFY;
      const fxMissing =
        cell.currency !== 'CAD' && cell.fx.effectiveRate === null;
      const cadPart =
        fxMissing || cell.extendedCad === null
          ? 'Not stated'
          : formatMoney(cell.extendedCad, 'CAD');
      const origPart =
        cell.currency !== 'CAD' && cell.extendedOriginal !== null
          ? ` (Orig: ${formatMoney(cell.extendedOriginal, cell.currency)})`
          : '';
      const moqPart = cell.quotedLine.lineMoq
        ? ` · MOQ: ${cell.quotedLine.lineMoq}`
        : '';
      const provPart =
        cell.provisionalNotes.length > 0
          ? ` · ${cell.provisionalNotes.join(' · ')}`
          : '';
      return `${cadPart}${origPart}${moqPart}${provPart}`;
    });

    const lowestCell = isPolicyGateActive
      ? 'Withheld (<3 quotes)'
      : sl.lowestSupplierName && sl.lowestExtendedCad !== null
        ? `${sl.lowestSupplierName} (${formatMoney(
            sl.lowestExtendedCad,
            'CAD'
          )}) · ${
            sl.isLineProvisional
              ? sl.lineStatusNote || 'Provisional'
              : 'Firm lowest line cost'
          }`
        : NOT_STATED_CLARIFY;

    return [itemLabel, qtyLabel, ...supplierCols, lowestCell];
  });

  const orderHeaders = [
    'Supplier',
    'Lowest-Cost Lines',
    'Allocated Goods (CAD)',
    'Order MOQ / Minimum',
    'Order-Level Charges',
    'Allocated Delivered (CAD)',
  ];

  const orderRows = supplierSummaries.map((sup) => [
    sup.supplierName,
    isPolicyGateActive ? '—' : sup.wonLineCount,
    isPolicyGateActive
      ? '—'
      : sup.wonGoodsCad !== null
        ? formatMoney(sup.wonGoodsCad, 'CAD')
        : 'Not stated',
    `${sup.orderMoqLabel}${
      !isPolicyGateActive && sup.moqMet === false && sup.moqShortfallNote
        ? ` (${sup.moqShortfallNote})`
        : ''
    }`,
    sup.orderChargesNote,
    isPolicyGateActive
      ? '—'
      : sup.wonLineCount === 0
        ? 'CAD 0.00'
        : sup.totalAllocatedDeliveredCad !== null
          ? formatMoney(sup.totalAllocatedDeliveredCad, 'CAD')
          : NOT_STATED_CLARIFY,
  ]);

  const summaryRow: Array<string | number> = [];
  if (!isPolicyGateActive) {
    const totalStr =
      splitTotalDeliveredCad !== null
        ? formatMoney(splitTotalDeliveredCad, 'CAD')
        : 'Provisional / Incomplete (unstated order charges or MOQ shortfall)';
    const savingsStr =
      splitSavingsVsBestWholeCad !== null
        ? splitSavingsVsBestWholeCad > 0
          ? `Saves ${formatMoney(splitSavingsVsBestWholeCad, 'CAD')} vs. best complete single-supplier bid`
          : splitSavingsVsBestWholeCad < 0
            ? `Costs ${formatMoney(Math.abs(splitSavingsVsBestWholeCad), 'CAD')} more than single-supplier award due to order-level charges`
            : 'Matches best single-supplier delivered total'
        : '';
    summaryRow.push(
      'Split-Award Delivered Total',
      totalStr,
      savingsStr
    );
  }

  return formatTsv([
    lineHeaders,
    ...lineRows,
    [],
    ...(summaryRow.length > 0 ? [summaryRow] : []),
    orderHeaders,
    ...orderRows,
  ]);
}

export const SplitAwardTable: React.FC<SplitAwardTableProps> = ({
  splitLines,
  supplierSummaries,
  splitTotalDeliveredCad,
  splitSavingsVsBestWholeCad,
  isPolicyGateActive,
}) => {
  return (
    <section
      id="split-award"
      aria-labelledby="heading-split-award"
      className="scroll-mt-20 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="heading-split-award"
            className="font-display text-base sm:text-lg font-bold text-slate-900"
          >
            03. Split-Award Comparison (Line-by-Line &amp; Order MOQs)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Lowest-cost supplier per line across all bidders, plus order-level charges and minimum order checks
          </p>
        </div>

        <CopyActionButton
          label="Copy table"
          getText={() =>
            buildSplitAwardTsv(
              splitLines,
              supplierSummaries,
              splitTotalDeliveredCad,
              splitSavingsVsBestWholeCad,
              isPolicyGateActive
            )
          }
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-200">
        {/* Part A: Line-by-Line Matrix across ALL suppliers */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-xs font-semibold text-slate-700">
                <th className="py-3 px-3.5 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 whitespace-nowrap">
                  RFQ Line Item
                </th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">
                  Baseline Qty
                </th>
                {supplierSummaries.map((sup) => (
                  <th
                    key={sup.quoteId}
                    className="py-3 px-3.5 text-right whitespace-nowrap"
                  >
                    {sup.supplierName}
                  </th>
                ))}
                <th className="py-3 px-3.5 whitespace-nowrap">
                  Lowest-Cost Line Supplier
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {splitLines.map((sl) => {
                const cl = sl.canonicalLine;
                return (
                  <tr
                    key={cl.canonicalLineId}
                    className="align-top hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-3.5 sticky left-0 bg-white z-10 border-r border-slate-200 min-w-[220px]">
                      <div className="font-semibold text-slate-900">
                        Line {cl.lineIndex}: {cl.description}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                        <span>CC#: {cl.ccNumber || 'Not stated'}</span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span>MPN: {cl.requestedPartNumber || 'Not stated'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-800">
                      {cl.requestedQuantity !== null
                        ? `${cl.requestedQuantity} ${cl.requestedUom || ''}`.trim()
                        : 'Not stated'}
                    </td>

                    {sl.supplierCells.map((cell) => {
                      const isWinner =
                        !isPolicyGateActive &&
                        sl.lowestSupplierQuoteId === cell.quoteId;
                      const fxMissing =
                        cell.currency !== 'CAD' && cell.fx.effectiveRate === null;

                      return (
                        <td
                          key={cell.quoteId}
                          className={`py-3 px-3.5 text-right ${
                            isWinner ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          {!cell.quotedLine ? (
                            <span className="text-xs text-amber-800 font-medium">
                              {NOT_STATED_CLARIFY}
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="font-mono tabular-nums font-semibold text-slate-900">
                                {fxMissing || cell.extendedCad === null
                                  ? 'Not stated'
                                  : formatMoney(cell.extendedCad, 'CAD')}
                              </div>
                              {cell.currency !== 'CAD' &&
                                cell.extendedOriginal !== null && (
                                  <div className="font-mono tabular-nums text-[11px] text-slate-500">
                                    Orig:{' '}
                                    {formatMoney(cell.extendedOriginal, cell.currency)}
                                  </div>
                                )}
                              {cell.quotedLine.lineMoq && (
                                <div className="text-[11px] text-slate-600">
                                  MOQ: {cell.quotedLine.lineMoq}
                                </div>
                              )}
                              {cell.provisionalNotes.length > 0 && (
                                <div className="text-[11px] text-amber-800">
                                  {cell.provisionalNotes.join(' · ')}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td className="py-3 px-3.5 min-w-[200px]">
                      {isPolicyGateActive ? (
                        <span className="text-xs text-slate-500 font-medium">
                          Withheld (&lt;3 quotes)
                        </span>
                      ) : sl.lowestSupplierName && sl.lowestExtendedCad !== null ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900">
                            {sl.lowestSupplierName}{' '}
                            <span className="font-mono tabular-nums font-normal text-slate-700">
                              ({formatMoney(sl.lowestExtendedCad, 'CAD')})
                            </span>
                          </div>
                          {sl.isLineProvisional ? (
                            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{sl.lineStatusNote}</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 text-[11px] text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>Firm lowest line cost</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-red-700 font-medium">
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

        {/* Part B: Supplier Order-Level Charges & MOQ Impact */}
        <div className="p-4 sm:p-5 bg-slate-50/50 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900">
              Supplier Order-Level Charges, Minimum Order Quantities (MOQs) &amp; Net Split Cost
            </h3>
            {!isPolicyGateActive && (
              <div className="text-xs text-slate-700">
                <span>Split-Award Delivered Total: </span>
                {splitTotalDeliveredCad !== null ? (
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    {formatMoney(splitTotalDeliveredCad, 'CAD')}
                  </span>
                ) : (
                  <span className="font-semibold text-amber-800">
                    Provisional / Incomplete (unstated order charges or MOQ shortfall)
                  </span>
                )}
                {splitSavingsVsBestWholeCad !== null && (
                  <>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {splitSavingsVsBestWholeCad > 0
                        ? `Saves ${formatMoney(splitSavingsVsBestWholeCad, 'CAD')} vs. best complete single-supplier bid`
                        : splitSavingsVsBestWholeCad < 0
                          ? `Costs ${formatMoney(Math.abs(splitSavingsVsBestWholeCad), 'CAD')} more than single-supplier award due to order-level charges`
                          : 'Matches best single-supplier delivered total'}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-md bg-white">
            <table className="w-full min-w-[760px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-700">
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3 text-right">Lowest-Cost Lines</th>
                  <th className="py-2.5 px-3 text-right">Allocated Goods (CAD)</th>
                  <th className="py-2.5 px-3">Order MOQ / Minimum</th>
                  <th className="py-2.5 px-3">Order-Level Charges</th>
                  <th className="py-2.5 px-3 text-right">Allocated Delivered (CAD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {supplierSummaries.map((sup) => (
                  <tr key={sup.quoteId} className="align-top">
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {sup.supplierName}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                      {isPolicyGateActive ? '—' : sup.wonLineCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                      {isPolicyGateActive
                        ? '—'
                        : sup.wonGoodsCad !== null
                          ? formatMoney(sup.wonGoodsCad, 'CAD')
                          : 'Not stated'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-800">{sup.orderMoqLabel}</div>
                      {!isPolicyGateActive && sup.moqMet === false && sup.moqShortfallNote && (
                        <div className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 mt-0.5">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{sup.moqShortfallNote}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{sup.orderChargesNote}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {isPolicyGateActive ? (
                        '—'
                      ) : sup.wonLineCount === 0 ? (
                        'CAD 0.00'
                      ) : sup.totalAllocatedDeliveredCad !== null ? (
                        formatMoney(sup.totalAllocatedDeliveredCad, 'CAD')
                      ) : (
                        <span className="font-sans text-amber-800 font-medium">
                          {NOT_STATED_CLARIFY}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
