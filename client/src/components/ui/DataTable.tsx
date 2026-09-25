import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { SkeletonRow } from './SkeletonRow';
import { motion, AnimatePresence } from 'framer-motion';

export interface Column<T> {
  header: string;
  accessor?: keyof T | ((row: T) => React.ReactNode);
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  searchPlaceholder = 'Search records...',
  searchFilter,
  pageSize = 10,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching the criteria.',
  actions,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    if (searchFilter) {
      return data.filter((row) => searchFilter(row, searchQuery.toLowerCase().trim()));
    }
    // Default search across all string values
    return data.filter((row) =>
      Object.values(row).some(
        (val) => typeof val === 'string' && val.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    );
  }, [data, searchQuery, searchFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {searchFilter !== undefined && (
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm"
            />
          </div>
        )}
        <div className="flex items-center gap-3 ml-auto">{actions}</div>
      </div>

      {/* Table / Mobile Card Container */}
      <div className="w-full md:rounded-2xl md:bg-white md:border md:border-slate-200/80 md:shadow-sm md:overflow-x-auto">
        <table className="w-full text-left text-xs md:text-sm border-collapse block md:table">
          <thead className="hidden md:table-header-group sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm border-b border-slate-200 text-[11px] md:text-xs uppercase tracking-wider text-slate-600">
            <tr className="md:table-row">
              {columns.map((col, idx) => (
                <th key={idx} className={`py-3 px-3.5 md:py-3.5 md:px-4 font-semibold whitespace-nowrap ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="block md:table-row-group space-y-3 md:space-y-0 divide-y-0 md:divide-y md:divide-slate-100">
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <SkeletonRow key={i} columns={columns.length} />
              ))
            ) : paginatedData.length > 0 ? (
              paginatedData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="block bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-2 md:space-y-0 md:p-0 md:border-0 md:rounded-none md:shadow-none md:table-row hover:bg-slate-50/80 transition-colors"
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`flex items-center justify-between gap-3 py-1.5 px-0 border-b border-slate-100/70 last:border-b-0 md:border-none md:table-cell md:py-3.5 md:px-4 text-slate-700 whitespace-normal md:whitespace-nowrap text-xs md:text-sm ${col.className || ''}`}
                    >
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider md:hidden shrink-0">
                        {col.header}
                      </span>
                      <div className="text-right md:text-left flex items-center justify-end md:justify-start">
                        {col.render
                          ? col.render(row)
                          : typeof col.accessor === 'function'
                          ? col.accessor(row)
                          : col.accessor
                          ? row[col.accessor]
                          : null}
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr className="block md:table-row bg-white p-6 rounded-2xl border border-slate-200/90 md:border-0 md:p-0">
                <td colSpan={columns.length} className="block md:table-cell py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-2">
                      <Inbox className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="font-semibold text-slate-800 text-xs md:text-sm">{emptyTitle}</p>
                    <p className="text-[11px] md:text-xs text-slate-500 mt-0.5">{emptyDescription}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination row */}
      {!isLoading && filteredData.length > pageSize && (
        <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500">
          <div>
            Showing <span className="text-slate-800 font-semibold">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="text-slate-800 font-semibold">
              {Math.min(currentPage * pageSize, filteredData.length)}
            </span>{' '}
            of <span className="text-slate-800 font-semibold">{filteredData.length}</span> entries
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700 shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
