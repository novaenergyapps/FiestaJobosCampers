import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  Receipt,
  Camera,
  Save,
  X,
  RefreshCw,
  LogOut,
  DollarSign,
  User,
  Home,
  Users
} from 'lucide-react';
import { compressReceiptImage, prepareImageForOcr } from '../utils/imageCompressor';
import { analyzeAthReceiptImage, parseAthReceiptText } from '../utils/athReceiptParser';

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayStr = () => getLocalDateString();

export default function AdminConsole({
  editingRecord,
  onClearEditingRecord,
  onSaveTransaction,
  onUpdateTransaction,
  onExitAdmin
}) {
  const [adminMode, setAdminMode] = useState('deposit'); // 'deposit' | 'expense'
  const [editingId, setEditingId] = useState(null);

  // Auto-save switch when ATH Móvil receipt has 100% complete format
  const [autoSaveOnValidOcr, setAutoSaveOnValidOcr] = useState(true);

  // Deposit Form State
  const [depName, setDepName] = useState('');
  const [depCamper, setDepCamper] = useState('');
  const [depPeople, setDepPeople] = useState('1');
  const [depAmount, setDepAmount] = useState('');
  const [depMethod, setDepMethod] = useState('ATH Móvil');
  const [depDate, setDepDate] = useState(todayStr());
  const [depNotes, setDepNotes] = useState('');
  const [depImage, setDepImage] = useState('');
  const [depImageKb, setDepImageKb] = useState(0);
  const [quickFormatText, setQuickFormatText] = useState('');

  // OCR Status
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrFeedback, setOcrFeedback] = useState(null);

  // Expense Form State
  const [expPaidTo, setExpPaidTo] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expCategory, setExpCategory] = useState('Comida y Bebida');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(todayStr());
  const [expImage, setExpImage] = useState('');
  const [expImageKb, setExpImageKb] = useState(0);

  // General Submission Status
  const [saving, setSaving] = useState(false);
  const [bannerMsg, setBannerMsg] = useState(null);

  const depFileRef = useRef(null);
  const expFileRef = useRef(null);

  const resetDepositForm = () => {
    setEditingId(null);
    setDepName('');
    setDepCamper('');
    setDepPeople('1');
    setDepAmount('');
    setDepMethod('ATH Móvil');
    setDepDate(todayStr());
    setDepNotes('');
    setDepImage('');
    setDepImageKb(0);
    setQuickFormatText('');
    setOcrFeedback(null);
    if (depFileRef.current) depFileRef.current.value = '';
    if (onClearEditingRecord) onClearEditingRecord();
  };

  const resetExpenseForm = () => {
    setEditingId(null);
    setExpPaidTo('');
    setExpDescription('');
    setExpCategory('Comida y Bebida');
    setExpAmount('');
    setExpDate(todayStr());
    setExpImage('');
    setExpImageKb(0);
    if (expFileRef.current) expFileRef.current.value = '';
    if (onClearEditingRecord) onClearEditingRecord();
  };

  // Load record into form when user clicks "Editar" next to any record in the list
  useEffect(() => {
    if (!editingRecord) return;
    setEditingId(editingRecord.id);
    if (editingRecord.type === 'deposit') {
      setDepName(editingRecord.name || '');
      setDepCamper(editingRecord.camperNumber || '');
      setDepPeople(String(editingRecord.peopleCount || 1));
      setDepAmount(String(editingRecord.amount || ''));
      setDepMethod(editingRecord.paymentMethod || 'ATH Móvil');
      setDepDate(editingRecord.date || todayStr());
      setDepNotes(editingRecord.notes || '');
      setDepImage(editingRecord.receiptImage || '');
      setAdminMode('deposit');
    } else {
      setExpPaidTo(editingRecord.paidTo || '');
      setExpDescription(editingRecord.description || '');
      setExpCategory(editingRecord.category || 'Comida y Bebida');
      setExpAmount(String(editingRecord.amount || ''));
      setExpDate(editingRecord.date || todayStr());
      setExpImage(editingRecord.receiptImage || '');
      setAdminMode('expense');
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [editingRecord]);

  const showNotice = (type, text) => {
    setBannerMsg({ type, text });
    setTimeout(() => {
      setBannerMsg((prev) => (prev?.text === text ? null : prev));
    }, 6000);
  };

  // Handle Quick Format Text line e.g. "Darinel Villegas - Camper 30 - 3"
  const handleApplyQuickFormat = (val) => {
    setQuickFormatText(val);
    const result = parseAthReceiptText(val);
    if (result.parsed.name) setDepName(result.parsed.name);
    if (result.parsed.camperNumber) setDepCamper(result.parsed.camperNumber);
    if (result.parsed.peopleCount) setDepPeople(result.parsed.peopleCount);
    if (result.parsed.amount) setDepAmount(result.parsed.amount);
  };

  // Handle Deposit Receipt Upload + Browser Compression + OCR Auto-Detection
  const handleDepositImageSelect = async (file) => {
    if (!file) return;
    try {
      setOcrRunning(true);
      setOcrProgress(5);
      setOcrFeedback(null);

      // 1. Compress in browser (no Firebase Storage credit card needed)
      const compressed = await compressReceiptImage(file);
      setDepImage(compressed.dataUrl);
      setDepImageKb(compressed.approxKb);

      // 2. Run OCR on a resolution-normalized copy of the ORIGINAL image (not the compressed one)
      const ocrSource = await prepareImageForOcr(file);
      const analysis = await analyzeAthReceiptImage(ocrSource, (prog) => {
        setOcrProgress(prog);
      });

      const { isCompleteFormat, needsReview, missingFields, parsed } = analysis;

      const nextName = parsed.name || depName;
      const nextCamper = parsed.camperNumber || depCamper;
      const nextPeople = parsed.peopleCount || depPeople || '1';
      const nextAmount = parsed.amount || depAmount;
      const nextDate = parsed.date || depDate || todayStr();

      if (parsed.name) setDepName(parsed.name);
      if (parsed.camperNumber) setDepCamper(parsed.camperNumber);
      if (parsed.peopleCount) setDepPeople(parsed.peopleCount);
      if (parsed.amount) setDepAmount(parsed.amount);
      if (parsed.date) setDepDate(parsed.date);

      setOcrRunning(false);

      if (isCompleteFormat && !needsReview && autoSaveOnValidOcr && !editingId) {
        // Automatically save transaction since all fields matched the format!
        setSaving(true);
        await onSaveTransaction({
          type: 'deposit',
          name: nextName,
          camperNumber: nextCamper,
          peopleCount: Number(nextPeople) || 1,
          amount: Number(nextAmount) || 0,
          paymentMethod: 'ATH Móvil',
          date: nextDate,
          notes: depNotes,
          receiptImage: compressed.dataUrl
        });
        setSaving(false);
        resetDepositForm();
        showNotice(
          'success',
          `¡Recibo de ATH Móvil leído y guardado automáticamente! (${nextName} • ${nextCamper} • ${nextPeople} pers. • $${Number(nextAmount).toFixed(2)})`
        );
      } else if (isCompleteFormat && needsReview) {
        setOcrFeedback({
          status: 'partial',
          message: `Leí el mensaje: "${parsed.messageRaw || ''}". El # de Camper o el nombre no venían claramente marcados, así que NO lo guardé automáticamente. Verifique los datos abajo y oprima Guardar Depósito.`
        });
      } else if (isCompleteFormat) {
        setOcrFeedback({
          status: 'complete',
          message:
            '¡Formato completo detectado en la imagen! Verifique los datos abajo y oprima Guardar Depósito.'
        });
      } else {
        setOcrFeedback({
          status: 'partial',
          message: `Imagen cargada y comprimida (${compressed.approxKb} KB). No se detectó el formato completo automáticamente (faltó: ${missingFields.join(', ')}). Por favor verifique o complete los campos manualmente abajo y luego oprima Guardar.`
        });
      }
    } catch (err) {
      console.error(err);
      setOcrRunning(false);
      setOcrFeedback({
        status: 'error',
        message: 'La imagen se cargó, pero no se pudo leer el texto automáticamente. Complete los campos manualmente y guarde.'
      });
    }
  };

  // Handle Expense Receipt Upload (Mandatory)
  const handleExpenseImageSelect = async (file) => {
    if (!file) return;
    try {
      const compressed = await compressReceiptImage(file);
      setExpImage(compressed.dataUrl);
      setExpImageKb(compressed.approxKb);
    } catch (err) {
      showNotice('error', err.message || 'Error procesando la imagen del gasto');
    }
  };

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    if (!depName.trim() || !depCamper.trim() || !depAmount) {
      showNotice('error', 'Por favor complete Nombre, # de Camper y Cantidad ($).');
      return;
    }

    const formattedCamper = /^camper/i.test(depCamper.trim())
      ? depCamper.trim()
      : `Camper ${depCamper.trim()}`;

    const payload = {
      type: 'deposit',
      name: depName.trim(),
      camperNumber: formattedCamper,
      peopleCount: Number(depPeople) || 1,
      amount: Number(depAmount) || 0,
      paymentMethod: depMethod,
      date: depDate || todayStr(),
      notes: depNotes.trim(),
      receiptImage: depImage || ''
    };

    try {
      setSaving(true);
      if (editingId) {
        await onUpdateTransaction(editingId, payload);
        showNotice('success', `Depósito de ${payload.name} actualizado correctamente.`);
      } else {
        await onSaveTransaction(payload);
        showNotice('success', `Depósito de ${payload.name} (${payload.camperNumber}) guardado exitosamente.`);
      }
      resetDepositForm();
    } catch (err) {
      showNotice('error', `Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expPaidTo.trim() || !expDescription.trim() || !expAmount) {
      showNotice('error', 'Por favor complete A quién se le pagó, Descripción y Cantidad ($).');
      return;
    }
    if (!expImage) {
      showNotice(
        'error',
        '⚠️ REQUISITO OBLIGATORIO: Todos los registros de gastos TIENEN que tener la imagen del recibo o factura adjunta.'
      );
      return;
    }

    const payload = {
      type: 'expense',
      paidTo: expPaidTo.trim(),
      description: expDescription.trim(),
      category: expCategory,
      amount: Number(expAmount) || 0,
      date: expDate || todayStr(),
      receiptImage: expImage
    };

    try {
      setSaving(true);
      if (editingId) {
        await onUpdateTransaction(editingId, payload);
        showNotice('success', `Gasto a ${payload.paidTo} actualizado correctamente.`);
      } else {
        await onSaveTransaction(payload);
        showNotice('success', `Gasto pagado a ${payload.paidTo} guardado con su recibo adjunto.`);
      }
      resetExpenseForm();
    } catch (err) {
      showNotice('error', `Error al guardar gasto: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-emerald-700/20 overflow-hidden mb-8">
      {/* Top Admin Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-black">
            ADMIN
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
              Consola de Administración • Fiesta de Navidad
            </h2>
            <p className="text-xs text-emerald-200/80">
              Entrada automática de recibos ATH Móvil, pagos manuales y gastos con recibo
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onExitAdmin}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs sm:text-sm font-bold text-white transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Salir de Admin</span>
        </button>
      </div>

      {/* Mode Switch Tabs (2 clean tabs: Deposit and Expense) */}
      <div className="grid grid-cols-2 gap-2 p-2.5 sm:p-3 bg-slate-100 border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            resetDepositForm();
            setAdminMode('deposit');
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          }}
          className={`py-3 px-3 sm:px-4 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition ${
            adminMode === 'deposit'
              ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/20'
              : 'bg-white text-slate-700 hover:bg-emerald-50'
          }`}
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>Entrar Depósito</span>
        </button>

        <button
          type="button"
          onClick={() => {
            resetExpenseForm();
            setAdminMode('expense');
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          }}
          className={`py-3 px-3 sm:px-4 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition ${
            adminMode === 'expense'
              ? 'bg-rose-700 text-white shadow-md shadow-rose-700/20'
              : 'bg-white text-slate-700 hover:bg-rose-50'
          }`}
        >
          <Receipt className="w-4 h-4 shrink-0" />
          <span>Entrar Gasto</span>
        </button>
      </div>

      {/* Status Notification Banner */}
      {bannerMsg && (
        <div
          className={`mx-4 sm:mx-6 mt-4 p-4 rounded-2xl border flex items-start gap-3 ${
            bannerMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {bannerMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="text-sm font-bold flex-1">{bannerMsg.text}</div>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: DEPOSIT ENTRY (AUTOMATIC ATH MOVIL + MANUAL) */}
      {adminMode === 'deposit' && (
        <div className="p-4 sm:p-6 space-y-6">
          {editingId && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-2xl flex items-center justify-between">
              <span className="text-sm font-bold">
                ✏️ Editando depósito existente ({depName || 'Registro'})
              </span>
              <button
                type="button"
                onClick={resetDepositForm}
                className="text-xs font-extrabold underline text-amber-900"
              >
                Cancelar edición
              </button>
            </div>
          )}

          {/* Smart ATH Móvil Screenshot Uploader */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white border-2 border-dashed border-emerald-400 rounded-3xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/ath_logo_circle.png"
                  alt="ATH Móvil"
                  className="w-11 h-11 rounded-2xl shadow-sm bg-white p-1 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                    <span>Subir Recibo de ATH Móvil (Lectura Automática o Manual)</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Detecta el formato: <strong className="text-emerald-900">Nombre - Camper # - # personas</strong> (Ej: <em>Darinel Villegas - Camper 30 - 3</em>)
                  </p>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-bold text-emerald-900 bg-white px-3 py-2 rounded-xl border border-emerald-200 cursor-pointer select-none self-start sm:self-auto">
                <input
                  type="checkbox"
                  checked={autoSaveOnValidOcr}
                  onChange={(e) => setAutoSaveOnValidOcr(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Auto-guardar si el formato está 100% completo</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <input
                  ref={depFileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleDepositImageSelect(e.target.files?.[0])}
                  className="hidden"
                  id="deposit-receipt-input"
                />
                <label
                  htmlFor="deposit-receipt-input"
                  className="w-full py-4 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-emerald-700/20 transition"
                >
                  <Camera className="w-5 h-5" />
                  <span>
                    {depImage ? 'Cambiar Imagen del Recibo' : 'Seleccionar Screenshot / Foto de Recibo'}
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-1.5 text-center">
                  La imagen se comprime automáticamente en tu navegador para guardarse gratis en Firebase.
                </p>
              </div>

              {/* Quick Format Line Parser */}
              <div className="bg-white p-3.5 rounded-2xl border border-emerald-200">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ⚡ ¿Tienes el texto del mensaje de ATH Móvil? Pégalo aquí para llenar los campos:
                </label>
                <input
                  type="text"
                  value={quickFormatText}
                  onChange={(e) => handleApplyQuickFormat(e.target.value)}
                  placeholder="Ej: Darinel Villegas - Camper 30 - 3"
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            {/* OCR Progress or Feedback */}
            {ocrRunning && (
              <div className="mt-4 bg-white p-4 rounded-2xl border border-emerald-200 flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs font-bold text-emerald-900 mb-1">
                    <span>Analizando recibo de ATH Móvil y comprimiendo imagen...</span>
                    <span>{ocrProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-200"
                      style={{ width: `${Math.max(10, ocrProgress)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {ocrFeedback && (
              <div
                className={`mt-4 p-3.5 rounded-2xl border text-xs sm:text-sm font-semibold flex items-start gap-2.5 ${
                  ocrFeedback.status === 'complete'
                    ? 'bg-emerald-100/80 border-emerald-400 text-emerald-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                {ocrFeedback.status === 'complete' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <span>{ocrFeedback.message}</span>
              </div>
            )}
          </div>

          {/* Manual / Pre-filled Deposit Form */}
          <form onSubmit={handleDepositSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nombre de la Persona *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={depName}
                    onChange={(e) => setDepName(e.target.value)}
                    placeholder="Ej: Darinel Villegas"
                    className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-slate-300 focus:border-emerald-600 focus:outline-none text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  # de Camper *
                </label>
                <div className="relative">
                  <Home className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={depCamper}
                    onChange={(e) => setDepCamper(e.target.value)}
                    placeholder="Ej: Camper 30"
                    className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-slate-300 focus:border-emerald-600 focus:outline-none text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  # de Personas *
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={depPeople}
                    onChange={(e) => setDepPeople(e.target.value)}
                    placeholder="Ej: 3"
                    className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-slate-300 focus:border-emerald-600 focus:outline-none text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Cantidad Depositada ($) *
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-emerald-700 absolute left-3.5 top-3.5" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={depAmount}
                    onChange={(e) => setDepAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-3.5 py-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 focus:bg-white focus:border-emerald-600 focus:outline-none text-base font-black text-emerald-950"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Método de Pago
                </label>
                <select
                  value={depMethod}
                  onChange={(e) => setDepMethod(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 focus:border-emerald-600 focus:outline-none text-sm font-semibold bg-white"
                >
                  <option value="ATH Móvil">ATH Móvil</option>
                  <option value="Cash (Efectivo)">Cash (Efectivo)</option>
                  <option value="Transferencia / Otro">Transferencia / Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Fecha del Depósito
                </label>
                <input
                  type="date"
                  value={depDate}
                  onChange={(e) => setDepDate(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 focus:border-emerald-600 focus:outline-none text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nota / Referencia (Opcional)
                </label>
                <input
                  type="text"
                  value={depNotes}
                  onChange={(e) => setDepNotes(e.target.value)}
                  placeholder="Ej: Pagó en efectivo / Ref ATH"
                  className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 focus:border-emerald-600 focus:outline-none text-sm"
                />
              </div>
            </div>

            {/* Attached Image Preview if present */}
            {depImage && (
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <img
                    src={depImage}
                    alt="Previsualización recibo"
                    className="w-14 h-14 rounded-xl object-cover border border-slate-300"
                  />
                  <div>
                    <p className="text-xs font-extrabold text-emerald-800">
                      ✅ Imagen del recibo lista para guardar {depImageKb ? `(${depImageKb} KB)` : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      🔒 Privado: Solo el Administrador puede ver las imágenes de depósitos.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDepImage('');
                    setDepImageKb(0);
                  }}
                  className="text-xs font-bold text-rose-600 hover:underline px-2 py-1"
                >
                  Quitar imagen
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetDepositForm}
                  className="px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 transition"
              >
                <Save className="w-5 h-5" />
                <span>
                  {saving
                    ? 'Guardando...'
                    : editingId
                    ? 'Actualizar Depósito'
                    : 'Guardar Depósito'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: EXPENSE ENTRY (MANUAL WITH MANDATORY RECEIPT IMAGE) */}
      {adminMode === 'expense' && (
        <div className="p-4 sm:p-6 space-y-6">
          {editingId && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-2xl flex items-center justify-between">
              <span className="text-sm font-bold">
                ✏️ Editando gasto existente ({expPaidTo || 'Gasto'})
              </span>
              <button
                type="button"
                onClick={resetExpenseForm}
                className="text-xs font-extrabold underline text-amber-900"
              >
                Cancelar edición
              </button>
            </div>
          )}

          <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
            <Receipt className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-rose-950">
              <strong>Registro de Gastos Pagados:</strong> Todos los gastos requieren obligatoriamente subir la foto del recibo o factura para que aparezca el botón{' '}
              <span className="underline font-bold">Ver Recibo</span> en el informe público.
            </div>
          </div>

          <form onSubmit={handleExpenseSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  ¿A quién se le hace el pago? (Suplidor / Persona) *
                </label>
                <input
                  type="text"
                  required
                  value={expPaidTo}
                  onChange={(e) => setExpPaidTo(e.target.value)}
                  placeholder="Ej: Lechonera El Rancho / Supermercado / DJ"
                  className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 focus:border-rose-600 focus:outline-none text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Categoría
                </label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 focus:border-rose-600 focus:outline-none text-sm font-semibold bg-white"
                >
                  <option value="Comida y Bebida">Comida y Bebida</option>
                  <option value="Música y Entretenimiento">Música y Entretenimiento</option>
                  <option value="Decoración y Artículos">Decoración y Artículos</option>
                  <option value="Alquiler / Equipo">Alquiler / Equipo</option>
                  <option value="Otros Gastos">Otros Gastos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Cantidad Pagada ($) *
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-rose-700 absolute left-3.5 top-3.5" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-3.5 py-3 rounded-2xl border-2 border-rose-300 bg-rose-50/40 focus:bg-white focus:border-rose-600 focus:outline-none text-base font-black text-rose-950"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Descripción detallada del gasto *
                </label>
                <input
                  type="text"
                  required
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder="Ej: Pago inicial por lechón asado, arroz con gandules y platos"
                  className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 focus:border-rose-600 focus:outline-none text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Fecha del Gasto *
                </label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 focus:border-rose-600 focus:outline-none text-sm font-semibold"
                />
              </div>
            </div>

            {/* Mandatory Expense Receipt Upload */}
            <div
              className={`p-4 sm:p-5 rounded-3xl border-2 border-dashed transition ${
                expImage
                  ? 'bg-emerald-50/50 border-emerald-400'
                  : 'bg-rose-50/40 border-rose-400'
              }`}
            >
              <input
                ref={expFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleExpenseImageSelect(e.target.files?.[0])}
                className="hidden"
                id="expense-receipt-input"
              />
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {expImage ? (
                    <img
                      src={expImage}
                      alt="Recibo de gasto"
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-sm"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                      <Camera className="w-7 h-7" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                      {expImage
                        ? `✅ Recibo Adjuntado (${expImageKb || 120} KB)`
                        : '📷 Foto del Recibo o Factura (OBLIGATORIO) *'}
                    </h4>
                    <p className="text-xs text-slate-600">
                      {expImage
                        ? 'La imagen se mostrará cuando las personas opriman "Ver Recibo".'
                        : 'Debe seleccionar o tomar foto del recibo de compra para poder guardar el gasto.'}
                    </p>
                  </div>
                </div>

                <label
                  htmlFor="expense-receipt-input"
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition shrink-0"
                >
                  <Upload className="w-4 h-4" />
                  <span>{expImage ? 'Cambiar Foto de Recibo' : 'Subir Foto de Recibo'}</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetExpenseForm}
                  className="px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-rose-700/25 transition"
              >
                <Save className="w-5 h-5" />
                <span>
                  {saving ? 'Guardando...' : editingId ? 'Actualizar Gasto' : 'Guardar Gasto con Recibo'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
