import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';

const ConfirmModal = ({ 
  show, 
  onHide, 
  onConfirm, 
  title, 
  message, 
  confirmText, 
  accent, 
  isDanger = true 
}) => {
  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      centered 
      // 🔥 Added "mx-3" for mobile margins and "max-width" for desktop
      dialogClassName="confirm-modal-dialog mx-3 mx-sm-auto"
      contentClassName="bg-black border-dark rounded-5 shadow-lg border-0"
      backdropClassName="modal-backdrop-blur"
    >
      {/* Top Close Button - Padded for touch targets */}
      <div className="p-3 p-md-4 d-flex justify-content-end">
        <div 
          onClick={onHide} 
          className="p-2 rounded-circle active-click" 
          style={{ cursor: 'pointer', backgroundColor: '#16181c' }}
        >
          <X size={20} color="#fff" />
        </div>
      </div>

      <Modal.Body className="text-center px-4 px-md-5 pb-5 pt-0">
        {/* Responsive Icon Container */}
        <div 
          className="mb-4 d-inline-block p-3 p-md-4 rounded-circle animate__animated animate__pulse animate__infinite" 
          style={{ backgroundColor: isDanger ? '#ff444415' : `${accent}15` }}
        >
          {isDanger ? (
            <ShieldAlert className="modal-icon" size={40} color="#ff4444" strokeWidth={2.5} />
          ) : (
            <AlertTriangle className="modal-icon" size={40} color={accent} strokeWidth={2.5} />
          )}
        </div>

        {/* Title - Responsive font size */}
        <h3 className="fw-black text-white mb-2 responsive-h3" style={{ letterSpacing: '-0.5px' }}>
          {title?.toUpperCase()}
        </h3>
        
        {/* Message - Responsive font size */}
        <p className="text-white-50 mb-4 px-1" style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
          {message}
        </p>

        <div className="d-grid gap-2 gap-md-3">
          <Button 
            onClick={onConfirm}
            className="py-3 fw-bold border-0 active-click"
            style={{ 
              backgroundColor: isDanger ? '#ff4444' : accent, 
              color: isDanger ? '#fff' : '#000', 
              borderRadius: '16px',
              fontSize: '1rem'
            }}
          >
            {confirmText || 'CONFIRM ACTION'}
          </Button>
          
          <Button 
            variant="link" 
            onClick={onHide} 
            className="text-white-50 text-decoration-none fw-bold small py-2"
          >
            NEVERMIND
          </Button>
        </div>
      </Modal.Body>

      <style>{`
        .modal-backdrop-blur { 
          backdrop-filter: blur(12px) !important; 
          background-color: rgba(0,0,0,0.6) !important; 
        }
        
        /* Desktop Constraint */
        .confirm-modal-dialog {
          max-width: 400px;
        }

        /* Mobile specific font sizing */
        @media (max-width: 576px) {
          .responsive-h3 { font-size: 1.4rem !important; }
          .modal-icon { width: 32px; height: 32px; }
          .rounded-5 { border-radius: 2rem !important; }
        }

        .active-click:active { transform: scale(0.96); opacity: 0.8; }
      `}</style>
    </Modal>
  );
};

export default ConfirmModal;