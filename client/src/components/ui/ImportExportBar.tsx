import React, { useState, useRef } from 'react';
import { Download, Upload, CheckCircle2, AlertTriangle, Key, X, FileText } from 'lucide-react';
import api from '../../lib/api';
import { Modal } from './Modal';
import { useToast } from '../../context/ToastContext';
import { CsvImportSummary } from '../../types';

interface ImportExportBarProps {
  entityName: string; // e.g. "Departments", "Staff", "Sections"
  exportUrl?: string;
  pdfExportUrl?: string;
  importUrl?: string;
  onImportSuccess?: () => void;
  exportFilename?: string;
  pdfFilename?: string;
  queryParams?: Record<string, any>;
}

export const ImportExportBar: React.FC<ImportExportBarProps> = ({
  entityName,
  exportUrl,
  pdfExportUrl,
  importUrl,
  onImportSuccess,
  exportFilename,
  pdfFilename,
  queryParams = {},
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [importSummary, setImportSummary] = useState<CsvImportSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { showToast } = useToast();

  const handleExport = async () => {
    if (!exportUrl) return;
    try {
      setIsExporting(true);
      const res = await api.get(exportUrl, {
        params: queryParams,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const filename = exportFilename || `${entityName.toLowerCase().replace(/\s+/g, '_')}_export.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`${entityName} CSV downloaded successfully`, 'success');
    } catch (err: any) {
      showToast(err.customMessage || `Error exporting ${entityName} CSV`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!pdfExportUrl) return;
    try {
      setIsExportingPdf(true);
      const res = await api.get(pdfExportUrl, {
        params: queryParams,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const filename = pdfFilename || `${entityName.toLowerCase().replace(/\s+/g, '_')}_export.pdf`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`${entityName} PDF downloaded successfully`, 'success');
    } catch (err: any) {
      showToast(err.customMessage || `Error exporting ${entityName} PDF`, 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!importUrl) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      const res = await api.post(importUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setImportSummary(res.data);
      setSummaryModalOpen(true);
      showToast(`${entityName} CSV processed`, 'success');

      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (err: any) {
      showToast(err.customMessage || `Error importing ${entityName} CSV`, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {importUrl && (
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id={`csv-import-${entityName.replace(/\s+/g, '-')}`}
          />
        )}

        {exportUrl && (
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
            title={`Export ${entityName} to CSV`}
          >
            {isExporting ? (
              <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>Export CSV</span>
          </button>
        )}

        {pdfExportUrl && (
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-rose-50/50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-700 flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
            title={`Export ${entityName} to PDF`}
          >
            {isExportingPdf ? (
              <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-rose-600" />
            )}
            <span>Export PDF</span>
          </button>
        )}

        {importUrl && (
          <label
            htmlFor={`csv-import-${entityName.replace(/\s+/g, '-')}`}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-2 transition-colors cursor-pointer shadow-sm ${
              isUploading ? 'opacity-50 pointer-events-none' : ''
            }`}
            title={`Import ${entityName} from CSV`}
          >
            {isUploading ? (
              <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>Import CSV</span>
          </label>
        )}
      </div>

      {/* CSV Import Results Modal */}
      <Modal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        title={`${entityName} Import Summary`}
        subtitle="Review the processed records and any row-level notices"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {/* Stat Pills */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[11px] text-slate-500 font-medium">Total Rows</p>
              <p className="text-base font-bold text-slate-900 tabular-nums">{importSummary?.totalRows || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-[11px] text-emerald-700 font-medium">Created</p>
              <p className="text-base font-bold text-emerald-700 tabular-nums">{importSummary?.created || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-[11px] text-blue-700 font-medium">Updated</p>
              <p className="text-base font-bold text-blue-700 tabular-nums">{importSummary?.updated || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-[11px] text-amber-700 font-medium">Skipped/Errors</p>
              <p className="text-base font-bold text-amber-700 tabular-nums">{importSummary?.skipped || 0}</p>
            </div>
          </div>

          {/* Temporary Passwords Box (for Staff import) */}
          {importSummary?.passwords && importSummary.passwords.length > 0 && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-800">
                <Key className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Temporary Passwords Generated ({importSummary.passwords.length})</span>
              </div>
              <p className="text-[11px] text-slate-600">
                <strong>Important:</strong> Share securely with the respective users. Instruct users to update their password on first login.
              </p>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-blue-200 divide-y divide-blue-100 bg-white shadow-inner">
                {importSummary.passwords.map((p, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800">{p.name}</span>
                      <span className="text-slate-500 ml-2">({p.email})</span>
                    </div>
                    <code className="font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                      {p.temporaryPassword}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors / Row Notices */}
          {importSummary?.errors && importSummary.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>Row Notices & Errors ({importSummary.errors.length})</span>
              </h4>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-rose-200 divide-y divide-rose-100 bg-rose-50/40">
                {importSummary.errors.map((err, idx) => (
                  <div key={idx} className="p-2.5 flex items-start gap-3 text-xs">
                    <span className="font-mono text-rose-700 font-bold shrink-0">Line {err.row}:</span>
                    <span className="text-rose-900">{err.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSummaryModalOpen(false)}
              className="px-5 py-2 rounded-xl text-xs font-semibold gradient-btn"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
