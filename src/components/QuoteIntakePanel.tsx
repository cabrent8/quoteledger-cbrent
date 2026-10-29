import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  FlaskConical,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { PastedQuoteInput, UploadedPdfInput } from '../types/rfq';
import { SAMPLE_DATA_LABEL } from '../lib/sampleQuotes';

interface QuoteIntakePanelProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  onEnsureOpen: () => void;
  pdfs: UploadedPdfInput[];
  onAddPdfs: (files: UploadedPdfInput[]) => void;
  onRemovePdf: (id: string) => void;
  pastedQuotes: PastedQuoteInput[];
  onAddPastedSlot: () => void;
  onUpdatePastedSlot: (id: string, field: 'label' | 'text', value: string) => void;
  onRemovePastedSlot: (id: string) => void;
  buyerRequest: string;
  onChangeBuyerRequest: (value: string) => void;
  onLoadSampleQuotes: () => void;
  isSampleDataActive: boolean;
  hasAnyCurrentInputs: boolean;
  onSubmit: () => void;
  isLoading: boolean;
  hasResults: boolean;
  parsedQuoteCount: number | null;
  errorMessage: string | null;
  onClearError: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildUnreadableFileMessage(fileName: string): string {
  return `${fileName} couldn’t be read. Upload a text-based PDF under 20 MB or paste the quote text instead.`;
}

export const QuoteIntakePanel: React.FC<QuoteIntakePanelProps> = ({
  isOpen,
  onToggleOpen,
  onEnsureOpen,
  pdfs,
  onAddPdfs,
  onRemovePdf,
  pastedQuotes,
  onAddPastedSlot,
  onUpdatePastedSlot,
  onRemovePastedSlot,
  buyerRequest,
  onChangeBuyerRequest,
  onLoadSampleQuotes,
  isSampleDataActive,
  hasAnyCurrentInputs,
  onSubmit,
  isLoading,
  hasResults,
  parsedQuoteCount,
  errorMessage,
  onClearError,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileReadErrors, setFileReadErrors] = useState<string[]>([]);
  const [isConfirmingSample, setIsConfirmingSample] = useState(false);

  // Empty or whitespace-only paste slots are completely ignored
  const nonEmptyPasteCount = pastedQuotes.filter((p) => p.text.trim().length > 0).length;

  const handleTrySampleClick = () => {
    onEnsureOpen();
    if (hasAnyCurrentInputs) {
      setIsConfirmingSample(true);
      return;
    }
    setFileReadErrors([]);
    setIsConfirmingSample(false);
    onLoadSampleQuotes();
  };

  const handleConfirmLoadSample = () => {
    setFileReadErrors([]);
    setIsConfirmingSample(false);
    onLoadSampleQuotes();
  };

  const processFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const issues: string[] = [];
    const newUploads: UploadedPdfInput[] = [];

    for (const file of Array.from(fileList)) {
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf || file.size === 0 || file.size > 20 * 1024 * 1024) {
        console.error('[QuoteIntake] Rejected file before read:', {
          name: file.name,
          type: file.type,
          size: file.size,
        });
        issues.push(buildUnreadableFileMessage(file.name));
        continue;
      }

      try {
        // Verify %PDF- header bytes so non-PDF or corrupted files renamed to .pdf are caught cleanly
        const headerBuffer = await file.slice(0, 1024).arrayBuffer();
        const headerText = new TextDecoder('latin1').decode(headerBuffer);
        if (!headerText.includes('%PDF-')) {
          console.error('[QuoteIntake] Missing %PDF- header signature:', file.name);
          issues.push(buildUnreadableFileMessage(file.name));
          continue;
        }

        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
          reader.readAsDataURL(file);
        });

        if (!base64Data || !base64Data.includes(',')) {
          console.error('[QuoteIntake] Empty DataURL read result:', file.name);
          issues.push(buildUnreadableFileMessage(file.name));
          continue;
        }

        newUploads.push({
          id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          fileName: file.name,
          fileSize: file.size,
          base64Data,
          mimeType: 'application/pdf',
        });
      } catch (err) {
        console.error('[QuoteIntake] Error reading file:', file.name, err);
        issues.push(buildUnreadableFileMessage(file.name));
      }
    }

    setFileReadErrors(issues);
    if (newUploads.length > 0) {
      setIsConfirmingSample(false);
      onClearError();
      onAddPdfs(newUploads);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void processFiles(e.dataTransfer.files);
  };

  return (
    <section
      aria-label="Supplier Quote Intake"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Collapsible Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-slate-50/80 border-b border-slate-200">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="font-display text-sm sm:text-base font-semibold text-slate-900">
              Session Quote Intake
            </h2>
            {isSampleDataActive && (
              <span className="text-xs font-medium text-amber-800 border-l border-slate-300 pl-2.5">
                {SAMPLE_DATA_LABEL}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            <span>Session-only synthetic evaluation</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {pdfs.length} PDF{pdfs.length === 1 ? '' : 's'}
            </span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {nonEmptyPasteCount} pasted {nonEmptyPasteCount === 1 ? 'quote' : 'quotes'}
            </span>
            {parsedQuoteCount !== null && (
              <>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-800 font-medium">
                  {parsedQuoteCount} supplier {parsedQuoteCount === 1 ? 'quote' : 'quotes'} compared
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleTrySampleClick}
            className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-3.5 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition-opacity whitespace-nowrap shrink-0"
          >
            <FlaskConical className="w-3.5 h-3.5 text-slate-600" />
            <span>Try a sample</span>
          </button>

          {hasResults && (
            <button
              type="button"
              onClick={onToggleOpen}
              className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition-opacity whitespace-nowrap shrink-0"
            >
              {isOpen ? (
                <>
                  <span>Collapse Intake</span>
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Edit or Add Quotes</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Body */}
      {isOpen && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Buyer Confirmation Prompt Before Replacing Existing Inputs */}
          {isConfirmingSample && (
            <div
              role="region"
              aria-label="Confirm replacing current inputs with sample data"
              className="rounded-md border border-amber-300 bg-amber-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-slate-900 leading-snug">
                  <span className="font-semibold">
                    Replace current inputs with sample quotes?
                  </span>{' '}
                  <span className="text-slate-700">
                    This will clear your current quotes, uploaded PDFs, and comparison results in this session and fill the paste slots with three fictional quotes ({SAMPLE_DATA_LABEL}).
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsConfirmingSample(false)}
                  className="min-h-10 sm:min-h-8 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLoadSample}
                  className="min-h-10 sm:min-h-8 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0"
                >
                  Replace Current Inputs
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: PDF Upload */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <label className="text-sm font-semibold text-slate-900">
                  Upload Supplier Quote PDFs
                </label>
                <span className="text-xs text-slate-500">Text-based PDFs under 20 MB</span>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`border border-dashed rounded-md p-5 text-center cursor-pointer transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                  isDragging
                    ? 'border-slate-900 bg-slate-100/70'
                    : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={(e) => void processFiles(e.target.files)}
                  className="hidden"
                />
                <Upload className="w-5 h-5 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-800">
                  Select supplier quote PDFs or drop files here
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Upload one or more text-based PDFs under 20 MB each
                </p>
              </div>

              {fileReadErrors.length > 0 && (
                <div
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50/70 px-3.5 py-2.5 space-y-1 text-xs text-red-800"
                >
                  {fileReadErrors.map((msg, idx) => (
                    <p key={idx}>{msg}</p>
                  ))}
                </div>
              )}

              {pdfs.length > 0 && (
                <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md bg-white">
                  {pdfs.map((pdf) => (
                    <li
                      key={pdf.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">
                          {pdf.fileName}
                        </span>
                        <span className="text-slate-400 shrink-0" aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-slate-500 shrink-0">
                          {formatBytes(pdf.fileSize)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemovePdf(pdf.id)}
                        aria-label={`Remove ${pdf.fileName}`}
                        className="min-h-9 min-w-9 sm:min-h-7 sm:min-w-7 inline-flex items-center justify-center text-slate-500 hover:text-red-700 rounded focus-visible:outline-2 focus-visible:outline-slate-900 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Right Column: Pasted Quote Text Entries */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-slate-900">
                    Paste Supplier Quote Text
                  </span>
                  <span className="text-xs text-slate-500 ml-2">
                    Empty slots are ignored automatically
                  </span>
                  {isSampleDataActive && (
                    <span className="text-xs font-medium text-amber-800 ml-2">
                      · {SAMPLE_DATA_LABEL}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onAddPastedSlot}
                  className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-8 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Quote Slot</span>
                </button>
              </div>

              <div className="space-y-3">
                {pastedQuotes.map((slot, index) => (
                  <div
                    key={slot.id}
                    className="border border-slate-200 rounded-md bg-slate-50/40 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={slot.label}
                        onChange={(e) =>
                          onUpdatePastedSlot(slot.id, 'label', e.target.value)
                        }
                        aria-label={`Quote slot ${index + 1} label`}
                        placeholder={`Supplier Quote ${index + 1} label (optional)`}
                        className="w-full max-w-md text-xs font-medium text-slate-800 bg-transparent border-b border-transparent focus:border-slate-400 focus:outline-none py-1"
                      />
                      {pastedQuotes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemovePastedSlot(slot.id)}
                          aria-label={`Remove ${slot.label || `Quote slot ${index + 1}`}`}
                          className="inline-flex items-center gap-1 min-h-9 sm:min-h-7 px-2 text-xs text-slate-500 hover:text-red-700 rounded focus-visible:outline-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                    <textarea
                      value={slot.text}
                      onChange={(e) => {
                        if (e.target.value.trim().length > 0) {
                          onClearError();
                        }
                        onUpdatePastedSlot(slot.id, 'text', e.target.value);
                      }}
                      rows={pastedQuotes.length > 2 ? 5 : 6}
                      placeholder="Paste supplier quote text here (line items, CC#, MPN, prices, currency, freight/handling terms, lead time, payment terms, expiry date)..."
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-mono text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Bar: Optional Buyer Request + Submit CTA */}
          <div className="pt-4 border-t border-slate-200 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex-1">
              <label
                htmlFor="buyer-request-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Optional Buyer Request or Award Context
              </label>
              <input
                id="buyer-request-input"
                type="text"
                value={buyerRequest}
                onChange={(e) => onChangeBuyerRequest(e.target.value)}
                placeholder="e.g., Recommend the award so I can issue the PO today."
                className="w-full min-h-11 sm:min-h-10 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setFileReadErrors([]);
                  setIsConfirmingSample(false);
                  onSubmit();
                }}
                className="inline-flex items-center justify-center gap-2 min-h-11 sm:min-h-10 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition-opacity whitespace-nowrap shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Comparing Quotes...</span>
                  </>
                ) : (
                  <span>Compare Quotes</span>
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50/70 px-4 py-3 text-xs sm:text-sm text-red-900 font-medium"
            >
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
