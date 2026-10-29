export enum ChargeStatus {
  INCLUDED = 'included',
  STATED_AMOUNT = 'stated_amount',
  ESTIMATED_AMOUNT = 'estimated_amount',
  EXCLUDED_TBD = 'excluded_tbd',
  NOT_MENTIONED = 'not_mentioned',
}

export enum SoleSourceDecision {
  UNASKED = 'unasked',
  CONFIRMED_SOLE_SOURCE = 'confirmed_sole_source',
  AWAITING_MORE_QUOTES = 'awaiting_more_quotes',
}

export enum FlagCategory {
  ALL = 'all',
  MISSING_VALUE = 'missing_value',
  ESTIMATE = 'estimate',
  SUBSTITUTE_SME = 'substitute_sme',
  EXPIRED_QUOTE = 'expired_quote',
  QTY_UOM_PACK = 'qty_uom_pack',
  IGNORED_INSTRUCTION = 'ignored_instruction',
}

export interface UploadedPdfInput {
  id: string;
  fileName: string;
  fileSize: number;
  base64Data: string;
  mimeType: string;
}

export interface PastedQuoteInput {
  id: string;
  label: string;
  text: string;
}

export interface ExtractedCharge {
  status: ChargeStatus;
  amount: number | null;
  rawNote: string | null;
}

export interface ExtractedQuoteLine {
  canonicalLineId: string;
  supplierLineNumber: string | null;
  ccNumber: string | null;
  manufacturer: string | null;
  partNumber: string | null;
  description: string | null;
  specifications: string | null;
  quotedQuantity: number | null;
  uom: string | null;
  packSize: string | null;
  unitPrice: number | null;
  extendedPrice: number | null;
  isEstimatedPrice: boolean;
  lineMoq: string | null;
  lineMoqMinimumUnits: number | null;
  lineMoqMinimumOrderAmount: number | null;
  isSubstitute: boolean;
  partNumberChanged: boolean;
  substituteDetails: string | null;
  quantityMismatch: boolean;
  uomOrPackDifference: boolean;
  uomPackNote: string | null;
}

export interface ExtractedSupplierQuote {
  quoteId: string;
  sourceLabel: string;
  supplierName: string | null;
  quoteNumber: string | null;
  currency: string;
  currencyExplicitlyStated: boolean;
  quoteDate: string | null;
  expiryDate: string | null;
  leadTimeText: string | null;
  leadTimeDays: number | null;
  paymentTermsText: string | null;
  paymentNetDays: number | null;
  orderMoqText: string | null;
  minimumOrderAmount: number | null;
  freight: ExtractedCharge;
  handling: ExtractedCharge;
  certifications: ExtractedCharge;
  lines: ExtractedQuoteLine[];
  embeddedInstructions: string[];
  commercialNotes: string | null;
}

export interface CanonicalRfqLine {
  canonicalLineId: string;
  lineIndex: number;
  ccNumber: string | null;
  manufacturer: string | null;
  requestedPartNumber: string | null;
  description: string;
  requestedSpecifications: string | null;
  requestedQuantity: number | null;
  requestedUom: string | null;
  requestedPackSize: string | null;
  matchedBy: string;
}

export interface FxRateObservation {
  currency: string;
  seriesCode: string;
  bocRate: number | null;
  observationDate: string | null;
  fetchStatus: 'fetched' | 'not_available' | 'error';
  errorMessage?: string;
}

export interface AnalyzeRfqResponse {
  rfqTitle: string | null;
  sessionDate: string;
  quotes: ExtractedSupplierQuote[];
  canonicalLines: CanonicalRfqLine[];
  fxRates: Record<string, FxRateObservation>;
  buyerRequestSummary: string | null;
}

export interface EffectiveFxInfo {
  currency: string;
  effectiveRate: number | null;
  source: 'CAD' | 'BOC' | 'OVERRIDE' | 'MISSING';
  bocRate: number | null;
  observationDate: string | null;
  overrideRate: number | null;
  seriesCode: string;
}

export interface EvaluatedCharge {
  status: ChargeStatus;
  originalAmount: number | null;
  cadAmount: number | null;
  isCompleteForRanking: boolean;
  isEstimated: boolean;
  isUnstatedGap: boolean;
  displayLabel: string;
  rawNote: string | null;
}

export interface EvaluatedSupplierWholeRfq {
  quote: ExtractedSupplierQuote;
  supplierDisplayName: string;
  fx: EffectiveFxInfo;
  goodsOriginal: number | null;
  goodsCad: number | null;
  freightEval: EvaluatedCharge;
  handlingEval: EvaluatedCharge;
  certificationsEval: EvaluatedCharge;
  knownSubtotalOriginal: number | null;
  knownSubtotalCad: number | null;
  deliveredPreTaxOriginal: number | null;
  deliveredPreTaxCad: number | null;
  isCompleteBidForCost: boolean;
  isExpired: boolean;
  hasSubstituteLines: boolean;
  hasMissingAllLines: boolean;
  hasQuantityMismatch: boolean;
  hasUomOrPackDiff: boolean;
  isProvisional: boolean;
  provisionalReasons: string[];
  rank: number | null;
  rankLabel: string;
  maxExcludedFreightCad: number | null;
  freightBreakevenBasis: string | null;
  freightSummaryTag: string;
}

export interface SplitSupplierCell {
  quoteId: string;
  supplierName: string;
  currency: string;
  fx: EffectiveFxInfo;
  quotedLine: ExtractedQuoteLine | null;
  unitPriceOriginal: number | null;
  unitPriceCad: number | null;
  extendedOriginal: number | null;
  extendedCad: number | null;
  moqLabel: string;
  isComparable: boolean;
  isProvisionalLine: boolean;
  provisionalNotes: string[];
}

export interface EvaluatedSplitLine {
  canonicalLine: CanonicalRfqLine;
  supplierCells: SplitSupplierCell[];
  lowestSupplierQuoteId: string | null;
  lowestSupplierName: string | null;
  lowestExtendedCad: number | null;
  isLineProvisional: boolean;
  lineStatusNote: string | null;
}

export interface SplitAwardSupplierOrderSummary {
  quoteId: string;
  supplierName: string;
  currency: string;
  fx: EffectiveFxInfo;
  wonLineCount: number;
  wonGoodsOriginal: number;
  wonGoodsCad: number | null;
  orderMoqLabel: string;
  moqMet: boolean | null;
  moqShortfallNote: string | null;
  orderChargesCad: number | null;
  orderChargesNote: string;
  totalAllocatedDeliveredCad: number | null;
  hasUnstatedOrderCharges: boolean;
}

export interface AuditFlag {
  id: string;
  category: Exclude<FlagCategory, FlagCategory.ALL>;
  severity: 'critical' | 'warning' | 'info';
  owner: 'Supplier Clarification' | 'SME Review' | 'Buyer Confirmation' | 'Security Boundary';
  supplierName: string;
  scope: string;
  headline: string;
  detail: string;
}

export interface RecommendationResult {
  status: 'policy_gate_fewer_than_three' | 'clarification_blocking' | 'award_recommended';
  quoteCount: number;
  primaryText: string;
  conditions: string[];
  freightBreakevenCallout: string | null;
  fallbackText: string | null;
  buyerRequestNote: string | null;
  isProvisionalAward: boolean;
}

export interface EvaluatedRfqWorkbook {
  sessionDate: string;
  rfqTitle: string;
  quoteCount: number;
  fxMap: Record<string, EffectiveFxInfo>;
  foreignCurrencies: EffectiveFxInfo[];
  wholeRfqRows: EvaluatedSupplierWholeRfq[];
  splitLines: EvaluatedSplitLine[];
  splitSupplierSummaries: SplitAwardSupplierOrderSummary[];
  splitTotalDeliveredCad: number | null;
  splitHasGaps: boolean;
  splitSavingsVsBestWholeCad: number | null;
  flags: AuditFlag[];
  recommendation: RecommendationResult;
}
