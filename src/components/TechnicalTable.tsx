import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  CanonicalRfqLine,
  EvaluatedSupplierWholeRfq,
} from '../types/rfq';
import {
  ESTIMATE_CONFIRM,
  formatMoney,
  getEffectiveCcNumber,
  getEffectiveLineSpecifications,
  NOT_STATED_CLARIFY,
  roundCents,
} from '../lib/procurementEngine';
import { formatTsv } from '../lib/clipboard';
import { CopyActionButton } from './CopyActionButton';

interface TechnicalTableProps {
  canonicalLines: CanonicalRfqLine[];
  rows: EvaluatedSupplierWholeRfq[];
}

const SPEC_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'with',
  'for',
  'of',
  'to',
  'in',
  'on',
  'at',
  'by',
  'per',
  'as',
]);

function normalizePunctuation(text: string): string {
  return text
    .replace(/[“”″]/g, '"')
    .replace(/[‘’′]/g, "'")
    .replace(/[–—]/g, '-');
}

function cleanComparableToken(raw: string): string {
  let t = normalizePunctuation(raw).toLowerCase();
  t = t.replace(/^[.,;:!?()[\]{}"']+/, '');
  t = t.replace(/[.,;:!?()[\]{}]+$/, '');
  if (!/\d["']$/.test(t)) {
    t = t.replace(/["']+$/, '');
  }
  return t;
}

function buildSpecTokenInfo(specText: string): {
  tokenSet: Set<string>;
  orderedTokens: Array<{ clean: string; raw: string }>;
  signature: string;
} {
  const segments = specText.split(/(\s+|[,;|()])/);
  const orderedTokens: Array<{ clean: string; raw: string }> = [];

  for (const seg of segments) {
    if (!seg || /^\s+$|^[,;|()]$/.test(seg)) continue;
    const clean = cleanComparableToken(seg);
    if (!clean || SPEC_STOP_WORDS.has(clean)) continue;
    orderedTokens.push({ clean, raw: seg });
  }

  const tokenSet = new Set<string>();
  const signatureTokens = new Set<string>();

  for (let i = 0; i < orderedTokens.length; i++) {
    const clean = orderedTokens[i].clean;
    tokenSet.add(clean);

    const numUnitMatch = clean.match(/^(\d+(?:\.\d+)?)([a-z]+)$/);
    if (numUnitMatch) {
      tokenSet.add(numUnitMatch[1]);
      tokenSet.add(numUnitMatch[2]);
      signatureTokens.add(numUnitMatch[1]);
      signatureTokens.add(numUnitMatch[2]);
    } else {
      signatureTokens.add(clean);
    }

    if (i + 1 < orderedTokens.length) {
      tokenSet.add(`${clean}${orderedTokens[i + 1].clean}`);
    }
  }

  const signature = Array.from(signatureTokens).sort().join(' ');
  return { tokenSet, orderedTokens, signature };
}

type HighlightStyle = 'none' | 'amber' | 'peer';

interface SpecRenderChunk {
  text: string;
  style: HighlightStyle;
}

interface SupplierSpecAnalysis {
  effectiveSpec: string | null;
  differsFromConsensus: boolean;
  chunks: SpecRenderChunk[];
  omittedSummary: string | null;
}

function analyzeLineSpecifications(
  cl: CanonicalRfqLine,
  rows: EvaluatedSupplierWholeRfq[]
): {
  lineSpecsDiffer: boolean;
  byQuoteId: Record<string, SupplierSpecAnalysis>;
} {
  const rawByQuote: Array<{
    quoteId: string;
    spec: string | null;
    info: ReturnType<typeof buildSpecTokenInfo> | null;
  }> = rows.map((row) => {
    const qLine =
      row.quote.lines.find((l) => l.canonicalLineId === cl.canonicalLineId) ??
      null;
    const spec = getEffectiveLineSpecifications(qLine);
    return {
      quoteId: row.quote.quoteId,
      spec,
      info: spec ? buildSpecTokenInfo(spec) : null,
    };
  });

  const stated = rawByQuote.filter(
    (entry): entry is {
      quoteId: string;
      spec: string;
      info: ReturnType<typeof buildSpecTokenInfo>;
    } => entry.spec !== null && entry.info !== null
  );

  const byQuoteId: Record<string, SupplierSpecAnalysis> = {};

  if (stated.length < 2) {
    for (const entry of rawByQuote) {
      byQuoteId[entry.quoteId] = {
        effectiveSpec: entry.spec,
        differsFromConsensus: false,
        chunks: entry.spec ? [{ text: entry.spec, style: 'none' }] : [],
        omittedSummary: null,
      };
    }
    return { lineSpecsDiffer: false, byQuoteId };
  }

  // Check if every significant token in every stated supplier's spec is present across all stated suppliers
  let anyDifference = false;
  for (const source of stated) {
    for (const tok of source.info.orderedTokens) {
      const presentEverywhere = stated.every((other) =>
        other.info.tokenSet.has(tok.clean)
      );
      if (!presentEverywhere) {
        anyDifference = true;
        break;
      }
    }
    if (anyDifference) break;
  }

  if (!anyDifference) {
    for (const entry of rawByQuote) {
      byQuoteId[entry.quoteId] = {
        effectiveSpec: entry.spec,
        differsFromConsensus: false,
        chunks: entry.spec ? [{ text: entry.spec, style: 'none' }] : [],
        omittedSummary: null,
      };
    }
    return { lineSpecsDiffer: false, byQuoteId };
  }

  // Determine whether a clear majority signature exists among stated supplier specs
  const sigCounts = new Map<string, number>();
  for (const s of stated) {
    sigCounts.set(s.info.signature, (sigCounts.get(s.info.signature) ?? 0) + 1);
  }
  const sortedSigs = Array.from(sigCounts.entries()).sort((a, b) => b[1] - a[1]);
  const hasMajorityConsensus =
    sortedSigs.length > 0 &&
    sortedSigs[0][1] >= 2 &&
    (sortedSigs.length === 1 || sortedSigs[0][1] > sortedSigs[1][1]);
  const consensusSignature = hasMajorityConsensus ? sortedSigs[0][0] : null;
  const consensusEntry = consensusSignature
    ? stated.find((s) => s.info.signature === consensusSignature) ?? null
    : null;

  for (const entry of rawByQuote) {
    if (!entry.spec || !entry.info) {
      byQuoteId[entry.quoteId] = {
        effectiveSpec: null,
        differsFromConsensus: false,
        chunks: [],
        omittedSummary: null,
      };
      continue;
    }

    const isConsensusMatch =
      consensusSignature !== null && entry.info.signature === consensusSignature;
    const differsFromConsensus = !isConsensusMatch;
    const tokenHighlightStyle: HighlightStyle = isConsensusMatch
      ? 'peer'
      : 'amber';

    const rawSegments = entry.spec.split(/(\s+|[,;|()])/);
    const classified: SpecRenderChunk[] = rawSegments
      .filter((seg) => seg.length > 0)
      .map((seg) => {
        if (/^\s+$|^[,;|()]$/.test(seg)) {
          return { text: seg, style: 'none' as HighlightStyle };
        }
        const clean = cleanComparableToken(seg);
        if (!clean || SPEC_STOP_WORDS.has(clean)) {
          return { text: seg, style: 'none' as HighlightStyle };
        }
        const inAllStated = stated.every((other) =>
          other.info.tokenSet.has(clean)
        );
        return {
          text: seg,
          style: inAllStated ? ('none' as HighlightStyle) : tokenHighlightStyle,
        };
      });

    // Join whitespace between adjacent identically highlighted words for clean continuous spans
    for (let i = 1; i < classified.length - 1; i++) {
      if (
        /^\s+$/.test(classified[i].text) &&
        classified[i - 1].style !== 'none' &&
        classified[i - 1].style === classified[i + 1].style
      ) {
        classified[i].style = classified[i - 1].style;
      }
    }

    const mergedChunks: SpecRenderChunk[] = [];
    for (const seg of classified) {
      const prev = mergedChunks[mergedChunks.length - 1];
      if (prev && prev.style === seg.style) {
        prev.text += seg.text;
      } else {
        mergedChunks.push({ ...seg });
      }
    }

    // Check if this supplier omitted terms present in the consensus/other quotes
    let omittedSummary: string | null = null;
    if (differsFromConsensus) {
      const referencePool = consensusEntry ? [consensusEntry] : stated;
      const missingRaws: string[] = [];
      const seenClean = new Set<string>();
      for (const ref of referencePool) {
        if (ref.quoteId === entry.quoteId) continue;
        for (const tok of ref.info.orderedTokens) {
          const sharedByAllOthers =
            consensusEntry !== null ||
            stated
              .filter((s) => s.quoteId !== entry.quoteId)
              .every((s) => s.info.tokenSet.has(tok.clean));
          if (
            sharedByAllOthers &&
            !entry.info.tokenSet.has(tok.clean) &&
            !seenClean.has(tok.clean)
          ) {
            seenClean.add(tok.clean);
            missingRaws.push(tok.raw.replace(/^[,;|()]+|[,;|()]+$/g, ''));
          }
        }
      }
      const hasOwnHighlightedTokens = mergedChunks.some(
        (c) => c.style === 'amber'
      );
      if (!hasOwnHighlightedTokens && missingRaws.length > 0) {
        omittedSummary = `Omits vs. peer quotes: ${missingRaws
          .slice(0, 6)
          .join(' ')}`;
      }
    }

    byQuoteId[entry.quoteId] = {
      effectiveSpec: entry.spec,
      differsFromConsensus,
      chunks: mergedChunks,
      omittedSummary,
    };
  }

  return { lineSpecsDiffer: true, byQuoteId };
}

export function buildTechnicalTableTsv(
  canonicalLines: CanonicalRfqLine[],
  rows: EvaluatedSupplierWholeRfq[]
): string {
  const headers = [
    'RFQ Line',
    'Supplier',
    'Quoted CC#',
    'Manufacturer & Part Number',
    'Specifications',
    'Alternatives / SME Status',
    'Quoted Qty · UOM · Pack',
    'Unit & Line Price (CAD)',
  ];

  const dataRows: Array<Array<string | number>> = [];

  for (const cl of canonicalLines) {
    const { byQuoteId } = analyzeLineSpecifications(cl, rows);
    const requestedLabel =
      [cl.manufacturer, cl.requestedPartNumber].filter(Boolean).join(' ') ||
      'Not stated';
    const lineCell = `Line ${cl.lineIndex}: ${cl.description} (Baseline CC#: ${
      cl.ccNumber || 'Not stated'
    } · Requested: ${requestedLabel})`;

    for (const row of rows) {
      const qLine =
        row.quote.lines.find((l) => l.canonicalLineId === cl.canonicalLineId) ??
        null;
      const ccy = row.fx.currency;
      const fxRate = row.fx.effectiveRate;
      const fxMissing = ccy !== 'CAD' && fxRate === null;

      const unitOrig =
        qLine?.unitPrice !== null && qLine?.unitPrice !== undefined
          ? roundCents(qLine.unitPrice)
          : null;
      const extOrig =
        qLine?.extendedPrice !== null && qLine?.extendedPrice !== undefined
          ? roundCents(qLine.extendedPrice)
          : unitOrig !== null &&
              qLine?.quotedQuantity !== null &&
              qLine?.quotedQuantity !== undefined
            ? roundCents(unitOrig * qLine.quotedQuantity)
            : null;
      const unitCad =
        unitOrig !== null && fxRate !== null
          ? roundCents(unitOrig * fxRate)
          : null;
      const extCad =
        extOrig !== null && fxRate !== null
          ? roundCents(extOrig * fxRate)
          : null;

      const isSubOrChanged = Boolean(
        qLine?.isSubstitute || qLine?.partNumberChanged
      );
      const specAnalysis = byQuoteId[row.quote.quoteId];

      const quotedCc = getEffectiveCcNumber(qLine?.ccNumber);
      const ccCell = quotedCc ?? NOT_STATED_CLARIFY;

      const mpnCell =
        !qLine || (!qLine.manufacturer?.trim() && !qLine.partNumber?.trim())
          ? NOT_STATED_CLARIFY
          : [qLine.manufacturer, qLine.partNumber || NOT_STATED_CLARIFY]
              .filter(Boolean)
              .join(' ');

      let specCell: string;
      if (!qLine || !specAnalysis?.effectiveSpec) {
        specCell = 'Not stated';
      } else {
        const diffNotes: string[] = [];
        if (specAnalysis.omittedSummary) {
          diffNotes.push(specAnalysis.omittedSummary);
        }
        if (specAnalysis.differsFromConsensus) {
          diffNotes.push('Differs between suppliers');
        }
        specCell =
          diffNotes.length > 0
            ? `${specAnalysis.effectiveSpec} [${diffNotes.join(' · ')}]`
            : specAnalysis.effectiveSpec;
      }

      const smeCell = !qLine
        ? `Line omitted — ${NOT_STATED_CLARIFY}`
        : isSubOrChanged
          ? `Substitute / Part # Change — SME Review Required (Provisional)${
              qLine.substituteDetails ? `: ${qLine.substituteDetails}` : ''
            }`
          : 'Exact part match · No alternative proposed';

      const qtyCell =
        !qLine || qLine.quotedQuantity === null
          ? NOT_STATED_CLARIFY
          : `${qLine.quotedQuantity} ${qLine.uom || ''}${
              qLine.packSize ? ` (${qLine.packSize})` : ''
            }`.trim() +
            (qLine.quantityMismatch || qLine.uomOrPackDifference
              ? ` · ${
                  qLine.uomPackNote ||
                  'Qty / UOM / pack-size differs from baseline'
                }`
              : '');

      let priceCell: string;
      if (!qLine || extOrig === null) {
        priceCell = NOT_STATED_CLARIFY;
      } else {
        const cadLine =
          fxMissing || extCad === null
            ? 'Not stated'
            : formatMoney(extCad, 'CAD');
        const cadUnit =
          unitCad !== null && !fxMissing
            ? ` (Unit: ${formatMoney(unitCad, 'CAD')})`
            : '';
        const origStr =
          ccy !== 'CAD'
            ? ` · Orig: ${formatMoney(extOrig, ccy)}${
                unitOrig !== null ? ` (${formatMoney(unitOrig, ccy)}/u)` : ''
              }`
            : '';
        const estStr = qLine.isEstimatedPrice ? ` · ${ESTIMATE_CONFIRM}` : '';
        priceCell = `${cadLine}${cadUnit}${origStr}${estStr}`;
      }

      dataRows.push([
        lineCell,
        row.supplierDisplayName,
        ccCell,
        mpnCell,
        specCell,
        smeCell,
        qtyCell,
        priceCell,
      ]);
    }
  }

  return formatTsv([headers, ...dataRows]);
}

export const TechnicalTable: React.FC<TechnicalTableProps> = ({
  canonicalLines,
  rows,
}) => {
  return (
    <section
      id="technical"
      aria-labelledby="heading-technical"
      className="scroll-mt-20 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="heading-technical"
            className="font-display text-base sm:text-lg font-bold text-slate-900"
          >
            04. Technical Comparison Table (SME Review)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Matched by CC#, Manufacturer &amp; Part Number · Substitutes held provisional pending SME approval
          </p>
        </div>

        <CopyActionButton
          label="Copy table"
          getText={() => buildTechnicalTableTsv(canonicalLines, rows)}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-xs font-semibold text-slate-700">
                <th className="py-3 px-3.5 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 whitespace-nowrap">
                  Supplier
                </th>
                <th className="py-3 px-3.5 whitespace-nowrap">Quoted CC#</th>
                <th className="py-3 px-3.5 whitespace-nowrap">
                  Manufacturer &amp; Part Number
                </th>
                <th className="py-3 px-3.5">Specifications</th>
                <th className="py-3 px-3.5">Alternatives / SME Status</th>
                <th className="py-3 px-3.5 whitespace-nowrap">
                  Quoted Qty · UOM · Pack
                </th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">
                  Unit &amp; Line Price (CAD)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {canonicalLines.map((cl) => {
                const lineHasSubstitute = rows.some((r) => {
                  const ql = r.quote.lines.find(
                    (l) => l.canonicalLineId === cl.canonicalLineId
                  );
                  return Boolean(ql?.isSubstitute || ql?.partNumberChanged);
                });

                const { lineSpecsDiffer, byQuoteId } =
                  analyzeLineSpecifications(cl, rows);

                return (
                  <React.Fragment key={cl.canonicalLineId}>
                    {/* Canonical RFQ Line Group Header */}
                    <tr className="bg-slate-50 border-y border-slate-200">
                      <td colSpan={7} className="py-2.5 px-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs sm:text-sm font-semibold text-slate-900">
                            <span>
                              Line {cl.lineIndex}: {cl.description}
                            </span>
                            <span className="mx-2 text-slate-400 font-normal" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono tabular-nums font-normal text-slate-700">
                              Baseline CC#: {cl.ccNumber || 'Not stated'}
                            </span>
                            <span className="mx-2 text-slate-400 font-normal" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono tabular-nums font-normal text-slate-700">
                              Requested:{' '}
                              {[cl.manufacturer, cl.requestedPartNumber]
                                .filter(Boolean)
                                .join(' ') || 'Not stated'}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600">
                            <span>Matched via: {cl.matchedBy}</span>
                            {lineSpecsDiffer && (
                              <>
                                <span className="mx-1.5" aria-hidden="true">·</span>
                                <span className="font-semibold text-amber-800">
                                  Specifications differ between suppliers
                                </span>
                              </>
                            )}
                            {lineHasSubstitute && (
                              <>
                                <span className="mx-1.5" aria-hidden="true">·</span>
                                <span className="font-semibold text-amber-800">
                                  Line Provisional — SME Review Required
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Every Supplier Row for this Canonical Line */}
                    {rows.map((row) => {
                      const qLine =
                        row.quote.lines.find(
                          (l) => l.canonicalLineId === cl.canonicalLineId
                        ) ?? null;
                      const ccy = row.fx.currency;
                      const fxRate = row.fx.effectiveRate;
                      const fxMissing = ccy !== 'CAD' && fxRate === null;

                      const unitOrig =
                        qLine?.unitPrice !== null && qLine?.unitPrice !== undefined
                          ? roundCents(qLine.unitPrice)
                          : null;
                      const extOrig =
                        qLine?.extendedPrice !== null &&
                        qLine?.extendedPrice !== undefined
                          ? roundCents(qLine.extendedPrice)
                          : unitOrig !== null &&
                              qLine?.quotedQuantity !== null &&
                              qLine?.quotedQuantity !== undefined
                            ? roundCents(unitOrig * qLine.quotedQuantity)
                            : null;

                      const unitCad =
                        unitOrig !== null && fxRate !== null
                          ? roundCents(unitOrig * fxRate)
                          : null;
                      const extCad =
                        extOrig !== null && fxRate !== null
                          ? roundCents(extOrig * fxRate)
                          : null;

                      const isSubOrChanged = Boolean(
                        qLine?.isSubstitute || qLine?.partNumberChanged
                      );

                      const specAnalysis = byQuoteId[row.quote.quoteId];

                      return (
                        <tr
                          key={`${cl.canonicalLineId}-${row.quote.quoteId}`}
                          className={`align-top hover:bg-slate-50/70 transition-colors ${
                            isSubOrChanged ? 'bg-amber-50/25' : 'bg-white'
                          }`}
                        >
                          <td className="py-3 px-3.5 sticky left-0 bg-white z-10 border-r border-slate-200 font-medium text-slate-900 whitespace-nowrap">
                            {row.supplierDisplayName}
                          </td>

                          {/* Quoted CC# */}
                          <td className="py-3 px-3.5 font-mono tabular-nums">
                            {!getEffectiveCcNumber(qLine?.ccNumber) ? (
                              <span className="font-sans text-xs text-amber-800 font-medium">
                                {NOT_STATED_CLARIFY}
                              </span>
                            ) : (
                              <span className="text-slate-800">
                                {getEffectiveCcNumber(qLine?.ccNumber)}
                              </span>
                            )}
                          </td>

                          {/* Quoted Manufacturer & Part # */}
                          <td className="py-3 px-3.5">
                            {!qLine ||
                            (!qLine.manufacturer?.trim() &&
                              !qLine.partNumber?.trim()) ? (
                              <span className="text-xs text-amber-800 font-medium">
                                {NOT_STATED_CLARIFY}
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                {qLine.manufacturer && (
                                  <div className="text-xs text-slate-600">
                                    {qLine.manufacturer}
                                  </div>
                                )}
                                <div className="font-mono tabular-nums font-semibold text-slate-900">
                                  {qLine.partNumber || NOT_STATED_CLARIFY}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Specifications (from each supplier's own line description, highlighting differences) */}
                          <td className="py-3 px-3.5 max-w-[300px]">
                            {!qLine || !specAnalysis?.effectiveSpec ? (
                              <span className="text-xs text-amber-800 font-medium">
                                Not stated
                              </span>
                            ) : (
                              <div
                                className={
                                  specAnalysis.differsFromConsensus
                                    ? 'border-l-2 border-amber-500 pl-2.5 space-y-1'
                                    : 'space-y-1'
                                }
                              >
                                <div className="text-xs sm:text-sm text-slate-700 leading-snug">
                                  {specAnalysis.chunks.map((chunk, idx) =>
                                    chunk.style === 'amber' ? (
                                      <mark
                                        key={idx}
                                        className="bg-amber-100 text-amber-950 font-semibold px-0.5 rounded-xs"
                                      >
                                        {chunk.text}
                                      </mark>
                                    ) : chunk.style === 'peer' ? (
                                      <mark
                                        key={idx}
                                        className="bg-slate-200/80 text-slate-900 font-medium px-0.5 rounded-xs"
                                      >
                                        {chunk.text}
                                      </mark>
                                    ) : (
                                      <span key={idx}>{chunk.text}</span>
                                    )
                                  )}
                                </div>
                                {specAnalysis.omittedSummary && (
                                  <div className="text-[11px] font-medium text-amber-800">
                                    {specAnalysis.omittedSummary}
                                  </div>
                                )}
                                {specAnalysis.differsFromConsensus && (
                                  <div className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <span>Differs between suppliers</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Alternatives / SME Status */}
                          <td className="py-3 px-3.5 max-w-[260px]">
                            {!qLine ? (
                              <span className="text-xs text-amber-800 font-medium">
                                Line omitted — {NOT_STATED_CLARIFY}
                              </span>
                            ) : isSubOrChanged ? (
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                  <span>
                                    Substitute / Part # Change — SME Review Required (Provisional)
                                  </span>
                                </div>
                                {qLine.substituteDetails && (
                                  <p className="text-xs text-slate-700 leading-snug">
                                    {qLine.substituteDetails}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-xs text-emerald-800 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Exact part match · No alternative proposed</span>
                              </div>
                            )}
                          </td>

                          {/* Quoted Qty / UOM / Pack */}
                          <td className="py-3 px-3.5">
                            {!qLine || qLine.quotedQuantity === null ? (
                              <span className="text-xs text-amber-800 font-medium">
                                {NOT_STATED_CLARIFY}
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="font-mono tabular-nums text-slate-900">
                                  {qLine.quotedQuantity} {qLine.uom || ''}
                                  {qLine.packSize ? ` (${qLine.packSize})` : ''}
                                </div>
                                {(qLine.quantityMismatch ||
                                  qLine.uomOrPackDifference) && (
                                  <div className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <span>
                                      {qLine.uomPackNote ||
                                        'Qty / UOM / pack-size differs from baseline'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Unit & Line Price */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            {!qLine || extOrig === null ? (
                              <span className="text-xs text-amber-800 font-medium">
                                {NOT_STATED_CLARIFY}
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="font-mono tabular-nums font-semibold text-slate-900">
                                  {fxMissing || extCad === null
                                    ? 'Not stated'
                                    : formatMoney(extCad, 'CAD')}
                                </div>
                                {unitCad !== null && !fxMissing && (
                                  <div className="font-mono tabular-nums text-[11px] text-slate-600">
                                    Unit: {formatMoney(unitCad, 'CAD')}
                                  </div>
                                )}
                                {ccy !== 'CAD' && (
                                  <div className="font-mono tabular-nums text-[11px] text-slate-500">
                                    Orig: {formatMoney(extOrig, ccy)}
                                    {unitOrig !== null
                                      ? ` (${formatMoney(unitOrig, ccy)}/u)`
                                      : ''}
                                  </div>
                                )}
                                {qLine.isEstimatedPrice && (
                                  <div className="text-[11px] text-amber-800 font-medium">
                                    {ESTIMATE_CONFIRM}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
