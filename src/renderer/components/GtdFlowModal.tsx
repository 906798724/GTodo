import React from 'react';

interface GtdFlowModalProps {
  onClose: () => void;
}

export const GtdFlowModal: React.FC<GtdFlowModalProps> = ({ onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal gtd-flow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h2>GTD 流程图</h2>
            <button className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="gtd-flow-content">
            <img src="./assets/gtd-flow.svg" alt="GTD流程图" />
          </div>
        </div>
      </div>
    </div>
  );
};
