import React, { useState } from 'react';
import { X, Calendar, ExternalLink, Check, Mail } from 'lucide-react';

export function GoogleCalendarModal({ note, isOpen, onClose, onSyncSuccess }) {
  if (!isOpen || !note) return null;

  // Extract clean text from blocks for description
  const initialTitle = note.title || 'Reunión / Evento';
  const initialDescription = note.blocks
    ? note.blocks.map(b => (b.completed ? '[x] ' : '[ ] ') + b.text).join('\n')
    : '';

  // Default date: tomorrow at 10:00 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const defaultIso = tomorrow.toISOString().slice(0, 16);

  const [title, setTitle] = useState(initialTitle);
  const [dateTime, setDateTime] = useState(defaultIso);
  const [duration, setDuration] = useState('60'); // minutes
  const [description, setDescription] = useState(initialDescription);
  const [guests, setGuests] = useState('');
  const [synced, setSynced] = useState(false);

  // Format dates into YYYYMMDDTHHmmSSZ format for Google Calendar URL
  const formatGCalDate = (dateObj) => {
    return dateObj.toISOString().replace(/-|:|\.\d\d\d/g, '');
  };

  const handleOpenGCal = () => {
    const startDate = new Date(dateTime);
    const endDate = new Date(startDate.getTime() + parseInt(duration, 10) * 60000);

    const startStr = formatGCalDate(startDate);
    const endStr = formatGCalDate(endDate);

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${startStr}/${endStr}`,
      details: description,
      add: guests.trim(),
    });

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;
    
    window.open(googleCalendarUrl, '_blank');
    setSynced(true);

    if (onSyncSuccess) {
      onSyncSuccess(note.id, {
        title,
        dateTime,
        googleUrl: googleCalendarUrl,
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <span>Conectar con Google Calendar</span>
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-field">
          <label className="modal-label">Título del Evento</label>
          <input
            type="text"
            className="modal-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ej. Reunión de diseño de producto"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
          <div className="modal-field">
            <label className="modal-label">Fecha y Hora inicio</label>
            <input
              type="datetime-local"
              className="modal-input font-mono"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label">Duración (min)</label>
            <select
              className="modal-input font-mono"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">1 hora</option>
              <option value="120">2 horas</option>
            </select>
          </div>
        </div>

        <div className="modal-field">
          <label className="modal-label">Invitados (Gmail / Emails)</label>
          <input
            type="email"
            className="modal-input font-mono"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            placeholder="usuario@gmail.com, colega@empresa.com"
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">Detalles / Notas extra en evento</label>
          <textarea
            className="modal-input font-body"
            style={{ height: '80px', resize: 'vertical' }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div style={{ background: 'rgba(24,24,27,0.03)', border: 'var(--border-hairline)', padding: '10px', borderRadius: '4px' }}>
          <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Mail size={12} />
            <span>Sincronización Gmail / Google Workspace integrada</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Se abrirá la ventana de Google Calendar para crear el evento y enviar invitaciones a los correos Gmail especificados.
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn-icon" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-icon active" onClick={handleOpenGCal}>
            <Calendar size={14} />
            <span>Crear Evento en Google</span>
            <ExternalLink size={12} />
          </button>
        </div>

        {synced && (
          <div className="font-mono" style={{ fontSize: '0.75rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <Check size={14} />
            <span>Evento generado en Google Calendar</span>
          </div>
        )}
      </div>
    </div>
  );
}
