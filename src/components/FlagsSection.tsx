import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { AuditFlag, FlagCategory } from '../types/rfq';
import { formatTsv } from '../lib/clipboard';
import { CopyActionButton } from './CopyActionButton';

interface FlagsSectionProps {
  flags: AuditFlag[];
}

const FILTER_OPTIONS: Array<{
  key: FlagCategory;
  label: string;
}> = [
  { key: FlagCategory.ALL, label: 'All Flags' },
  { key: FlagCategory.MISSING_VALUE, label: 'Missing Values' },
  { key: FlagCategory.SUBSTITUTE_SME, label: 'Substitutes & SME' },
  { key: FlagCategory.ESTIMATE, label: 'Estimates' },
  { key: FlagCategory.EXPIRED_QUOTE, label: 'Expired Quotes' },
  { key: FlagCategory.QTY_UOM_PACK, label: 'Qty / UOM / Pack' },
  { key: FlagCategory.IGNORED_INSTRUCTION, label: 'Ignored Instructions' },
];

export function buildFlagsTableTsv(
  visibleFlags: AuditFlag[],
  totalFlagsCount: number
): string {
  const headers = [
    'Action Owner',
    'Supplier',
    'Scope',
    'Flag & Required Clarification',
  ];

  if (visibleFlags.length === 0) {
    const emptyNote =
      totalFlagsCount === 0
        ? 'No missing values, substitutes, estimates, expired quotes, or UOM discrepancies detected.'
        : 'No flags in this category for the current RFQ session.';
    return formatTsv([headers, ['—', '—', '—', emptyNote]]);
  }

  const dataRows = visibleFlags.map((flag) => [
    flag.owner,
    flag.supplierName,
    flag.scope,
    `${flag.headline} — ${flag.detail}`,
  ]);

  return formatTsv([headers, ...dataRows]);
}

export const FlagsSection: React.FC<FlagsSectionProps> = ({ flags }) => {
  const [activeFilter, setActiveFilter] = useState<FlagCategory>(FlagCategory.ALL);

  const countFor = (cat: FlagCategory): number => {
    if (cat === FlagCategory.ALL) return flags.length;
    return flags.filter((f) => f.category === cat).length;
  };

  const visibleFlags =
    activeFilter === FlagCategory.ALL
      ? flags
      : flags.filter((f) => f.category === activeFilter);

  return (
    <section
      id="flags"
      aria-labelledby="heading-flags"
      className="scroll-mt-20 space-y-3"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2
            id="heading-flags"
            className="font-display text-base sm:text-lg font-bold text-slate-900"
          >
            05. Clarification &amp; Compliance Flags
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every missing value, supplier estimate, technical substitute, expired quote, UOM/pack discrepancy, and ignored embedded instruction
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 max-w-full">
          {/* Interactive Segmented Category Filter */}
          <div
            role="tablist"
            aria-label="Filter audit flags by category"
            className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto max-w-full"
          >
            {FILTER_OPTIONS.map((opt) => {
              const count = countFor(opt.key);
              const isSelected = activeFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveFilter(opt.key)}
                  className={`min-h-9 sm:min-h-8 px-2.5 py-1 text-xs font-medium rounded-md transition-opacity whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-slate-900 ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="ml-1.5 font-mono tabular-nums text-[11px] text-slate-500">
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          <CopyActionButton
            label="Copy table"
            getText={() => buildFlagsTableTsv(visibleFlags, flags.length)}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {flags.length === 0 ? (
          <div className="p-6 text-center space-y-1">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 mx-auto" />
            <p className="text-sm font-medium text-slate-900">
              No missing values, substitutes, estimates, expired quotes, or UOM discrepancies detected.
            </p>
          </div>
        ) : visibleFlags.length === 0 ? (
          <div className="p-6 text-center text-xs sm:text-sm text-slate-600">
            No flags in this category for the current RFQ session.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-xs font-semibold text-slate-700">
                  <th className="py-3 px-3.5 whitespace-nowrap">Action Owner</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Supplier</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Scope</th>
                  <th className="py-3 px-3.5">Flag &amp; Required Clarification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleFlags.map((flag) => (
                  <tr
                    key={flag.id}
                    className="align-top hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                        {flag.category === FlagCategory.IGNORED_INSTRUCTION ? (
                          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                        ) : flag.severity === 'critical' ? (
                          <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                        )}
                        <span>{flag.owner}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3.5 font-semibold text-slate-900 whitespace-nowrap">
                      {flag.supplierName}
                    </td>

                    <td className="py-3 px-3.5 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {flag.scope}
                    </td>

                    <td className="py-3 px-3.5 space-y-0.5">
                      <div className="font-semibold text-slate-900">
                        {flag.headline}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {flag.detail}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
