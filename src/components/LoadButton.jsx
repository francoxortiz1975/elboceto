import React, { useState } from 'react';
import { Download, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoadButton({ onLoad }) {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | loading | loaded | error

  if (!user) return null;

  const handleClick = async () => {
    setStatus('loading');
    try {
      await onLoad();
      setStatus('loaded');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e) {
      console.error('Error cargando desde la nube:', e);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const Icon = status === 'loaded' ? Check : status === 'error' ? AlertCircle : Download;
  const label = status === 'loading' ? 'Cargando…' : status === 'loaded' ? 'Cargado' : status === 'error' ? 'Error' : 'Cargar';

  return (
    <button
      className={`btn-icon ${status === 'loaded' ? 'active' : ''}`}
      style={{ borderRadius: '14px', padding: '4px 8px', fontSize: '0.7rem' }}
      onClick={handleClick}
      disabled={status === 'loading'}
      title="Traer tus notas guardadas desde la nube (reemplaza lo que ves acá)"
    >
      <Icon size={12} />
      <span className="font-mono">{label}</span>
    </button>
  );
}
