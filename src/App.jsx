import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Users,
  Search,
  Lock,
  Unlock,
  Eye,
  Calendar,
  Home,
  Receipt,
  Sparkles,
  CheckCircle2,
  Info,
  Copy,
  Check,
  LayoutGrid,
  ArrowUpRight,
  ArrowDownRight,
  FileImage,
  HelpCircle,
  Cloud,
  AlertCircle,
  Edit3,
  Trash2,
  FileSpreadsheet,
  FileDown,
  Printer
} from 'lucide-react';
import {
  subscribeTransactions,
  createTransaction,
  updateTransaction,
  removeTransaction
} from './services/firebase';
import ReceiptModal from './components/ReceiptModal';
import PinModal from './components/PinModal';
import AdminConsole from './components/AdminConsole';
import FinancialReportModal from './components/FinancialReportModal';
import {
  sortDepositsByCamperAsc,
  sortExpensesByDate,
  getDepositAttendance
} from './utils/transactionSorter';
import {
  exportFinancialReportPdf,
  printFinancialReport
} from './utils/pdfReportGenerator';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(val) || 0);

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cloudStatus, setCloudStatus] = useState({ connected: true, error: null });

  // Navigation: 'all' | 'deposits' | 'expenses' | 'instructions'
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Admin State
  const [selectedReceiptTx, setSelectedReceiptTx] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [exportingPdfQuick, setExportingPdfQuick] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => {
    return sessionStorage.getItem('fiesta_jobos_admin_unlocked') === 'true';
  });
  const [copiedFormat, setCopiedFormat] = useState(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };

  const handleSelectTab = (nextTab) => {
    setActiveTab(nextTab);
    scrollToTop();
  };

  // Always scroll to the top whenever switching tabs or unlocking Admin mode
  useEffect(() => {
    scrollToTop();
  }, [activeTab, isAdmin]);

  useEffect(() => {
    const unsubscribe = subscribeTransactions(
      (items) => {
        setTransactions(items);
        setLoading(false);
      },
      (status) => {
        setCloudStatus(status);
        setLoading(false);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Totals & KPIs
  const stats = useMemo(() => {
    let totalDeposits = 0;
    let totalExpenses = 0;
    let totalAdults = 0;
    let totalChildren = 0;
    let totalPeople = 0;
    let depositCount = 0;
    let expenseCount = 0;
    const campersSet = new Set();

    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'deposit') {
        totalDeposits += amt;
        depositCount += 1;
        const att = getDepositAttendance(tx);
        totalAdults += att.adults;
        totalChildren += att.children;
        totalPeople += att.total;
        if (tx.camperNumber) {
          campersSet.add(tx.camperNumber.trim().toLowerCase());
        }
      } else if (tx.type === 'expense') {
        totalExpenses += amt;
        expenseCount += 1;
      }
    });

    return {
      totalDeposits,
      totalExpenses,
      balance: totalDeposits - totalExpenses,
      totalAdults,
      totalChildren,
      totalPeople,
      depositCount,
      expenseCount,
      totalCampers: campersSet.size
    };
  }, [transactions]);

  // Filtered & Sorted Transactions (Deposits by Camper # Asc, Expenses by Date)
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = transactions.filter((tx) => {
      if (activeTab === 'deposits' && tx.type !== 'deposit') return false;
      if (activeTab === 'expenses' && tx.type !== 'expense') return false;

      if (!q) return true;
      const fields = [
        tx.name,
        tx.camperNumber,
        tx.paidTo,
        tx.description,
        tx.category,
        tx.paymentMethod,
        tx.notes,
        tx.date,
        String(tx.amount || '')
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return fields.includes(q);
    });

    if (activeTab === 'deposits') {
      return sortDepositsByCamperAsc(matched);
    }
    if (activeTab === 'expenses') {
      return sortExpensesByDate(matched, 'asc');
    }

    const depositsSorted = sortDepositsByCamperAsc(
      matched.filter((tx) => tx.type === 'deposit')
    );
    const expensesSorted = sortExpensesByDate(
      matched.filter((tx) => tx.type === 'expense'),
      'asc'
    );
    return [...depositsSorted, ...expensesSorted];
  }, [transactions, activeTab, searchQuery]);

  const handleQuickExportPdf = async () => {
    try {
      setExportingPdfQuick(true);
      await exportFinancialReportPdf(transactions, stats);
    } finally {
      setExportingPdfQuick(false);
    }
  };

  const handleSaveTransaction = async (data) => {
    const saved = await createTransaction(data);
    setTransactions((prev) => {
      const filtered = prev.filter(
        (item) => item.id !== saved.id && item.createdAtMs !== saved.createdAtMs
      );
      return [saved, ...filtered];
    });
    return saved;
  };

  const handleUpdateTransaction = async (id, data) => {
    await updateTransaction(id, data);
    setTransactions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...data } : item))
    );
  };

  const handleDeleteTransaction = async (id) => {
    await removeTransaction(id);
    setTransactions((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCopyFormat = () => {
    navigator.clipboard?.writeText('Darinel Villegas - Camper 30 - 3');
    setCopiedFormat(true);
    setTimeout(() => setCopiedFormat(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-24 sm:pb-12">
      {/* Top Festive Banner & App Header */}
      <header className="festive-header-bg text-white shadow-xl sticky top-0 z-30 border-b border-emerald-800/80">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Logo & Title */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src="/logo.png"
                  alt="Jobos Campers Park Logo"
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-amber-300/90 shadow-lg bg-white"
                />
                <span
                  className="absolute -bottom-1 -right-1 text-sm sm:text-base bg-rose-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow border border-white"
                  title="Fiesta de Navidad"
                >
                  🎄
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-200 border border-amber-300/30">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    Jobos Campers Park
                  </span>
                </div>

                <h1 className="text-sm sm:text-xl md:text-2xl font-black tracking-tight text-white leading-snug line-clamp-2">
                  Informe de Ingresos y Gastos de Fiesta de Navidad
                </h1>
              </div>
            </div>

            {/* Admin Access Button */}
            <div className="shrink-0 flex items-center gap-2">
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelectTab('admin')}
                    className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm shadow-md transition ${
                      activeTab === 'admin'
                        ? 'bg-amber-400 text-slate-950 ring-2 ring-white'
                        : 'bg-amber-400/90 hover:bg-amber-300 text-slate-950'
                    }`}
                    title="Abrir Consola de Administración"
                  >
                    <Unlock className="w-4 h-4" />
                    <span className="hidden sm:inline">Consola Admin</span>
                    <span className="sm:hidden">Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.removeItem('fiesta_jobos_admin_unlocked');
                      setIsAdmin(false);
                      setEditingRecord(null);
                      if (activeTab === 'admin') setActiveTab('all');
                      scrollToTop();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition"
                    title="Salir del modo Administrador"
                  >
                    <Lock className="w-3.5 h-3.5 text-rose-300" />
                    <span>Salir</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setPinModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm transition"
                >
                  <Lock className="w-4 h-4 text-amber-300" />
                  <span>Admin</span>
                </button>
              )}
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <div className="hidden sm:flex items-center justify-between gap-3 mt-4 pt-3 border-t border-emerald-800/70">
            <nav className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleSelectTab('all')}
                className={`px-4 py-2 rounded-xl text-sm font-extrabold flex items-center gap-2 transition ${
                  activeTab === 'all'
                    ? 'bg-white text-emerald-950 shadow-md'
                    : 'text-emerald-100 hover:bg-white/10'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Resumen y Flujo ({transactions.length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('deposits')}
                className={`px-4 py-2 rounded-xl text-sm font-extrabold flex items-center gap-2 transition ${
                  activeTab === 'deposits'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'text-emerald-100 hover:bg-white/10'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Depósitos Recibidos ({stats.depositCount})</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('expenses')}
                className={`px-4 py-2 rounded-xl text-sm font-extrabold flex items-center gap-2 transition ${
                  activeTab === 'expenses'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-emerald-100 hover:bg-white/10'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                <span>Gastos Pagados ({stats.expenseCount})</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleSelectTab('admin')}
                  className={`px-4 py-2 rounded-xl text-sm font-extrabold flex items-center gap-2 transition ${
                    activeTab === 'admin'
                      ? 'bg-amber-400 text-slate-950 shadow-md'
                      : 'bg-white/10 text-amber-300 hover:bg-white/20'
                  }`}
                >
                  <Unlock className="w-4 h-4" />
                  <span>Entrar Depósito / Gasto</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Container (Independent screens per tab) */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6">
        {/* Cloud Firestore Notice if only visible to Admin when database rules need enabling */}
        {isAdmin && !cloudStatus.connected && (
          <div className="mb-5 bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3 text-amber-950">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <p className="font-extrabold">
                Aviso de Base de Datos Firebase (Proyecto: fiestajoboscampers):
              </p>
              <p className="mt-0.5">
                Para que los datos se sincronicen entre todos los teléfonos y computadoras, asegúrate de que en{' '}
                <strong>Firebase Console &rarr; Firestore Database</strong> hayas oprimido{' '}
                <strong>&ldquo;Create database&rdquo;</strong> y en la pestaña{' '}
                <strong>Rules (Reglas)</strong> permitas lectura y escritura (<code>allow read, write: if true;</code>).
              </p>
            </div>
          </div>
        )}

        {/* SCREEN 1: ADMIN CONSOLE VIEW (Shown at the very top when activeTab === 'admin') */}
        {isAdmin && activeTab === 'admin' && (
          <AdminConsole
            editingRecord={editingRecord}
            onClearEditingRecord={() => setEditingRecord(null)}
            onSaveTransaction={handleSaveTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onExitAdmin={() => {
              sessionStorage.removeItem('fiesta_jobos_admin_unlocked');
              setIsAdmin(false);
              setEditingRecord(null);
              setActiveTab('all');
              scrollToTop();
            }}
          />
        )}

        {/* SCREEN 2: RESUMEN (ALL) — Shows the 4 large KPI Summary Cards at the top */}
        {activeTab === 'all' && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-5">
              {/* Card 1: Balance Disponible */}
              <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-3xl p-5 shadow-lg border border-emerald-700 relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-200">
                    Balance Disponible
                  </span>
                  <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-amber-300" />
                  </div>
                </div>
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                  {formatCurrency(stats.balance)}
                </div>
                <p className="text-xs text-emerald-200 mt-1.5 font-medium">
                  Fondos netos actuales para la Fiesta
                </p>
              </div>

              {/* Card 2: Total Recaudado (Depósitos) */}
              <div
                onClick={() => handleSelectTab('deposits')}
                className="bg-white rounded-3xl p-5 shadow-sm border-2 border-emerald-200 hover:border-emerald-400 cursor-pointer transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                    Total Depósitos (Ingresos)
                  </span>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-700">
                  +{formatCurrency(stats.totalDeposits)}
                </div>
                <p className="text-xs text-emerald-700 mt-1.5 font-bold underline">
                  Ver {stats.depositCount} {stats.depositCount === 1 ? 'depósito' : 'depósitos'} &rarr;
                </p>
              </div>

              {/* Card 3: Total Gastos Pagados */}
              <div
                onClick={() => handleSelectTab('expenses')}
                className="bg-white rounded-3xl p-5 shadow-sm border-2 border-rose-200 hover:border-rose-400 cursor-pointer transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-rose-800">
                    Total Gastos Pagados
                  </span>
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-rose-700">
                  -{formatCurrency(stats.totalExpenses)}
                </div>
                <p className="text-xs text-rose-700 mt-1.5 font-bold underline">
                  Ver {stats.expenseCount} {stats.expenseCount === 1 ? 'gasto con recibo' : 'gastos con recibo'} &rarr;
                </p>
              </div>

              {/* Card 4: Personas y Campers Confirmados */}
              <div
                onClick={() => handleSelectTab('deposits')}
                className="bg-white rounded-3xl p-5 shadow-sm border-2 border-blue-200 hover:border-blue-400 cursor-pointer transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-blue-900">
                    Asistencia Confirmada
                  </span>
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-blue-900">
                      {stats.totalAdults}
                    </span>
                    <span className="text-sm font-bold text-slate-700">
                      {stats.totalAdults === 1 ? 'Adulto' : 'Adultos'}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-400">y</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-amber-600">
                      {stats.totalChildren}
                    </span>
                    <span className="text-sm font-bold text-slate-700">
                      {stats.totalChildren === 1 ? 'Niño' : 'Niños'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 font-semibold">
                  De {stats.totalCampers}{' '}
                  {stats.totalCampers === 1 ? 'Camper participante' : 'Campers participantes'}
                </p>
              </div>
            </section>

            {/* Financial Statement Report Banner (Connected to Resumen) */}
            <section className="bg-white rounded-3xl p-4 sm:p-5 mb-5 shadow-sm border-2 border-emerald-300 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-emerald-900 text-amber-300 flex items-center justify-center shrink-0 shadow-sm">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                      Estado Financiero Oficial
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5 leading-snug">
                    Informe de Ingresos y Gastos — Fiesta de Navidad Jobos Campers Park
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    Reporte resumido tipo Estado Financiero con ingresos por # de Camper, gastos por fecha y balance disponible para exportar en PDF o imprimir.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-900 hover:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm shadow transition"
                >
                  <FileSpreadsheet className="w-4 h-4 text-amber-300" />
                  <span>Ver Estado Financiero</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickExportPdf}
                  disabled={exportingPdfQuick}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm shadow-sm transition"
                >
                  <FileDown className="w-4 h-4" />
                  <span>{exportingPdfQuick ? 'Generando...' : 'Exportar PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => printFinancialReport(transactions, stats)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm shadow-sm transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>
              </div>
            </section>
          </>
        )}

        {/* SCREEN 3: DEDICATED DEPOSITS HEADER (Shown right at the top when activeTab === 'deposits') */}
        {activeTab === 'deposits' && (
          <section className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-3xl p-5 sm:p-6 mb-5 shadow-lg border border-emerald-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider bg-emerald-500/25 text-emerald-200 px-3 py-1 rounded-full border border-emerald-400/30 mb-2">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Sección de Ingresos
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Depósitos Recibidos
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100 mt-1">
                  Pagos confirmados por residentes para la Fiesta de Navidad ({stats.totalAdults}{' '}
                  {stats.totalAdults === 1 ? 'Adulto' : 'Adultos'} y {stats.totalChildren}{' '}
                  {stats.totalChildren === 1 ? 'Niño' : 'Niños'} de {stats.totalCampers}{' '}
                  {stats.totalCampers === 1 ? 'Camper' : 'Campers'})
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/15 text-left sm:text-right shrink-0">
                <span className="text-xs uppercase tracking-wider text-emerald-200 font-bold block">
                  Total Recaudado ({stats.depositCount})
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-300">
                  +{formatCurrency(stats.totalDeposits)}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* SCREEN 4: DEDICATED EXPENSES HEADER (Shown right at the top when activeTab === 'expenses') */}
        {activeTab === 'expenses' && (
          <section className="bg-gradient-to-r from-rose-900 via-rose-800 to-red-900 text-white rounded-3xl p-5 sm:p-6 mb-5 shadow-lg border border-rose-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider bg-rose-500/25 text-rose-200 px-3 py-1 rounded-full border border-rose-400/30 mb-2">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Sección de Desembolsos y Facturas
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Gastos Pagados
                </h2>
                <p className="text-xs sm:text-sm text-rose-100 mt-1">
                  Cada gasto cuenta con su recibo o factura adjunta para inspección (toca &ldquo;📷 Ver Recibo&rdquo;)
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/15 text-left sm:text-right shrink-0">
                <span className="text-xs uppercase tracking-wider text-rose-200 font-bold block">
                  Total Gastado ({stats.expenseCount})
                </span>
                <span className="text-2xl sm:text-3xl font-black text-rose-200">
                  -{formatCurrency(stats.totalExpenses)}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* SCREEN 5: ATH MOVIL INSTRUCTIONS VIEW (Shown right at the top when activeTab === 'instructions') */}
        {activeTab === 'instructions' && (
          <section className="bg-white rounded-3xl shadow-md border-2 border-amber-300 p-5 sm:p-8 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
              <div className="flex items-center gap-3.5">
                <img
                  src="/ath_logo_circle.png"
                  alt="ATH Móvil"
                  className="w-14 h-14 rounded-2xl bg-orange-50 p-1.5 border border-orange-200 object-contain"
                />
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    Instrucciones para Residentes
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    ¿Cómo enviar tu aportación por ATH Móvil?
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectTab('all')}
                className="self-start md:self-auto px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-bold"
              >
                &larr; Volver al Resumen
              </button>
            </div>

            <div className="max-w-2xl mx-auto mt-6">
              <div className="space-y-4">
                {/* ATH Movil Recipient Info Box */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-orange-400">
                  <p className="text-xs uppercase tracking-wider text-orange-100 font-extrabold mb-1">
                    📱 Enviar pago por ATH Móvil a:
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                    <div>
                      <p className="text-2xl sm:text-3xl font-black tracking-wider text-white">
                        787-598-3594
                      </p>
                      <p className="text-sm font-bold text-orange-100 mt-0.5">
                        A nombre de: <span className="text-white underline decoration-white/60">Edgar Arroyo</span>
                      </p>
                    </div>
                    <a
                      href="tel:7875983594"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-orange-800 font-bold text-xs shadow hover:bg-orange-50 transition"
                    >
                      Copiar / Llamar
                    </a>
                  </div>
                </div>

                <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                  Para que el sistema registre tu pago de inmediato con tu nombre, número de camper y cantidad de personas que asistirán a la{' '}
                  <strong>Fiesta de Navidad de Jobos Campers Park</strong>, escribe el mensaje de{' '}
                  <strong>ATH Móvil</strong> exactamente con este formato separado por guiones:
                </p>

                <div className="bg-emerald-950 text-white p-4 sm:p-5 rounded-2xl border-2 border-emerald-500 shadow-inner">
                  <p className="text-xs uppercase tracking-wider text-emerald-300 font-bold mb-1">
                    Formato requerido en el mensaje de ATH Móvil:
                  </p>
                  <p className="text-base sm:text-lg font-mono font-extrabold text-amber-300">
                    Nombre - Camper # - # personas
                  </p>
                  <div className="mt-3 pt-3 border-t border-emerald-800 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs text-emerald-200 block">Ejemplo exacto:</span>
                      <span className="text-sm sm:text-base font-extrabold text-white">
                        Darinel Villegas - Camper 30 - 3
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyFormat}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shrink-0 transition"
                    >
                      {copiedFormat ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedFormat ? '¡Copiado!' : 'Copiar Ejemplo'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Filter & Search Bar */}
        {activeTab !== 'instructions' && (
          <section className="bg-white rounded-3xl p-3.5 sm:p-4 shadow-sm border border-slate-200 mb-5">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Mobile & Tablet Filter Pills */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleSelectTab('all')}
                  className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition ${
                    activeTab === 'all'
                      ? 'bg-slate-900 text-white shadow'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({transactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTab('deposits')}
                  className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition ${
                    activeTab === 'deposits'
                      ? 'bg-emerald-700 text-white shadow'
                      : 'text-emerald-800 hover:bg-emerald-50'
                  }`}
                >
                  Depósitos ({stats.depositCount})
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTab('expenses')}
                  className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition ${
                    activeTab === 'expenses'
                      ? 'bg-rose-700 text-white shadow'
                      : 'text-rose-800 hover:bg-rose-50'
                  }`}
                >
                  Gastos ({stats.expenseCount})
                </button>
              </div>

              {/* Search Input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, # de Camper (ej. 30) o gasto..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-600 focus:outline-none text-sm font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 hover:text-slate-700 px-1.5 py-0.5"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Transactions Feed (Easy-to-follow visual cards for Mobile & Desktop) */}
        {activeTab !== 'instructions' && (
          <section className="space-y-3.5">
            {loading ? (
              <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-200">
                <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-base font-bold text-slate-700">
                  Cargando informe de ingresos y gastos...
                </p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 sm:p-12 text-center shadow-sm border border-slate-200">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                  <Receipt className="w-8 h-8" />
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {searchQuery
                    ? 'No se encontraron registros con esa búsqueda'
                    : activeTab === 'deposits'
                    ? 'Aún no se han registrado depósitos'
                    : activeTab === 'expenses'
                    ? 'Aún no se han registrado gastos pagados'
                    : 'Todavía no hay transacciones registradas'}
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                  {searchQuery
                    ? 'Intenta escribir otro nombre o número de Camper.'
                    : 'Tan pronto se reciban los depósitos de ATH Móvil o se registren pagos de gastos, aparecerán aquí automáticamente con sus recibos.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredTransactions.map((tx) => {
                  const isDeposit = tx.type === 'deposit';
                  return (
                    <article
                      key={tx.id}
                      className={`bg-white rounded-3xl p-4 sm:p-5 shadow-sm border-2 transition hover:shadow-md ${
                        isDeposit
                          ? 'border-emerald-200/90 hover:border-emerald-400'
                          : 'border-rose-200/90 hover:border-rose-400'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Left: Icon + Details */}
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div
                            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                              isDeposit
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {isDeposit ? (
                              <ArrowUpRight className="w-6 h-6 sm:w-7 sm:h-7" />
                            ) : (
                              <ArrowDownRight className="w-6 h-6 sm:w-7 sm:h-7" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            {/* Top Badges */}
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span
                                className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                  isDeposit
                                    ? 'bg-emerald-700 text-white'
                                    : 'bg-rose-700 text-white'
                                }`}
                              >
                                {isDeposit ? 'Depósito Recibido' : 'Gasto Pagado'}
                              </span>

                              {isDeposit && tx.camperNumber && (
                                <span className="inline-flex items-center gap-1 text-xs font-extrabold bg-emerald-100 text-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                  <Home className="w-3.5 h-3.5 text-emerald-700" />
                                  {tx.camperNumber}
                                </span>
                              )}

                              {isDeposit && (() => {
                                const att = getDepositAttendance(tx);
                                return (
                                  <>
                                    {att.adults > 0 && (
                                      <span className="inline-flex items-center gap-1 text-xs font-extrabold bg-blue-100 text-blue-950 px-2.5 py-0.5 rounded-full border border-blue-200">
                                        <Users className="w-3.5 h-3.5 text-blue-700" />
                                        {att.adults} {att.adults === 1 ? 'Adulto' : 'Adultos'}
                                      </span>
                                    )}
                                    {att.children > 0 && (
                                      <span className="inline-flex items-center gap-1 text-xs font-extrabold bg-amber-100 text-amber-950 px-2.5 py-0.5 rounded-full border border-amber-300">
                                        <Users className="w-3.5 h-3.5 text-amber-700" />
                                        {att.children} {att.children === 1 ? 'Niño' : 'Niños'}
                                      </span>
                                    )}
                                  </>
                                );
                              })()}

                              {!isDeposit && tx.category && (
                                <span className="text-xs font-bold bg-rose-50 text-rose-800 px-2.5 py-0.5 rounded-full border border-rose-200">
                                  {tx.category}
                                </span>
                              )}
                            </div>

                            {/* Main Title: Person Name or PaidTo */}
                            <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug break-words">
                              {isDeposit ? tx.name : `Pagado a: ${tx.paidTo}`}
                            </h3>

                            {/* Subtitle: Description or Payment Method + Date */}
                            {!isDeposit && tx.description && (
                              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                                {tx.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500 font-medium">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {tx.date || 'Fecha registrada'}
                              </span>

                              {isDeposit && (
                                <span className="inline-flex items-center gap-1 font-bold text-slate-600">
                                  • Vía {tx.paymentMethod || 'ATH Móvil'}
                                </span>
                              )}

                              {tx.notes && (
                                <span className="text-slate-500 italic">• {tx.notes}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Amount + View Receipt Button + Admin Inline Actions */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 shrink-0">
                          <div
                            className={`text-xl sm:text-2xl font-black tracking-tight px-3.5 py-1 rounded-2xl ${
                              isDeposit
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isDeposit ? '+' : '-'}
                            {formatCurrency(tx.amount)}
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {/* Expenses: Everyone can view the receipt image */}
                            {!isDeposit && tx.receiptImage && (
                              <button
                                type="button"
                                onClick={() => setSelectedReceiptTx(tx)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl font-extrabold text-xs sm:text-sm shadow-sm transition bg-rose-700 hover:bg-rose-800 text-white"
                              >
                                <Eye className="w-4 h-4" />
                                <span>📷 Ver Recibo</span>
                              </button>
                            )}

                            {/* Deposits: ONLY Admin can view the receipt image to protect payer privacy */}
                            {isDeposit && isAdmin && (
                              tx.receiptImage ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedReceiptTx(tx)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-extrabold text-xs sm:text-sm shadow-sm transition bg-emerald-700 hover:bg-emerald-800 text-white"
                                  title="Solo visible para el Administrador"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span>🔒 Ver Recibo (Admin)</span>
                                </button>
                              ) : (
                                <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl">
                                  {tx.paymentMethod?.toLowerCase().includes('cash')
                                    ? '💵 Cash (Sin foto)'
                                    : 'Sin imagen'}
                                </span>
                              )
                            )}

                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRecord({ ...tx, _editTs: Date.now() });
                                    setActiveTab('admin');
                                    scrollToTop();
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-extrabold text-xs sm:text-sm border border-amber-300 transition shadow-sm"
                                  title="Editar este registro"
                                >
                                  <Edit3 className="w-4 h-4" />
                                  <span>Editar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `¿Seguro que deseas eliminar este registro de ${
                                          isDeposit ? tx.name : tx.paidTo
                                        } por ${formatCurrency(tx.amount)}?`
                                      )
                                    ) {
                                      handleDeleteTransaction(tx.id);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs sm:text-sm border border-rose-200 transition"
                                  title="Eliminar este registro"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span className="hidden md:inline">Borrar</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 bg-white border-t border-slate-200 text-center text-xs sm:text-sm text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <img src="/logo.png" alt="Logo" className="w-6 h-6 rounded-full object-cover" />
            <span>Jobos Campers Park — Comité Fiesta de Navidad</span>
          </div>
          <p>Portal de Transparencia de Ingresos y Gastos • Actualizado en Tiempo Real</p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar (Thumb-friendly for mobile phones) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 pb-[env(safe-area-inset-bottom)] shadow-lg">
        <div className="grid grid-cols-3 h-16">
          <button
            type="button"
            onClick={() => handleSelectTab('all')}
            className={`flex flex-col items-center justify-center gap-1 ${
              activeTab === 'all' ? 'text-emerald-700 font-extrabold' : 'text-slate-500 font-semibold'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px]">Resumen</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('deposits')}
            className={`flex flex-col items-center justify-center gap-1 ${
              activeTab === 'deposits'
                ? 'text-emerald-700 font-extrabold'
                : 'text-slate-500 font-semibold'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px]">Depósitos ({stats.depositCount})</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('expenses')}
            className={`flex flex-col items-center justify-center gap-1 ${
              activeTab === 'expenses'
                ? 'text-rose-700 font-extrabold'
                : 'text-slate-500 font-semibold'
            }`}
          >
            <TrendingDown className="w-5 h-5" />
            <span className="text-[10px]">Gastos ({stats.expenseCount})</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      <ReceiptModal
        transaction={selectedReceiptTx}
        isAdmin={isAdmin}
        onClose={() => setSelectedReceiptTx(null)}
      />

      <FinancialReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        transactions={transactions}
        stats={stats}
      />

      <PinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={() => {
          sessionStorage.setItem('fiesta_jobos_admin_unlocked', 'true');
          setIsAdmin(true);
          setActiveTab('admin');
          setPinModalOpen(false);
          scrollToTop();
        }}
      />
    </div>
  );
}
