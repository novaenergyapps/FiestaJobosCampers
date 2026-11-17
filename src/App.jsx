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
  AlertCircle
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
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => {
    return sessionStorage.getItem('fiesta_jobos_admin_unlocked') === 'true';
  });
  const [copiedFormat, setCopiedFormat] = useState(false);

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
    let totalPeople = 0;
    let depositCount = 0;
    let expenseCount = 0;
    const campersSet = new Set();

    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'deposit') {
        totalDeposits += amt;
        depositCount += 1;
        totalPeople += Number(tx.peopleCount) || 0;
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
      totalPeople,
      depositCount,
      expenseCount,
      totalCampers: campersSet.size
    };
  }, [transactions]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
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
  }, [transactions, activeTab, searchQuery]);

  const handleSaveTransaction = async (data) => {
    const saved = await createTransaction(data);
    if (!cloudStatus.connected) {
      setTransactions((prev) => [saved, ...prev]);
    }
    return saved;
  };

  const handleUpdateTransaction = async (id, data) => {
    await updateTransaction(id, data);
    if (!cloudStatus.connected) {
      setTransactions((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
    }
  };

  const handleDeleteTransaction = async (id) => {
    await removeTransaction(id);
    if (!cloudStatus.connected) {
      setTransactions((prev) => prev.filter((item) => item.id !== id));
    }
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
                  Informe de Ingresos y Gastos de Fiesta de Navidad Jobos Campers Park
                </h1>
              </div>
            </div>

            {/* Admin Access Button */}
            <div className="shrink-0">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.removeItem('fiesta_jobos_admin_unlocked');
                    setIsAdmin(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm shadow-md transition"
                >
                  <Unlock className="w-4 h-4" />
                  <span className="hidden sm:inline">Modo Admin Activo</span>
                  <span className="sm:hidden">Admin</span>
                </button>
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
            <nav className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-xl text-sm font-extrabold flex items-center gap-2 transition ${
                  activeTab === 'all'
                    ? 'bg-white text-emerald-950 shadow-md'
                    : 'text-emerald-100 hover:bg-white/10'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Todo el Flujo ({transactions.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('deposits')}
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
                onClick={() => setActiveTab('expenses')}
                className={`px-4 py-2 rounded-xl text-sm font-extrabold flex items-center gap-2 transition ${
                  activeTab === 'expenses'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-emerald-100 hover:bg-white/10'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                <span>Gastos Pagados ({stats.expenseCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('instructions')}
                className={`px-4 py-2 rounded-xl text-sm font-extrabold flex items-center gap-2 transition ${
                  activeTab === 'instructions'
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'text-amber-200 hover:bg-white/10'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>¿Cómo enviar mi pago por ATH Móvil?</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Container (Mobile-optimized on phones, expanded on Tablet & Desktop) */}
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

        {/* Admin Console Panel (Only visible when PIN 1270 is entered) */}
        {isAdmin && (
          <AdminConsole
            transactions={transactions}
            onSaveTransaction={handleSaveTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onPreviewReceipt={(tx) => setSelectedReceiptTx(tx)}
            onExitAdmin={() => {
              sessionStorage.removeItem('fiesta_jobos_admin_unlocked');
              setIsAdmin(false);
            }}
          />
        )}

        {/* KPI Summary Cards — Easy to read for all ages */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-6">
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
            onClick={() => setActiveTab('deposits')}
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
            <p className="text-xs text-slate-500 mt-1.5 font-semibold">
              {stats.depositCount} {stats.depositCount === 1 ? 'depósito recibido' : 'depósitos recibidos'}
            </p>
          </div>

          {/* Card 3: Total Gastos Pagados */}
          <div
            onClick={() => setActiveTab('expenses')}
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
            <p className="text-xs text-slate-500 mt-1.5 font-semibold">
              {stats.expenseCount} {stats.expenseCount === 1 ? 'gasto con recibo' : 'gastos con recibo'}
            </p>
          </div>

          {/* Card 4: Personas y Campers Confirmados */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border-2 border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-blue-900">
                Asistencia Confirmada
              </span>
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-blue-900">
                {stats.totalPeople}
              </span>
              <span className="text-sm font-bold text-slate-600">Personas</span>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 font-semibold">
              De {stats.totalCampers} {stats.totalCampers === 1 ? 'Camper participante' : 'Campers participantes'}
            </p>
          </div>
        </section>

        {/* Instructions View or Compact Instructions Banner */}
        {activeTab === 'instructions' ? (
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
                onClick={() => setActiveTab('all')}
                className="self-start md:self-auto px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-bold"
              >
                &larr; Volver al Informe de Ingresos y Gastos
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
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

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Transparencia Total para el Parque</span>
                </h3>
                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="font-black text-emerald-700">1.</span>
                    <span>
                      Todos los depósitos recibidos por <strong>ATH Móvil</strong> o{' '}
                      <strong>Cash (Efectivo)</strong> aparecen reflejados en este portal.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-black text-emerald-700">2.</span>
                    <span>
                      Cada compra o gasto realizado para la fiesta incluye obligatoriamente un botón{' '}
                      <strong>&ldquo;📷 Ver Recibo&rdquo;</strong> para que cualquiera pueda ver la foto de la factura o recibo.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-black text-emerald-700">3.</span>
                    <span>
                      Puedes buscar tu nombre o el número de tu Camper en el buscador para verificar tu depósito en cualquier momento.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        ) : (
          /* Compact Help Strip on main views */
          <div className="bg-gradient-to-r from-amber-50 via-white to-emerald-50 border border-amber-300/80 rounded-2xl px-4 py-3 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-800 flex-wrap">
              <img
                src="/ath_logo_circle.png"
                alt="ATH"
                className="w-7 h-7 rounded-full shrink-0 object-contain"
              />
              <span>
                <strong>Enviar pago por ATH Móvil al:</strong>{' '}
                <strong className="text-orange-600 font-black text-sm">787-598-3594</strong>{' '}
                (Edgar Arroyo) • Escribe en el mensaje:{' '}
                <code className="bg-amber-100/90 text-amber-950 px-2 py-0.5 rounded-lg font-extrabold">
                  Nombre - Camper # - # personas
                </code>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('instructions')}
              className="text-xs font-extrabold text-emerald-800 hover:underline self-end sm:self-auto shrink-0"
            >
              Ver instrucciones &rarr;
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        {activeTab !== 'instructions' && (
          <section className="bg-white rounded-3xl p-3.5 sm:p-4 shadow-sm border border-slate-200 mb-5">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Mobile & Tablet Filter Pills */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
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
                  onClick={() => setActiveTab('deposits')}
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
                  onClick={() => setActiveTab('expenses')}
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

                              {isDeposit && (
                                <span className="inline-flex items-center gap-1 text-xs font-extrabold bg-blue-100 text-blue-950 px-2.5 py-0.5 rounded-full border border-blue-200">
                                  <Users className="w-3.5 h-3.5 text-blue-700" />
                                  {tx.peopleCount || 1}{' '}
                                  {Number(tx.peopleCount) === 1 ? 'Persona' : 'Personas'}
                                </span>
                              )}

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

                        {/* Right: Amount + View Receipt Button */}
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

                          {tx.receiptImage ? (
                            <button
                              type="button"
                              onClick={() => setSelectedReceiptTx(tx)}
                              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl font-extrabold text-xs sm:text-sm shadow-sm transition ${
                                isDeposit
                                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                  : 'bg-rose-700 hover:bg-rose-800 text-white'
                              }`}
                            >
                              <Eye className="w-4 h-4" />
                              <span>📷 Ver Recibo</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl">
                              {tx.paymentMethod?.toLowerCase().includes('cash')
                                ? '💵 Pago en Cash (Sin foto)'
                                : 'Sin imagen de recibo'}
                            </span>
                          )}
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
        <div className="grid grid-cols-4 h-16">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex flex-col items-center justify-center gap-1 ${
              activeTab === 'all' ? 'text-emerald-700 font-extrabold' : 'text-slate-500 font-semibold'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px]">Resumen</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('deposits')}
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
            onClick={() => setActiveTab('expenses')}
            className={`flex flex-col items-center justify-center gap-1 ${
              activeTab === 'expenses'
                ? 'text-rose-700 font-extrabold'
                : 'text-slate-500 font-semibold'
            }`}
          >
            <TrendingDown className="w-5 h-5" />
            <span className="text-[10px]">Gastos ({stats.expenseCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('instructions')}
            className={`flex flex-col items-center justify-center gap-1 ${
              activeTab === 'instructions'
                ? 'text-amber-600 font-extrabold'
                : 'text-slate-500 font-semibold'
            }`}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-[10px]">ATH Móvil</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      <ReceiptModal
        transaction={selectedReceiptTx}
        onClose={() => setSelectedReceiptTx(null)}
      />

      <PinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={() => {
          sessionStorage.setItem('fiesta_jobos_admin_unlocked', 'true');
          setIsAdmin(true);
          setPinModalOpen(false);
        }}
      />
    </div>
  );
}
