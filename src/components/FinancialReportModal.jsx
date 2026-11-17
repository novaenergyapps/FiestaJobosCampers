import React, { useState, useMemo } from 'react';
import {
  X,
  FileDown,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Wallet
} from 'lucide-react';
import {
  parseCamperKey,
  formatShortDate,
  getFormattedTodaySpanish,
  sortDepositsByCamperAsc,
  sortExpensesByDate
} from '../utils/transactionSorter';
import {
  exportFinancialReportPdf,
  printFinancialReport
} from '../utils/pdfReportGenerator';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(val) || 0);

export default function FinancialReportModal({
  isOpen,
  onClose,
  transactions = [],
  stats = {}
}) {
  const [exportingPdf, setExportingPdf] = useState(false);

  const todayFormatted = useMemo(() => getFormattedTodaySpanish(), []);

  const sortedDeposits = useMemo(() => {
    const raw = transactions.filter((tx) => tx.type === 'deposit');
    return sortDepositsByCamperAsc(raw);
  }, [transactions]);

  const sortedExpenses = useMemo(() => {
    const raw = transactions.filter((tx) => tx.type === 'expense');
    return sortExpensesByDate(raw, 'asc');
  }, [transactions]);

  if (!isOpen) return null;

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      await exportFinancialReportPdf(transactions, stats);
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrint = () => {
    printFinancialReport(transactions, stats);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-100 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-300 overflow-hidden my-auto flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Action Toolbar */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-300 shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold tracking-wide uppercase text-slate-200">
              Vista Previa del Estado Financiero
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm shadow transition"
            >
              <FileDown className="w-4 h-4" />
              <span>{exportingPdf ? 'Generando PDF...' : 'Exportar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm shadow transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              aria-label="Cerrar reporte"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Financial Report Document Sheet */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-4 sm:p-8 max-w-3xl mx-auto">
            {/* REPORT HEADER: Logo + "Fiesta de Navidad Jobos Campers Park" + "Informe de Ingresos y Gastos" + Date */}
            <div className="festive-header-bg text-white rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center sm:items-center gap-4 text-center sm:text-left shadow-md mb-6 border border-emerald-800">
              <img
                src="/logo.png"
                alt="Fiesta de Navidad Jobos Campers Park Logo"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-amber-300 shadow-lg bg-white shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white leading-tight">
                  Fiesta de Navidad Jobos Campers Park
                </h1>
                <h2 className="text-sm sm:text-lg font-extrabold text-amber-300 mt-1">
                  Informe de Ingresos y Gastos
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100 mt-1 font-medium">
                  Fecha: {todayFormatted}
                </p>
              </div>
            </div>

            {/* EXECUTIVE FINANCIAL STATEMENT SUMMARY (ESTADO FINANCIERO) */}
            <div className="mb-6 rounded-2xl border-2 border-slate-200 overflow-hidden bg-slate-50">
              <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs font-extrabold uppercase tracking-wider">
                <span>Estado Financiero — Resumen General</span>
                <span>Importe (USD)</span>
              </div>

              <div className="divide-y divide-slate-200 text-xs sm:text-sm">
                <div className="px-4 py-3 flex items-center justify-between gap-2 bg-white">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold">
                    <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Total de Ingresos — Depósitos Recibidos ({stats.depositCount || 0}{' '}
                      {stats.depositCount === 1 ? 'depósito' : 'depósitos'} •{' '}
                      {stats.totalCampers || 0}{' '}
                      {stats.totalCampers === 1 ? 'camper' : 'campers'} •{' '}
                      {stats.totalPeople || 0}{' '}
                      {stats.totalPeople === 1 ? 'persona' : 'personas'})
                    </span>
                  </div>
                  <span className="font-black text-emerald-700 shrink-0 text-sm sm:text-base">
                    +{formatCurrency(stats.totalDeposits)}
                  </span>
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-2 bg-white">
                  <div className="flex items-center gap-2 text-rose-900 font-bold">
                    <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Menos: Total de Gastos Pagados ({stats.expenseCount || 0}{' '}
                      {stats.expenseCount === 1 ? 'gasto' : 'gastos'})
                    </span>
                  </div>
                  <span className="font-black text-rose-700 shrink-0 text-sm sm:text-base">
                    -{formatCurrency(stats.totalExpenses)}
                  </span>
                </div>

                <div className="px-4 py-3.5 flex items-center justify-between gap-2 bg-emerald-50/90 border-t-2 border-slate-300">
                  <div className="flex items-center gap-2 text-slate-950 font-black text-sm sm:text-base">
                    <Wallet className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>BALANCE NETO DISPONIBLE (INGRESOS - GASTOS)</span>
                  </div>
                  <span className="font-black text-emerald-800 text-base sm:text-lg shrink-0">
                    {formatCurrency(stats.balance)}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION I: SUMMARIZED DEPOSITS (SORTED BY CAMPER # ASCENDING) */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-2">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-900">
                  I. Detalle de Ingresos — Depósitos Recibidos ({sortedDeposits.length})
                </h3>
                <span className="text-[11px] font-semibold text-slate-500">
                  Ordenado por Número de Camper (Ascendente)
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-emerald-800 text-white uppercase text-[11px] font-extrabold tracking-wider">
                      <th className="py-2.5 px-3 border-b border-emerald-700"># Camper</th>
                      <th className="py-2.5 px-3 border-b border-emerald-700">
                        Residente / Familia
                      </th>
                      <th className="py-2.5 px-2.5 border-b border-emerald-700 text-center">
                        Pers.
                      </th>
                      <th className="py-2.5 px-2.5 border-b border-emerald-700 text-center">
                        Fecha
                      </th>
                      <th className="py-2.5 px-3 border-b border-emerald-700 text-right">
                        Monto
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sortedDeposits.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-6 text-center text-slate-500 italic bg-white"
                        >
                          No hay depósitos registrados hasta el momento.
                        </td>
                      </tr>
                    ) : (
                      sortedDeposits.map((tx, idx) => (
                        <tr
                          key={tx.id || idx}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/40'}
                        >
                          <td className="py-2 px-3 font-extrabold text-emerald-950 whitespace-nowrap">
                            {parseCamperKey(tx.camperNumber).display}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {tx.name || 'Residente'}
                          </td>
                          <td className="py-2 px-2.5 text-center font-bold text-slate-700">
                            {tx.peopleCount || 1}
                          </td>
                          <td className="py-2 px-2.5 text-center text-slate-600 whitespace-nowrap text-xs">
                            {formatShortDate(tx.date)}
                          </td>
                          <td className="py-2 px-3 text-right font-extrabold text-emerald-700 whitespace-nowrap">
                            +{formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-100/90 border-t-2 border-emerald-500 font-black text-emerald-950 text-xs sm:text-sm">
                      <td colSpan={2} className="py-2.5 px-3">
                        TOTAL DE INGRESOS ({stats.depositCount || 0} depósitos •{' '}
                        {stats.totalCampers || 0} campers)
                      </td>
                      <td className="py-2.5 px-2.5 text-center">
                        {stats.totalPeople || 0} pers.
                      </td>
                      <td className="py-2.5 px-2.5" />
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        +{formatCurrency(stats.totalDeposits)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* SECTION II: SUMMARIZED EXPENSES (SORTED BY DATE) */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-2">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-rose-900">
                  II. Detalle de Gastos — Desembolsos Pagados ({sortedExpenses.length})
                </h3>
                <span className="text-[11px] font-semibold text-slate-500">
                  Ordenado por Fecha
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-rose-800 text-white uppercase text-[11px] font-extrabold tracking-wider">
                      <th className="py-2.5 px-3 border-b border-rose-700">Fecha</th>
                      <th className="py-2.5 px-3 border-b border-rose-700">
                        Pagado a (Suplidor / Comercio)
                      </th>
                      <th className="py-2.5 px-3 border-b border-rose-700">
                        Concepto Resumido
                      </th>
                      <th className="py-2.5 px-3 border-b border-rose-700 text-right">
                        Monto
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sortedExpenses.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-6 text-center text-slate-500 italic bg-white"
                        >
                          No hay gastos registrados hasta el momento.
                        </td>
                      </tr>
                    ) : (
                      sortedExpenses.map((tx, idx) => {
                        const summaryConcept = tx.description
                          ? tx.category
                            ? `${tx.description} (${tx.category})`
                            : tx.description
                          : tx.category || 'Gasto pagado';
                        return (
                          <tr
                            key={tx.id || idx}
                            className={idx % 2 === 0 ? 'bg-white' : 'bg-rose-50/40'}
                          >
                            <td className="py-2 px-3 text-slate-600 whitespace-nowrap text-xs">
                              {formatShortDate(tx.date)}
                            </td>
                            <td className="py-2 px-3 font-extrabold text-slate-900">
                              {tx.paidTo || 'Suplidor'}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {summaryConcept}
                            </td>
                            <td className="py-2 px-3 text-right font-extrabold text-rose-700 whitespace-nowrap">
                              -{formatCurrency(tx.amount)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-rose-100/90 border-t-2 border-rose-500 font-black text-rose-950 text-xs sm:text-sm">
                      <td colSpan={3} className="py-2.5 px-3">
                        TOTAL DE GASTOS PAGADOS ({stats.expenseCount || 0}{' '}
                        {stats.expenseCount === 1 ? 'gasto' : 'gastos'})
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        -{formatCurrency(stats.totalExpenses)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* CLOSING FINANCIAL STATEMENT BALANCE BAR */}
            <div className="bg-emerald-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-200">
                  Cierre del Estado Financiero
                </p>
                <p className="text-xs sm:text-sm font-bold text-white mt-0.5">
                  Ingresos (+{formatCurrency(stats.totalDeposits)}) menos Gastos (-
                  {formatCurrency(stats.totalExpenses)})
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[11px] uppercase tracking-wider text-emerald-200 font-bold block">
                  Balance Disponible
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-300">
                  {formatCurrency(stats.balance)}
                </span>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] sm:text-xs text-slate-500 italic">
              Nota: Este reporte muestra el resumen de cada registro como Estado Financiero. El
              detalle completo y las imágenes de los recibos están disponibles en la aplicación.
            </p>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm shadow transition"
            >
              <FileDown className="w-4 h-4" />
              <span>{exportingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Reporte</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
