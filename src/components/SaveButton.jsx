import React, { useState } from 'react';
import { Save, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function SaveButton({ onSave }) {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error

  if (!user) return null;

  const handleClick = async () => {
    setStatus('saving');
    try {
      await onSave();
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e) {
      console.error('Error guardando en la nube:', e);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const Icon = status === 'saved' ? Check : status === 'error' ? AlertCircle : Save;
  const label = status === 'saving' ? 'Guardando…' : status === 'saved' ? 'Guardado' : status === 'error' ? 'Error' : 'Guardar';

  return (
    <button
      className={`btn-icon ${status === 'saved' ? 'active' : ''}`}
      style={{ borderRadius: '14px', padding: '4px 8px', fontSize: '0.7rem' }}
      onClick={handleClick}
      disabled={status === 'saving'}
      title="Guardar tus notas en la nube"
    >
      <Icon size={12} />
      <span className="font-mono">{label}</span>
    </button>
  );
}
