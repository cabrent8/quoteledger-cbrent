import {
  AuditFlag,
  CanonicalRfqLine,
  ChargeStatus,
  EffectiveFxInfo,
  EvaluatedCharge,
  EvaluatedRfqWorkbook,
  EvaluatedSplitLine,
  EvaluatedSupplierWholeRfq,
  ExtractedCharge,
  ExtractedQuoteLine,
  ExtractedSupplierQuote,
  FlagCategory,
  FxRateObservation,
  RecommendationResult,
  SoleSourceDecision,
  SplitAwardSupplierOrderSummary,
  SplitSupplierCell,
} from '../types/rfq';

export const NOT_STATED_CLARIFY = 'Not stated—supplier clarification required';
export const ESTIMATE_CONFIRM = 'Estimate—confirm with supplier';
export const EMBEDDED_IGNORED = 'Embedded instruction ignored';

export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(amount: number | null, currency = 'CAD'): string {
  if (amount === null || !Number.isFinite(amount)) {
    return 'Not stated';
  }
  const formatted = new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency.toUpperCase()} ${formatted}`;
}

export function formatCadNarrative(amount: number): string {
  const rounded = roundCents(amount);
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.005;
  const formatted = new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(rounded);
  return `CAD ${formatted}`;
}

/**
 * Collapses accidental double periods (e.g., when a supplier name like "Boreal Flowworks Inc."
 * or a payment term ending in "." appears at the end of a sentence) without altering ellipses.
 */
export function sanitizeDoublePeriods(text: string): string {
  return text.replace(/(?<!\.)\.\.(?!\.)/g, '.');
}

export function buildEffectiveFxMap(
  quotes: ExtractedSupplierQuote[],
  fxObservations: Record<string, FxRateObservation>,
  fxOverrides: Record<string, number | null>
): Record<string, EffectiveFxInfo> {
  const map: Record<string, EffectiveFxInfo> = {
    CAD: {
      currency: 'CAD',
      effectiveRate: 1,
      source: 'CAD',
      bocRate: 1,
      observationDate: null,
      overrideRate: null,
      seriesCode: 'CAD',
    },
  };

  for (const quote of quotes) {
    const code = (quote.currency || 'CAD').trim().toUpperCase();
    if (code === 'CAD' || map[code]) continue;

    const obs = fxObservations[code];
    const override = fxOverrides[code];
    const hasValidOverride = typeof override === 'number' && Number.isFinite(override) && override > 0;
    const hasValidBoc =
      obs &&
      obs.fetchStatus === 'fetched' &&
      typeof obs.bocRate === 'number' &&
      Number.isFinite(obs.bocRate) &&
      obs.bocRate > 0;

    let effectiveRate: number | null = null;
    let source: EffectiveFxInfo['source'] = 'MISSING';
    if (hasValidOverride) {
      effectiveRate = override;
      source = 'OVERRIDE';
    } else if (hasValidBoc) {
      effectiveRate = obs.bocRate;
      source = 'BOC';
    }

    map[code] = {
      currency: code,
      effectiveRate,
      source,
      bocRate: hasValidBoc ? obs.bocRate : null,
      observationDate: obs?.observationDate ?? null,
      overrideRate: hasValidOverride ? override : null,
      seriesCode: obs?.seriesCode ?? `FX${code}CAD`,
    };
  }

  return map;
}

function convertToCad(amount: number | null, fx: EffectiveFxInfo): number | null {
  if (amount === null || !Number.isFinite(amount)) return null;
  if (fx.currency === 'CAD') return roundCents(amount);
  if (fx.effectiveRate === null || !Number.isFinite(fx.effectiveRate)) return null;
  return roundCents(amount * fx.effectiveRate);
}

function evaluateCharge(
  charge: ExtractedCharge,
  fx: EffectiveFxInfo,
  chargeKind: 'freight' | 'handling' | 'certifications'
): EvaluatedCharge {
  const status = charge?.status ?? ChargeStatus.NOT_MENTIONED;

  if (status === ChargeStatus.INCLUDED) {
    return {
      status,
      originalAmount: 0,
      cadAmount: fx.effectiveRate !== null ? 0 : null,
      isCompleteForRanking: fx.effectiveRate !== null,
      isEstimated: false,
      isUnstatedGap: false,
      displayLabel: fx.effectiveRate !== null ? 'CAD 0.00 · Included' : 'Included (FX rate not stated)',
      rawNote: charge.rawNote,
    };
  }

  if (status === ChargeStatus.STATED_AMOUNT && charge.amount !== null && Number.isFinite(charge.amount)) {
    const cad = convertToCad(charge.amount, fx);
    return {
      status,
      originalAmount: roundCents(charge.amount),
      cadAmount: cad,
      isCompleteForRanking: cad !== null,
      isEstimated: false,
      isUnstatedGap: false,
      displayLabel: cad !== null ? formatMoney(cad, 'CAD') : 'Not stated (FX rate unavailable)',
      rawNote: charge.rawNote,
    };
  }

  if (status === ChargeStatus.ESTIMATED_AMOUNT && charge.amount !== null && Number.isFinite(charge.amount)) {
    const cad = convertToCad(charge.amount, fx);
    return {
      status,
      originalAmount: roundCents(charge.amount),
      cadAmount: cad,
      isCompleteForRanking: cad !== null,
      isEstimated: true,
      isUnstatedGap: false,
      displayLabel:
        cad !== null
          ? `${formatMoney(cad, 'CAD')} · ${ESTIMATE_CONFIRM}`
          : `Not stated · ${ESTIMATE_CONFIRM}`,
      rawNote: charge.rawNote,
    };
  }

  if (status === ChargeStatus.EXCLUDED_TBD) {
    return {
      status,
      originalAmount: null,
      cadAmount: null,
      isCompleteForRanking: false,
      isEstimated: false,
      isUnstatedGap: true,
      displayLabel: NOT_STATED_CLARIFY,
      rawNote: charge.rawNote,
    };
  }

  // NOT_MENTIONED: Freight is ALWAYS required for physical delivery and never treated as zero.
  // Handling/certifications when unmentioned are still marked "Not stated—supplier clarification required" in display,
  // while not blocking freight-complete quotes unless explicitly excluded/TBD.
  return {
    status: ChargeStatus.NOT_MENTIONED,
    originalAmount: null,
    cadAmount: null,
    isCompleteForRanking: chargeKind !== 'freight' && fx.effectiveRate !== null,
    isEstimated: false,
    isUnstatedGap: chargeKind === 'freight',
    displayLabel: NOT_STATED_CLARIFY,
    rawNote: charge?.rawNote ?? null,
  };
}

function computeLineExtendedOriginal(line: ExtractedQuoteLine): number | null {
  if (line.extendedPrice !== null && Number.isFinite(line.extendedPrice)) {
    return roundCents(line.extendedPrice);
  }
  if (
    line.unitPrice !== null &&
    Number.isFinite(line.unitPrice) &&
    line.quotedQuantity !== null &&
    Number.isFinite(line.quotedQuantity)
  ) {
    return roundCents(line.unitPrice * line.quotedQuantity);
  }
  return null;
}

/**
 * Resolves a supplier's effective technical specifications from that supplier's own line description
 * (and any additional non-duplicate line-level specification text). Returns null ONLY when the
 * supplier's line has no technical description at all (e.g., empty or merely repeating part/CC#).
 */
export function getEffectiveLineSpecifications(
  qLine: ExtractedQuoteLine | null | undefined
): string | null {
  if (!qLine) return null;

  const normalizeIdentifier = (val: string | null | undefined): string =>
    (val || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const partNorm = normalizeIdentifier(qLine.partNumber);
  const mfrPartNorm = normalizeIdentifier(
    `${qLine.manufacturer || ''}${qLine.partNumber || ''}`
  );
  const ccNorm = normalizeIdentifier(qLine.ccNumber);

  const isBareIdentifierOnly = (text: string): boolean => {
    const norm = normalizeIdentifier(text);
    if (!norm) return true;
    return (
      (Boolean(partNorm) && norm === partNorm) ||
      (Boolean(mfrPartNorm) && norm === mfrPartNorm) ||
      (Boolean(ccNorm) && norm === ccNorm)
    );
  };

  const rawDesc = qLine.description?.trim() || '';
  const rawSpec = qLine.specifications?.trim() || '';

  const desc = rawDesc && !isBareIdentifierOnly(rawDesc) ? rawDesc : '';
  const spec = rawSpec && !isBareIdentifierOnly(rawSpec) ? rawSpec : '';

  if (!desc && !spec) return null;
  if (desc && !spec) return desc;
  if (!desc && spec) return spec;

  if (desc.toLowerCase().includes(spec.toLowerCase())) {
    return desc;
  }
  if (spec.toLowerCase().includes(desc.toLowerCase())) {
    return spec;
  }
  return `${desc} — ${spec}`;
}

export function getEffectiveCcNumber(
  ccNumber: string | null | undefined
): string | null {
  if (!ccNumber) return null;
  const trimmed = ccNumber.trim();
  if (!trimmed) return null;
  if (/^(?:null|n\/a|na|none|not\s*stated|omitted|blank|[-–—]+)$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function formatComparatorSubstituteNote(
  comparator: EvaluatedSupplierWholeRfq,
  canonicalLines: CanonicalRfqLine[]
): string | null {
  const matchedCanonicalIds = new Set<string>();
  const lineLabels: string[] = [];

  for (const cl of canonicalLines) {
    const qLine = comparator.quote.lines.find(
      (l) => l.canonicalLineId === cl.canonicalLineId
    );
    if (qLine) {
      matchedCanonicalIds.add(cl.canonicalLineId);
      if (qLine.isSubstitute || qLine.partNumberChanged) {
        lineLabels.push(`Line ${cl.lineIndex}`);
      }
    }
  }

  for (const qLine of comparator.quote.lines) {
    if (matchedCanonicalIds.has(qLine.canonicalLineId)) continue;
    if (qLine.isSubstitute || qLine.partNumberChanged) {
      const fallbackNum = qLine.supplierLineNumber?.trim();
      lineLabels.push(fallbackNum ? `Line ${fallbackNum}` : 'quoted');
    }
  }

  if (lineLabels.length === 0) {
    return null;
  }

  const supplierPossessive = `${comparator.supplierDisplayName}’s`;
  if (lineLabels.length === 1) {
    const label = lineLabels[0];
    return label === 'quoted'
      ? `assumes ${supplierPossessive} substitute is approved`
      : `assumes ${supplierPossessive} ${label} substitute is approved`;
  }

  const validLabels = lineLabels.filter((l) => l !== 'quoted');
  if (validLabels.length === 0) {
    return `assumes ${supplierPossessive} substitutes are approved`;
  }
  if (validLabels.length === 2) {
    return `assumes ${supplierPossessive} ${validLabels[0]} and ${validLabels[1]} substitutes are approved`;
  }
  const allButLast = validLabels.slice(0, -1).join(', ');
  const last = validLabels[validLabels.length - 1];
  return `assumes ${supplierPossessive} ${allButLast}, and ${last} substitutes are approved`;
}

function getFreightSummaryTag(freightEval: EvaluatedCharge): string {
  if (freightEval.status === ChargeStatus.INCLUDED) return 'freight included';
  if (freightEval.status === ChargeStatus.ESTIMATED_AMOUNT) {
    return `freight estimated at ${formatMoney(freightEval.cadAmount, 'CAD')}`;
  }
  if (freightEval.status === ChargeStatus.STATED_AMOUNT) {
    return `freight ${formatMoney(freightEval.cadAmount, 'CAD')} included in total`;
  }
  return 'freight not stated';
}

export function evaluateRfqWorkbook(params: {
  rfqTitle: string | null;
  sessionDate: string;
  quotes: ExtractedSupplierQuote[];
  canonicalLines: CanonicalRfqLine[];
  fxObservations: Record<string, FxRateObservation>;
  fxOverrides: Record<string, number | null>;
  soleSourceDecision: SoleSourceDecision;
  buyerRequest: string;
  buyerRequestSummary: string | null;
}): EvaluatedRfqWorkbook {
  const {
    rfqTitle,
    sessionDate,
    quotes,
    canonicalLines,
    fxObservations,
    fxOverrides,
    soleSourceDecision,
    buyerRequest,
  } = params;

  const fxMap = buildEffectiveFxMap(quotes, fxObservations, fxOverrides);
  const foreignCurrencies = Object.values(fxMap).filter((f) => f.currency !== 'CAD');

  const flags: AuditFlag[] = [];
  let flagSeq = 1;
  const pushFlag = (flag: Omit<AuditFlag, 'id'>) => {
    flags.push({
      ...flag,
      headline: sanitizeDoublePeriods(flag.headline),
      detail: sanitizeDoublePeriods(flag.detail),
      id: `flag-${flagSeq++}`,
    });
  };

  // Detect whether any quote explicitly charges or excludes certifications or handling
  const anyExplicitCertifications = quotes.some(
    (q) =>
      q.certifications.status === ChargeStatus.STATED_AMOUNT ||
      q.certifications.status === ChargeStatus.ESTIMATED_AMOUNT ||
      q.certifications.status === ChargeStatus.EXCLUDED_TBD
  );
  const anyExplicitHandling = quotes.some(
    (q) =>
      q.handling.status === ChargeStatus.STATED_AMOUNT ||
      q.handling.status === ChargeStatus.ESTIMATED_AMOUNT ||
      q.handling.status === ChargeStatus.EXCLUDED_TBD
  );

  // Build Whole-RFQ rows first pass
  const wholeRows: EvaluatedSupplierWholeRfq[] = quotes.map((quote, idx) => {
    const supplierDisplayName = quote.supplierName?.trim() || `Unnamed Supplier ${idx + 1}`;
    const ccy = (quote.currency || 'CAD').trim().toUpperCase();
    const fx = fxMap[ccy] ?? fxMap.CAD;

    const freightEval = evaluateCharge(quote.freight, fx, 'freight');
    const handlingEval = evaluateCharge(quote.handling, fx, 'handling');
    const certificationsEval = evaluateCharge(quote.certifications, fx, 'certifications');

    // Match canonical lines for this quote
    const lineExtOriginals: (number | null)[] = canonicalLines.map((cl) => {
      const matched = quote.lines.find((l) => l.canonicalLineId === cl.canonicalLineId);
      if (!matched) return null;
      return computeLineExtendedOriginal(matched);
    });

    const quotedAllCanonicalLines =
      canonicalLines.length > 0 && lineExtOriginals.every((val) => val !== null);

    // Also handle case if canonicalLines is empty for some reason
    const fallbackLineExts = quote.lines.map(computeLineExtendedOriginal);
    const activeExts = canonicalLines.length > 0 ? lineExtOriginals : fallbackLineExts;
    const anyLinePriced = activeExts.some((v) => v !== null);

    const goodsOriginal = anyLinePriced
      ? roundCents(activeExts.reduce<number>((acc, val) => acc + (val ?? 0), 0))
      : null;
    const goodsCad = convertToCad(goodsOriginal, fx);

    const knownChargesOriginal =
      (freightEval.originalAmount ?? 0) +
      (handlingEval.originalAmount ?? 0) +
      (certificationsEval.originalAmount ?? 0);

    const knownSubtotalOriginal =
      goodsOriginal !== null ? roundCents(goodsOriginal + knownChargesOriginal) : null;
    const knownSubtotalCad = convertToCad(knownSubtotalOriginal, fx);

    const isExpired =
      Boolean(quote.expiryDate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(quote.expiryDate!.trim()) &&
      quote.expiryDate!.trim() < sessionDate;

    const hasSubstituteLines = quote.lines.some((l) => l.isSubstitute || l.partNumberChanged);
    const hasQuantityMismatch = quote.lines.some((l) => l.quantityMismatch);
    const hasUomOrPackDiff = quote.lines.some((l) => l.uomOrPackDifference);

    const certGapPreventsComparison =
      certificationsEval.status === ChargeStatus.EXCLUDED_TBD ||
      (anyExplicitCertifications && certificationsEval.status === ChargeStatus.NOT_MENTIONED);

    const handlingGapPreventsComparison = handlingEval.status === ChargeStatus.EXCLUDED_TBD;

    const isCompleteBidForCost =
      fx.effectiveRate !== null &&
      quotedAllCanonicalLines &&
      goodsCad !== null &&
      freightEval.isCompleteForRanking &&
      !handlingGapPreventsComparison &&
      !certGapPreventsComparison &&
      !hasQuantityMismatch;

    const deliveredPreTaxOriginal = isCompleteBidForCost ? knownSubtotalOriginal : null;
    const deliveredPreTaxCad = isCompleteBidForCost ? knownSubtotalCad : null;

    const provisionalReasons: string[] = [];
    if (fx.currency !== 'CAD' && fx.effectiveRate === null) {
      provisionalReasons.push(`Exchange rate for ${fx.currency} not stated`);
    }
    if (!quotedAllCanonicalLines) {
      provisionalReasons.push('Missing line item pricing');
    }
    if (!freightEval.isCompleteForRanking) {
      provisionalReasons.push('Freight not stated');
    }
    if (handlingGapPreventsComparison) {
      provisionalReasons.push('Handling excluded / TBD');
    }
    if (certGapPreventsComparison) {
      provisionalReasons.push('Certifications not stated');
    }
    if (hasSubstituteLines) {
      provisionalReasons.push('Substitute / part # change requires SME review');
    }
    if (isExpired) {
      provisionalReasons.push(`Quote expired (${quote.expiryDate})`);
    }
    if (hasQuantityMismatch) {
      provisionalReasons.push('Quantity difference across lines');
    }
    if (hasUomOrPackDiff) {
      provisionalReasons.push('UOM or pack-size difference');
    }

    const isProvisional = provisionalReasons.length > 0;

    return {
      quote,
      supplierDisplayName,
      fx,
      goodsOriginal,
      goodsCad,
      freightEval,
      handlingEval,
      certificationsEval,
      knownSubtotalOriginal,
      knownSubtotalCad,
      deliveredPreTaxOriginal,
      deliveredPreTaxCad,
      isCompleteBidForCost,
      isExpired,
      hasSubstituteLines,
      hasMissingAllLines: !quotedAllCanonicalLines,
      hasQuantityMismatch,
      hasUomOrPackDiff,
      isProvisional,
      provisionalReasons,
      rank: null,
      rankLabel: NOT_STATED_CLARIFY,
      maxExcludedFreightCad: null,
      freightBreakevenBasis: null,
      freightSummaryTag: getFreightSummaryTag(freightEval),
    };
  });

  // Sort Whole-RFQ rows per Rule 2:
  // 1. Quotes with all canonical lines priced in CAD come before incomplete-line/missing-FX quotes
  // 2. Lowest delivered pre-tax cost CAD (or known quoted subtotal CAD when provisional due to unstated freight)
  // 3. Lead time (days ascending; stated before unstated)
  // 4. Payment terms (net days descending — e.g. Net 60 > Net 30 > Net 15 > COD; stated before unstated)
  const sortedRows = [...wholeRows].sort((a, b) => {
    const aHasComparableCad = !a.hasMissingAllLines && a.knownSubtotalCad !== null ? 0 : 1;
    const bHasComparableCad = !b.hasMissingAllLines && b.knownSubtotalCad !== null ? 0 : 1;
    if (aHasComparableCad !== bHasComparableCad) return aHasComparableCad - bHasComparableCad;

    const aCost = a.deliveredPreTaxCad ?? a.knownSubtotalCad ?? Number.POSITIVE_INFINITY;
    const bCost = b.deliveredPreTaxCad ?? b.knownSubtotalCad ?? Number.POSITIVE_INFINITY;
    if (Math.abs(aCost - bCost) >= 0.005) return aCost - bCost;

    const aLead = a.quote.leadTimeDays ?? Number.POSITIVE_INFINITY;
    const bLead = b.quote.leadTimeDays ?? Number.POSITIVE_INFINITY;
    if (aLead !== bLead) return aLead - bLead;

    const aNet = a.quote.paymentNetDays ?? -1;
    const bNet = b.quote.paymentNetDays ?? -1;
    if (aNet !== bNet) return bNet - aNet;

    return a.supplierDisplayName.localeCompare(b.supplierDisplayName);
  });

  sortedRows.forEach((row, index) => {
    if (row.knownSubtotalCad === null) {
      row.rank = null;
      row.rankLabel = 'Unranked · Price/FX not stated';
    } else {
      row.rank = index + 1;
      row.rankLabel = row.isProvisional ? `#${index + 1} (Provisional)` : `#${index + 1}`;
    }
  });

  // Calculate maximum excluded freight breakeven for any supplier with unstated/excluded freight
  for (const row of sortedRows) {
    if (!row.freightEval.isUnstatedGap || row.knownSubtotalCad === null || row.hasMissingAllLines) {
      continue;
    }

    const completeComparators = sortedRows.filter(
      (other) =>
        other.quote.quoteId !== row.quote.quoteId &&
        other.isCompleteBidForCost &&
        other.deliveredPreTaxCad !== null
    );

    if (completeComparators.length === 0) {
      row.maxExcludedFreightCad = null;
      row.freightBreakevenBasis =
        'No comparable complete quote with stated, included, or estimated freight is available to anchor breakeven.';
      continue;
    }

    // Next-best comparable complete quote is the lowest-cost complete bid
    const bestComplete = completeComparators[0];
    const targetCad = bestComplete.deliveredPreTaxCad!;
    const delta = roundCents(targetCad - row.knownSubtotalCad);
    const comparatorSubNote = formatComparatorSubstituteNote(
      bestComplete,
      canonicalLines
    );
    const subSuffix = comparatorSubNote ? ` (${comparatorSubNote})` : '';

    if (delta > 0) {
      row.maxExcludedFreightCad = delta;
      row.freightBreakevenBasis = sanitizeDoublePeriods(
        `Compared against ${bestComplete.supplierDisplayName}'s complete delivered pre-tax total of ${formatMoney(
          targetCad,
          'CAD'
        )} (${bestComplete.freightSummaryTag}) minus ${row.supplierDisplayName}'s quoted pre-tax subtotal of ${formatMoney(
          row.knownSubtotalCad,
          'CAD'
        )} = ${formatMoney(delta, 'CAD')} maximum excluded freight${subSuffix}.`
      );
    } else {
      row.maxExcludedFreightCad = 0;
      row.freightBreakevenBasis = sanitizeDoublePeriods(
        `${row.supplierDisplayName}'s quoted subtotal excluding freight (${formatMoney(
          row.knownSubtotalCad,
          'CAD'
        )}) already equals or exceeds ${bestComplete.supplierDisplayName}'s complete delivered total (${formatMoney(
          targetCad,
          'CAD'
        )}, ${bestComplete.freightSummaryTag}); maximum excluded freight before exceeding is CAD 0.00${subSuffix}.`
      );
    }
  }

  // Build Split-Award Table (includes ALL suppliers on every line per Acceptance Test 2)
  const splitLines: EvaluatedSplitLine[] = canonicalLines.map((cl) => {
    const supplierCells: SplitSupplierCell[] = sortedRows.map((row) => {
      const qLine = row.quote.lines.find((l) => l.canonicalLineId === cl.canonicalLineId) ?? null;
      if (!qLine) {
        return {
          quoteId: row.quote.quoteId,
          supplierName: row.supplierDisplayName,
          currency: row.fx.currency,
          fx: row.fx,
          quotedLine: null,
          unitPriceOriginal: null,
          unitPriceCad: null,
          extendedOriginal: null,
          extendedCad: null,
          moqLabel: NOT_STATED_CLARIFY,
          isComparable: false,
          isProvisionalLine: true,
          provisionalNotes: ['Line not quoted'],
        };
      }

      const extOrig = computeLineExtendedOriginal(qLine);
      const extCad = convertToCad(extOrig, row.fx);
      const unitOrig = qLine.unitPrice !== null ? roundCents(qLine.unitPrice) : null;
      const unitCad = convertToCad(unitOrig, row.fx);

      const provisionalNotes: string[] = [];
      if (qLine.isSubstitute || qLine.partNumberChanged) {
        provisionalNotes.push('Substitute / part # change — SME review required');
      }
      if (qLine.quantityMismatch) {
        provisionalNotes.push('Quantity differs from RFQ');
      }
      if (qLine.uomOrPackDifference) {
        provisionalNotes.push('UOM / pack-size difference');
      }
      if (qLine.isEstimatedPrice) {
        provisionalNotes.push(ESTIMATE_CONFIRM);
      }
      if (row.isExpired) {
        provisionalNotes.push('Quote expired');
      }

      const moqParts: string[] = [];
      if (qLine.lineMoq) moqParts.push(qLine.lineMoq);
      if (row.quote.orderMoqText) moqParts.push(`Order: ${row.quote.orderMoqText}`);

      return {
        quoteId: row.quote.quoteId,
        supplierName: row.supplierDisplayName,
        currency: row.fx.currency,
        fx: row.fx,
        quotedLine: qLine,
        unitPriceOriginal: unitOrig,
        unitPriceCad: unitCad,
        extendedOriginal: extOrig,
        extendedCad: extCad,
        moqLabel: moqParts.length > 0 ? moqParts.join(' · ') : 'None stated',
        isComparable: extCad !== null && !qLine.quantityMismatch,
        isProvisionalLine: provisionalNotes.length > 0,
        provisionalNotes,
      };
    });

    const comparableCells = supplierCells
      .filter((c) => c.isComparable && c.extendedCad !== null)
      .sort((a, b) => (a.extendedCad! - b.extendedCad!));

    const winner = comparableCells[0] ?? null;

    return {
      canonicalLine: cl,
      supplierCells,
      lowestSupplierQuoteId: winner?.quoteId ?? null,
      lowestSupplierName: winner?.supplierName ?? null,
      lowestExtendedCad: winner?.extendedCad ?? null,
      isLineProvisional: winner ? winner.isProvisionalLine : true,
      lineStatusNote: winner
        ? winner.provisionalNotes.length > 0
          ? `Provisional (${winner.provisionalNotes.join('; ')})`
          : 'Firm line price'
        : NOT_STATED_CLARIFY,
    };
  });

  // Split-award supplier order-level summary (includes ALL suppliers)
  const splitSupplierSummaries: SplitAwardSupplierOrderSummary[] = sortedRows.map((row) => {
    const wonLines = splitLines.filter((sl) => sl.lowestSupplierQuoteId === row.quote.quoteId);
    const wonCells = wonLines
      .map((sl) => sl.supplierCells.find((c) => c.quoteId === row.quote.quoteId)!)
      .filter(Boolean);

    const wonGoodsOriginal = roundCents(
      wonCells.reduce((sum, c) => sum + (c.extendedOriginal ?? 0), 0)
    );
    const wonGoodsCad =
      row.fx.effectiveRate !== null ? convertToCad(wonGoodsOriginal, row.fx) : null;

    // Check order-level MOQ if supplier won at least 1 line
    let moqMet: boolean | null = null;
    let moqShortfallNote: string | null = null;
    if (wonLines.length > 0 && row.quote.minimumOrderAmount !== null) {
      moqMet = wonGoodsOriginal >= row.quote.minimumOrderAmount;
      if (!moqMet) {
        moqShortfallNote = `Allocated goods (${formatMoney(
          wonGoodsOriginal,
          row.fx.currency
        )}) below supplier minimum order of ${formatMoney(
          row.quote.minimumOrderAmount,
          row.fx.currency
        )}`;
      }
    }

    // Check line-level MOQ units on won lines
    for (const cell of wonCells) {
      const qLine = cell.quotedLine;
      if (
        qLine &&
        qLine.lineMoqMinimumUnits !== null &&
        qLine.quotedQuantity !== null &&
        qLine.quotedQuantity < qLine.lineMoqMinimumUnits
      ) {
        moqMet = false;
        moqShortfallNote = `Quoted qty (${qLine.quotedQuantity}) below line MOQ (${qLine.lineMoqMinimumUnits})`;
      }
    }

    const hasUnstatedOrderCharges =
      row.freightEval.isUnstatedGap ||
      row.handlingEval.status === ChargeStatus.EXCLUDED_TBD ||
      row.certificationsEval.status === ChargeStatus.EXCLUDED_TBD;

    const knownOrderChargesOriginal = roundCents(
      (row.freightEval.originalAmount ?? 0) +
        (row.handlingEval.originalAmount ?? 0) +
        (row.certificationsEval.originalAmount ?? 0)
    );
    const orderChargesCad =
      wonLines.length > 0
        ? hasUnstatedOrderCharges
          ? null
          : convertToCad(knownOrderChargesOriginal, row.fx)
        : convertToCad(knownOrderChargesOriginal, row.fx);

    const chargeNotes: string[] = [];
    chargeNotes.push(`Freight: ${row.freightEval.displayLabel}`);
    if (
      row.handlingEval.status !== ChargeStatus.NOT_MENTIONED ||
      anyExplicitHandling
    ) {
      chargeNotes.push(`Handling: ${row.handlingEval.displayLabel}`);
    }
    if (
      row.certificationsEval.status !== ChargeStatus.NOT_MENTIONED ||
      anyExplicitCertifications
    ) {
      chargeNotes.push(`Certs: ${row.certificationsEval.displayLabel}`);
    }

    const totalAllocatedDeliveredCad =
      wonLines.length === 0
        ? 0
        : wonGoodsCad !== null && !hasUnstatedOrderCharges && orderChargesCad !== null
          ? roundCents(wonGoodsCad + orderChargesCad)
          : null;

    return {
      quoteId: row.quote.quoteId,
      supplierName: row.supplierDisplayName,
      currency: row.fx.currency,
      fx: row.fx,
      wonLineCount: wonLines.length,
      wonGoodsOriginal,
      wonGoodsCad,
      orderMoqLabel: row.quote.orderMoqText || 'None stated',
      moqMet,
      moqShortfallNote,
      orderChargesCad,
      orderChargesNote: chargeNotes.join(' · '),
      totalAllocatedDeliveredCad,
      hasUnstatedOrderCharges,
    };
  });

  const activeWinners = splitSupplierSummaries.filter((s) => s.wonLineCount > 0);
  const splitHasGaps =
    splitLines.some((sl) => sl.lowestExtendedCad === null) ||
    activeWinners.some(
      (s) => s.totalAllocatedDeliveredCad === null || s.moqMet === false
    );

  const splitTotalDeliveredCad =
    !splitHasGaps && activeWinners.length > 0
      ? roundCents(
          activeWinners.reduce((sum, s) => sum + (s.totalAllocatedDeliveredCad ?? 0), 0)
        )
      : null;

  const bestCompleteWhole = sortedRows.find(
    (r) => r.isCompleteBidForCost && r.deliveredPreTaxCad !== null
  );
  const splitSavingsVsBestWholeCad =
    splitTotalDeliveredCad !== null && bestCompleteWhole?.deliveredPreTaxCad !== undefined && bestCompleteWhole.deliveredPreTaxCad !== null
      ? roundCents(bestCompleteWhole.deliveredPreTaxCad - splitTotalDeliveredCad)
      : null;

  // Populate Section 05 Audit Flags comprehensively
  // 1. Foreign exchange missing rate flags
  for (const fx of foreignCurrencies) {
    if (fx.effectiveRate === null) {
      pushFlag({
        category: FlagCategory.MISSING_VALUE,
        severity: 'critical',
        owner: 'Buyer Confirmation',
        supplierName: `Foreign Currency (${fx.currency})`,
        scope: `${fx.currency}/CAD Exchange Rate`,
        headline: `${fx.currency} exchange rate: Not stated`,
        detail: `The Bank of Canada rate for ${fx.currency} couldn’t be retrieved. Conversions are marked ‘Not stated’—enter an override rate to continue.`,
      });
    }
  }

  for (const row of sortedRows) {
    const q = row.quote;
    const sName = row.supplierDisplayName;

    // Embedded instructions ignored (strictly AI-directed or evaluation-manipulation text)
    if (Array.isArray(q.embeddedInstructions)) {
      for (const snippet of q.embeddedInstructions) {
        const trimmed = snippet?.trim();
        if (!trimmed) continue;
        pushFlag({
          category: FlagCategory.IGNORED_INSTRUCTION,
          severity: 'warning',
          owner: 'Security Boundary',
          supplierName: sName,
          scope: 'Quote Document Content',
          headline: EMBEDDED_IGNORED,
          detail: `${EMBEDDED_IGNORED}: "${trimmed}" — treated strictly as inert quote text and excluded from evaluation commands.`,
        });
      }
    }

    // Header missing values
    if (!q.supplierName?.trim()) {
      pushFlag({
        category: FlagCategory.MISSING_VALUE,
        severity: 'warning',
        owner: 'Supplier Clarification',
        supplierName: sName,
        scope: 'Quote Header',
        headline: `Supplier name: ${NOT_STATED_CLARIFY}`,
        detail: `Vendor legal/trading name was not stated on quote source "${q.sourceLabel}".`,
      });
    }

    if (!q.quoteNumber?.trim()) {
      pushFlag({
        category: FlagCategory.MISSING_VALUE,
        severity: 'warning',
        owner: 'Supplier Clarification',
        supplierName: sName,
        scope: 'Quote Header',
        headline: `Quote number: ${NOT_STATED_CLARIFY}`,
        detail: `Quote reference number is missing (${NOT_STATED_CLARIFY}). Obtain formal quote reference before issuing PO.`,
      });
    }

    if (!q.currencyExplicitlyStated) {
      pushFlag({
        category: FlagCategory.MISSING_VALUE,
        severity: 'warning',
        owner: 'Supplier Clarification',
        supplierName: sName,
        scope: 'Quote Header',
        headline: `Currency code: ${NOT_STATED_CLARIFY}`,
        detail: `Currency symbol/ISO code was not explicitly stated (${NOT_STATED_CLARIFY}); verify whether prices are quoted in CAD.`,
      });
    }

    if (!q.leadTimeText?.trim()) {
      pushFlag({
        category: FlagCategory.MISSING_VALUE,
        severity: 'warning',
        owner: 'Supplier Clarification',
        supplierName: sName,
        scope: 'Quote Header',
        headline: `Lead time: ${NOT_STATED_CLARIFY}`,
        detail: `Delivery lead time is missing (${NOT_STATED_CLARIFY}).`,
      });
    }

    if (!q.paymentTermsText?.trim()) {
      pushFlag({
        category: FlagCategory.MISSING_VALUE,
        severity: 'warning',
        owner: 'Supplier Clarification',
        supplierName: sName,
        scope: 'Quote Header',
        headline: `Payment terms: ${NOT_STATED_CLARIFY}`,
        detail: `Commercial payment terms are missing (${NOT_STATED_CLARIFY}).`,
      });
    }

    if (!q.expiryDate?.trim()) {
      pushFlag({
        category: FlagCategory.MISSING_VALUE,
        severity: 'warning',
        owner: 'Supplier Clarification',
        supplierName: sName,
        scope: 'Quote Header',
        headline: `Quote expiry date: ${NOT_STATED_CLARIFY}`,
        detail: `Quote validity / expiry date is missing (${NOT_STATED_CLARIFY}).`,
      });
    } else if (row.isExpired) {
      pushFlag({
        category: FlagCategory.EXPIRED_QUOTE,
        severity: 'critical',
        owner: 'Supplier Clarification',
        supplierName: sName,
        scope: 'Quote Validity',
        headline: `Expired quote (${q.expiryDate})`,
        detail: `Quote expired on ${q.expiryDate} (session date ${sessionDate}). Ranking kept provisional until supplier re-confirms pricing and validity in writing.`,
      });
    }

    // Order-level charges: Freight, Handling, Certifications
    if (row.freightEval.isEstimated) {
      pushFlag({
        category: FlagCategory.ESTIMATE,
        severity: 'warning',
        owner: 'Supplier Clarification',
        supplierName: sName,
        scope: 'Order Freight',
        headline: `Freight: ${ESTIMATE_CONFIRM}`,
        detail: `${ESTIMATE_CONFIRM} — Quoted freight of ${formatMoney(
          row.freightEval.originalAmount,
          row.fx.currency
        )}${
          row.fx.currency !== 'CAD' && row.freightEval.cadAmount !== null
            ? ` (${formatMoney(row.freightEval.cadAmount, 'CAD')})`
            : ''
        } is an estimate${q.freight.rawNote ? ` ("${q.freight.rawNote}")` : ''}. Included in delivered ranking total; confirm cap or firm charge before PO.`,
      });
    } else if (row.freightEval.isUnstatedGap) {
      pushFlag({
        category: FlagCategory.MISSING_VALUE,
        severity: 'critical',
        owner: 'Supplier Clarification',
        supplierName: sName,
        scope: 'Order Freight',
        headline: `Freight: ${NOT_STATED_CLARIFY}`,
        detail: `Unquoted/excluded freight is never treated as zero (${NOT_STATED_CLARIFY}). ${
          row.freightBreakevenBasis ?? ''
        }`.trim(),
      });
    }

    if (row.handlingEval.isEstimated) {
      pushFlag({
        category: FlagCategory.ESTIMATE,
        severity: 'warning',
        owner: 'Supplier Clarification',
        supplierName: sName,
        scope: 'Order Handling',
        headline: `Handling: ${ESTIMATE_CONFIRM}`,
        detail: `${ESTIMATE_CONFIRM} — Handling charge of ${formatMoney(
          row.handlingEval.originalAmount,
          row.fx.currency
        )} is estimated${q.handling.rawNote ? ` ("${q.handling.rawNote}")` : ''}.`,
      });
    } else if (
      row.handlingEval.status === ChargeStatus.EXCLUDED_TBD ||
      (anyExplicitHandling && row.handlingEval.status === ChargeStatus.NOT_MENTIONED)
    ) {
      pushFlag({
        category: FlagCategory.MISSING_VALUE,
        severity: 'warning',
        owner: 'Supplier Clarification',
        supplierName: sName,
        scope: 'Order Handling',
        headline: `Handling: ${NOT_STATED_CLARIFY}`,
        detail: `Handling charge is ${
          row.handlingEval.status === ChargeStatus.EXCLUDED_TBD
            ? 'marked extra/TBD without an amount'
            : 'not stated while other bidders specified handling'
        } (${NOT_STATED_CLARIFY}).`,
      });
    }

    if (row.certificationsEval.isEstimated) {
      pushFlag({
        category: FlagCategory.ESTIMATE,
        severity: 'warning',
        owner: 'Supplier Clarification',
        supplierName: sName,
        scope: 'Order Certifications',
        headline: `Certifications: ${ESTIMATE_CONFIRM}`,
        detail: `${ESTIMATE_CONFIRM} — Certification charge of ${formatMoney(
          row.certificationsEval.originalAmount,
          row.fx.currency
        )} is estimated${q.certifications.rawNote ? ` ("${q.certifications.rawNote}")` : ''}.`,
      });
    } else if (
      row.certificationsEval.status === ChargeStatus.EXCLUDED_TBD ||
      (anyExplicitCertifications && row.certificationsEval.status === ChargeStatus.NOT_MENTIONED)
    ) {
      pushFlag({
        category: FlagCategory.MISSING_VALUE,
        severity: 'warning',
        owner: 'Supplier Clarification',
        supplierName: sName,
        scope: 'Order Certifications',
        headline: `Certifications: ${NOT_STATED_CLARIFY}`,
        detail: `Certification charges are not stated (${NOT_STATED_CLARIFY}).`,
      });
    }

    // Line-level checks against canonical lines
    for (const cl of canonicalLines) {
      const lineLabel = `Line ${cl.lineIndex}${
        cl.requestedPartNumber ? ` (${cl.requestedPartNumber})` : ''
      }`;
      const qLine = q.lines.find((l) => l.canonicalLineId === cl.canonicalLineId);

      if (!qLine) {
        pushFlag({
          category: FlagCategory.MISSING_VALUE,
          severity: 'critical',
          owner: 'Supplier Clarification',
          supplierName: sName,
          scope: lineLabel,
          headline: `Line item omitted: ${NOT_STATED_CLARIFY}`,
          detail: `${sName} did not provide a quote for ${lineLabel} (${cl.description}).`,
        });
        continue;
      }

      const baselineCc = getEffectiveCcNumber(cl.ccNumber);
      const quotedCc = getEffectiveCcNumber(qLine.ccNumber);
      if (baselineCc && !quotedCc) {
        pushFlag({
          category: FlagCategory.MISSING_VALUE,
          severity: 'warning',
          owner: 'Supplier Clarification',
          supplierName: sName,
          scope: lineLabel,
          headline: `CC# missing: ${NOT_STATED_CLARIFY}`,
          detail: `Commodity/Catalog code (baseline ${baselineCc}) was omitted on ${sName}'s quote; matched by manufacturer/part number (${
            qLine.partNumber ?? 'N/A'
          }).`,
        });
      }

      if (!qLine.partNumber?.trim()) {
        pushFlag({
          category: FlagCategory.MISSING_VALUE,
          severity: 'critical',
          owner: 'SME Review',
          supplierName: sName,
          scope: lineLabel,
          headline: `Part number: ${NOT_STATED_CLARIFY}`,
          detail: `Manufacturer part number is not stated on ${lineLabel} (${NOT_STATED_CLARIFY}).`,
        });
      }

      if (!getEffectiveLineSpecifications(qLine)) {
        pushFlag({
          category: FlagCategory.MISSING_VALUE,
          severity: 'info',
          owner: 'SME Review',
          supplierName: sName,
          scope: lineLabel,
          headline: `Technical specifications: ${NOT_STATED_CLARIFY}`,
          detail: `Detailed technical specifications were not stated on ${lineLabel} (${NOT_STATED_CLARIFY}).`,
        });
      }

      if (computeLineExtendedOriginal(qLine) === null) {
        pushFlag({
          category: FlagCategory.MISSING_VALUE,
          severity: 'critical',
          owner: 'Supplier Clarification',
          supplierName: sName,
          scope: lineLabel,
          headline: `Line price: ${NOT_STATED_CLARIFY}`,
          detail: `Unit/extended price is missing for ${lineLabel} (${NOT_STATED_CLARIFY}).`,
        });
      } else if (qLine.isEstimatedPrice) {
        pushFlag({
          category: FlagCategory.ESTIMATE,
          severity: 'warning',
          owner: 'Supplier Clarification',
          supplierName: sName,
          scope: lineLabel,
          headline: `Line price: ${ESTIMATE_CONFIRM}`,
          detail: `Quoted line price for ${lineLabel} is marked as an estimate (${ESTIMATE_CONFIRM}).`,
        });
      }

      if (qLine.isSubstitute || qLine.partNumberChanged) {
        pushFlag({
          category: FlagCategory.SUBSTITUTE_SME,
          severity: 'critical',
          owner: 'SME Review',
          supplierName: sName,
          scope: lineLabel,
          headline: `Substitute / Part # change (${qLine.partNumber || 'Unlisted'}) — SME review required`,
          detail: `${sName} quoted ${qLine.manufacturer ? `${qLine.manufacturer} ` : ''}${
            qLine.partNumber || 'alternate item'
          } instead of requested ${cl.manufacturer ? `${cl.manufacturer} ` : ''}${
            cl.requestedPartNumber || 'baseline part'
          }.${qLine.substituteDetails ? ` ${qLine.substituteDetails}` : ''} Line held provisional pending SME technical sign-off before award.`,
        });
      }

      if (qLine.quantityMismatch || qLine.uomOrPackDifference) {
        const baselineQtyUom = [
          cl.requestedQuantity !== null ? String(cl.requestedQuantity) : null,
          cl.requestedUom,
          cl.requestedPackSize ? `(${cl.requestedPackSize})` : null,
        ]
          .filter(Boolean)
          .join(' ');
        const quotedQtyUom = [
          qLine.quotedQuantity !== null ? String(qLine.quotedQuantity) : null,
          qLine.uom,
          qLine.packSize ? `(${qLine.packSize})` : null,
        ]
          .filter(Boolean)
          .join(' ');

        pushFlag({
          category: FlagCategory.QTY_UOM_PACK,
          severity: qLine.quantityMismatch ? 'critical' : 'warning',
          owner: 'Supplier Clarification',
          supplierName: sName,
          scope: lineLabel,
          headline: `${
            qLine.quantityMismatch && qLine.uomOrPackDifference
              ? 'Quantity & UOM/pack-size difference'
              : qLine.quantityMismatch
                ? 'Quantity difference'
                : 'UOM or pack-size difference'
          } (${quotedQtyUom || 'Not stated'} vs. ${baselineQtyUom || 'RFQ baseline'})`,
          detail: `${
            qLine.uomPackNote ||
            `Quoted ${quotedQtyUom || 'unspecified UOM/qty'} compared to baseline ${
              baselineQtyUom || 'RFQ quantity/UOM'
            }. Verify pack conversion and total delivered unit count before PO issue.`
          }`,
        });
      }
    }
  }

  const rawRecommendation = buildRecommendation({
    quoteCount: quotes.length,
    soleSourceDecision,
    sortedRows,
    splitTotalDeliveredCad,
    splitSavingsVsBestWholeCad,
    splitSupplierSummaries,
    buyerRequest,
  });

  const recommendation: RecommendationResult = {
    ...rawRecommendation,
    primaryText: sanitizeDoublePeriods(rawRecommendation.primaryText),
    conditions: rawRecommendation.conditions.map(sanitizeDoublePeriods),
    freightBreakevenCallout: rawRecommendation.freightBreakevenCallout
      ? sanitizeDoublePeriods(rawRecommendation.freightBreakevenCallout)
      : null,
    fallbackText: rawRecommendation.fallbackText
      ? sanitizeDoublePeriods(rawRecommendation.fallbackText)
      : null,
    buyerRequestNote: rawRecommendation.buyerRequestNote
      ? sanitizeDoublePeriods(rawRecommendation.buyerRequestNote)
      : null,
  };

  return {
    sessionDate,
    rfqTitle: rfqTitle?.trim() || 'Current Session RFQ Comparison',
    quoteCount: quotes.length,
    fxMap,
    foreignCurrencies,
    wholeRfqRows: sortedRows,
    splitLines,
    splitSupplierSummaries,
    splitTotalDeliveredCad,
    splitHasGaps,
    splitSavingsVsBestWholeCad,
    flags,
    recommendation,
  };
}

function buildRecommendation(params: {
  quoteCount: number;
  soleSourceDecision: SoleSourceDecision;
  sortedRows: EvaluatedSupplierWholeRfq[];
  splitTotalDeliveredCad: number | null;
  splitSavingsVsBestWholeCad: number | null;
  splitSupplierSummaries: SplitAwardSupplierOrderSummary[];
  buyerRequest: string;
}): RecommendationResult {
  const {
    quoteCount,
    soleSourceDecision,
    sortedRows,
    splitTotalDeliveredCad,
    splitSavingsVsBestWholeCad,
    splitSupplierSummaries,
    buyerRequest,
  } = params;

  const trimmedRequest = buyerRequest.trim();

  // HARD RULE: Fewer than 3 quotes -> Stop and ask whether it is sole-source or more quotes are coming;
  // NO award recommendation until the buyer answers!
  if (quoteCount < 3 && soleSourceDecision !== SoleSourceDecision.CONFIRMED_SOLE_SOURCE) {
    const noun = quoteCount === 1 ? '1 supplier quote was' : `${quoteCount} supplier quotes were`;
    return {
      status: 'policy_gate_fewer_than_three',
      quoteCount,
      primaryText: `Fewer than three quotes were provided (${noun} received; minimum 3 required). Is this RFQ a sole-source purchase, or are more quotes coming?`,
      conditions: [
        soleSourceDecision === SoleSourceDecision.AWAITING_MORE_QUOTES
          ? 'More quotes are coming: upload or paste the remaining supplier quotes above, then run Compare Quotes again. No award recommendation will be made until at least 3 quotes are provided or sole-source is confirmed.'
          : 'No purchase order award is recommended until you confirm whether this is sole-source or provide at least three quotes.',
      ],
      freightBreakevenCallout: null,
      fallbackText: null,
      buyerRequestNote: trimmedRequest
        ? `Your request (“${trimmedRequest}”) was noted, and the award recommendation is held until you answer above.`
        : null,
      isProvisionalAward: true,
    };
  }

  // Filter candidates with full RFQ line coverage and valid CAD subtotal/total
  const viableRows = sortedRows.filter(
    (r) => !r.hasMissingAllLines && r.knownSubtotalCad !== null
  );

  if (viableRows.length === 0) {
    return {
      status: 'clarification_blocking',
      quoteCount,
      primaryText:
        'Clarification Required Before Award: None of the submitted quotes provide complete CAD-convertible pricing across all RFQ lines. Resolve missing line prices or missing foreign exchange rates before issuing a purchase order.',
      conditions: sortedRows.map(
        (r) => `${r.supplierDisplayName}: ${r.provisionalReasons.join(', ') || NOT_STATED_CLARIFY}`
      ),
      freightBreakevenCallout: null,
      fallbackText: null,
      buyerRequestNote: trimmedRequest ? `Buyer request: "${trimmedRequest}"` : null,
      isProvisionalAward: true,
    };
  }

  const leader = viableRows[0];
  const runnerUp = viableRows[1] ?? null;
  const completeCompetitors = viableRows.filter(
    (r) => r.quote.quoteId !== leader.quote.quoteId && r.isCompleteBidForCost && r.deliveredPreTaxCad !== null
  );
  const nextBestComplete = completeCompetitors[0] ?? null;

  const leadTimeLabel = leader.quote.leadTimeText?.trim() || 'lead time not stated';
  const paymentLabel = leader.quote.paymentTermsText?.trim() || 'payment terms not stated';

  const conditions: string[] = [];
  if (quoteCount < 3 && soleSourceDecision === SoleSourceDecision.CONFIRMED_SOLE_SOURCE) {
    conditions.push(
      `Buyer confirmed sole-source exception (${quoteCount} quote${quoteCount === 1 ? '' : 's'} evaluated).`
    );
  }

  if (leader.freightEval.isEstimated) {
    conditions.push(
      `${leader.supplierDisplayName} freight (${formatMoney(
        leader.freightEval.cadAmount,
        'CAD'
      )}) is supplier-estimated (${ESTIMATE_CONFIRM}).`
    );
  }
  if (leader.handlingEval.isEstimated) {
    conditions.push(
      `${leader.supplierDisplayName} handling (${formatMoney(
        leader.handlingEval.cadAmount,
        'CAD'
      )}) is supplier-estimated (${ESTIMATE_CONFIRM}).`
    );
  }
  if (leader.certificationsEval.isEstimated) {
    conditions.push(
      `${leader.supplierDisplayName} certifications (${formatMoney(
        leader.certificationsEval.cadAmount,
        'CAD'
      )}) are supplier-estimated (${ESTIMATE_CONFIRM}).`
    );
  }
  if (leader.hasSubstituteLines) {
    conditions.push(
      `Provisional pending SME technical review and approval of ${leader.supplierDisplayName}'s proposed substitute / part-number change before PO issue.`
    );
  }
  if (leader.isExpired) {
    conditions.push(
      `Quote expired on ${leader.quote.expiryDate}; obtain written price & validity re-confirmation from ${leader.supplierDisplayName} before issuing PO.`
    );
  }
  if (leader.hasQuantityMismatch || leader.hasUomOrPackDiff) {
    conditions.push(
      `Confirm UOM, pack size, and equivalent unit quantity with ${leader.supplierDisplayName} prior to award.`
    );
  }
  if (!leader.quote.quoteNumber?.trim()) {
    conditions.push(`Obtain formal quote number from ${leader.supplierDisplayName} (${NOT_STATED_CLARIFY}).`);
  }

  // Mention split-award economics if splitting across multiple vendors saves money AFTER order-level charges & MOQs
  const activeSplitVendors = splitSupplierSummaries.filter((s) => s.wonLineCount > 0);
  if (
    activeSplitVendors.length > 1 &&
    splitTotalDeliveredCad !== null &&
    splitSavingsVsBestWholeCad !== null &&
    splitSavingsVsBestWholeCad > 0.01
  ) {
    conditions.push(
      `Optional Split-Award Note: Splitting lines across ${activeSplitVendors
        .map((v) => v.supplierName)
        .join(' & ')} yields a net delivered total of ${formatMoney(
        splitTotalDeliveredCad,
        'CAD'
      )} (saving an additional ${formatMoney(
        splitSavingsVsBestWholeCad,
        'CAD'
      )} including order-level charges and MOQs; see Section 03).`
    );
  }

  // Case A: Leader has unstated/excluded freight -> Conditional award with exact breakeven formula!
  if (leader.freightEval.isUnstatedGap) {
    const leaderTotalStr = formatCadNarrative(leader.knownSubtotalCad!);

    if (nextBestComplete && nextBestComplete.deliveredPreTaxCad !== null) {
      const savingsCad = roundCents(nextBestComplete.deliveredPreTaxCad - leader.knownSubtotalCad!);
      const savingsStr = formatCadNarrative(savingsCad);
      const primaryText = `Award all items to ${leader.supplierDisplayName}: lowest quoted total (${leaderTotalStr}), ${leadTimeLabel}, ${paymentLabel}. Saves ${savingsStr} versus ${nextBestComplete.supplierDisplayName} (${nextBestComplete.freightSummaryTag}). If ${leader.supplierDisplayName}’s unstated freight exceeds ${savingsStr}, award to ${nextBestComplete.supplierDisplayName}.`;

      conditions.unshift(
        `Obtain firm written freight quote from ${leader.supplierDisplayName} before releasing PO (unstated freight is not treated as zero).`
      );

      return {
        status: 'award_recommended',
        quoteCount,
        primaryText,
        conditions,
        freightBreakevenCallout: leader.freightBreakevenBasis,
        fallbackText: `Fallback supplier: ${nextBestComplete.supplierDisplayName} at ${formatMoney(
          nextBestComplete.deliveredPreTaxCad,
          'CAD'
        )} delivered pre-tax (${nextBestComplete.freightSummaryTag}, ${
          nextBestComplete.quote.leadTimeText || 'lead time not stated'
        }, ${nextBestComplete.quote.paymentTermsText || 'payment terms not stated'}).`,
        buyerRequestNote: trimmedRequest ? `Addressed buyer request: "${trimmedRequest}"` : null,
        isProvisionalAward: true,
      };
    }

    // All viable quotes have unstated freight!
    return {
      status: 'clarification_blocking',
      quoteCount,
      primaryText: `Hold PO Award Pending Freight Clarification: ${leader.supplierDisplayName} has the lowest quoted goods subtotal (${leaderTotalStr}, ${leadTimeLabel}, ${paymentLabel}), but freight is not stated across comparable quotes—request firm delivered freight from bidders before awarding.`,
      conditions,
      freightBreakevenCallout: leader.freightBreakevenBasis,
      fallbackText: runnerUp
        ? `Next lowest quoted subtotal: ${runnerUp.supplierDisplayName} (${formatMoney(
            runnerUp.knownSubtotalCad,
            'CAD'
          )}, ${runnerUp.freightSummaryTag}).`
        : null,
      buyerRequestNote: trimmedRequest ? `Buyer request: "${trimmedRequest}"` : null,
      isProvisionalAward: true,
    };
  }

  // Case B: Leader has complete delivered cost (firm or supplier-estimated freight)
  const leaderDelivered = leader.deliveredPreTaxCad ?? leader.knownSubtotalCad!;
  const leaderTotalStr = formatCadNarrative(leaderDelivered);
  const comparator = nextBestComplete ?? runnerUp;

  let primaryText = `Award all items to ${leader.supplierDisplayName}: lowest delivered pre-tax total (${leaderTotalStr}), ${leadTimeLabel}, ${paymentLabel}.`;
  let fallbackText: string | null = null;

  if (comparator && comparator.knownSubtotalCad !== null) {
    const compTotal = comparator.deliveredPreTaxCad ?? comparator.knownSubtotalCad;
    const diff = roundCents(compTotal - leaderDelivered);
    if (diff >= 0) {
      const diffStr = formatCadNarrative(diff);
      primaryText += ` Saves ${diffStr} versus ${comparator.supplierDisplayName} (${comparator.freightSummaryTag}).`;
    }
    fallbackText = `Fallback supplier: ${comparator.supplierDisplayName} (${formatMoney(
      compTotal,
      'CAD'
    )}, ${comparator.freightSummaryTag}, ${
      comparator.quote.leadTimeText || 'lead time not stated'
    }, ${comparator.quote.paymentTermsText || 'payment terms not stated'}).`;
  }

  if (leader.isProvisional) {
    primaryText += ` Award is provisional pending required clarifications below.`;
  }

  return {
    status: 'award_recommended',
    quoteCount,
    primaryText,
    conditions,
    freightBreakevenCallout: null,
    fallbackText,
    buyerRequestNote: trimmedRequest ? `Addressed buyer request: "${trimmedRequest}"` : null,
    isProvisionalAward: leader.isProvisional,
  };
}
