import React, { useState } from 'react';
import { LogIn, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';

export function AuthButton() {
  const { user, loading, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (loading) return null;

  if (!user) {
    return (
      <>
        <button
          className="btn-icon"
          style={{ borderRadius: '14px', padding: '4px 8px', fontSize: '0.7rem' }}
          onClick={() => setShowModal(true)}
          title="Crear cuenta o iniciar sesión"
        >
          <LogIn size={12} />
          <span className="font-mono">Iniciar sesión</span>
        </button>
        {showModal && <AuthModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        className="btn-icon active"
        style={{ borderRadius: '14px', padding: '4px 8px', fontSize: '0.7rem' }}
        onClick={(e) => { e.stopPropagation(); setShowMenu(prev => !prev); }}
        title={user.email}
      >
        <User size={12} />
        <span className="font-mono" style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.email}
        </span>
      </button>

      {showMenu && (
        <div className="home-pin-popover" style={{ right: 0, left: 'auto', top: 'calc(100% + 6px)', zIndex: 1200 }}>
          <div className="home-pin-title font-mono">{user.email}</div>
          <div className="home-pin-desc">Tus notas se sincronizan automáticamente.</div>
          <div className="home-pin-actions">
            <button
              className="btn-pin-cancel font-mono"
              onClick={() => { setShowMenu(false); signOut(); }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
