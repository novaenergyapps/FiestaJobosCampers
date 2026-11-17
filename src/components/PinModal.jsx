import React, { useState } from 'react';
import { Lock, X, ShieldCheck, Delete } from 'lucide-react';

const ADMIN_PIN = '1270';

export default function PinModal({ isOpen, onClose, onSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleDigit = (digit) => {
    setError('');
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) {
        if (next === ADMIN_PIN) {
          setPin('');
          onSuccess();
        } else {
          setError('PIN incorrecto. Intente nuevamente.');
          setTimeout(() => setPin(''), 400);
        }
      }
    }
  };

  const handleBackspace = () => {
    setError('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      setPin('');
      setError('');
      onSuccess();
    } else {
      setError('PIN incorrecto. Verifique su código de administrador.');
      setPin('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Acceso Administrador</h3>
              <p className="text-xs text-slate-500">Ingrese el PIN de 4 dígitos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 4);
              setPin(val);
              setError('');
              if (val === ADMIN_PIN) {
                setPin('');
                onSuccess();
              }
            }}
            placeholder="••••"
            autoFocus
            className="w-full text-center text-3xl tracking-[0.6em] font-black py-3.5 px-4 rounded-2xl bg-slate-100 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white focus:outline-none mb-3"
          />

          {error && (
            <p className="text-xs font-bold text-rose-600 text-center mb-3 bg-rose-50 py-2 px-3 rounded-xl border border-rose-200">
              {error}
            </p>
          )}

          {/* Numeric Touch Pad for easy Mobile and Desktop entry */}
          <div className="grid grid-cols-3 gap-2.5 my-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="h-13 py-3 rounded-2xl bg-slate-100 hover:bg-emerald-50 active:bg-emerald-100 text-slate-900 font-extrabold text-xl border border-slate-200 transition"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPin('');
                setError('');
              }}
              className="h-13 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs border border-slate-200 transition"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-13 py-3 rounded-2xl bg-slate-100 hover:bg-emerald-50 active:bg-emerald-100 text-slate-900 font-extrabold text-xl border border-slate-200 transition"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-13 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center border border-slate-200 transition"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 transition"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Entrar al Panel de Admin</span>
          </button>
        </form>
      </div>
    </div>
  );
}
