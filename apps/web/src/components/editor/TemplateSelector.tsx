'use client';

import { useState } from 'react';
import { NOTE_TEMPLATES, type NoteTemplate } from '@/lib/templates/note-templates';

interface TemplateSelectorProps {
  onSelect: (template: NoteTemplate) => void;
  onClose: () => void;
}

export default function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 200,
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a template"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 201,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          width: 'min(520px, 92vw)',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Choose a Template
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
              Start with a structured format or a blank canvas
            </p>
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close template selector"
            style={{ width: 28, height: 28 }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M4 4l12 12M16 4L4 16" />
            </svg>
          </button>
        </div>

        {/* Template Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 12,
            padding: '16px 20px 20px',
            overflowY: 'auto',
          }}
        >
          {NOTE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                onSelect(template);
                onClose();
              }}
              onMouseEnter={() => setHovered(template.id)}
              onMouseLeave={() => setHovered(null)}
              id={`template-${template.id}`}
              aria-label={`Use ${template.name} template`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 6,
                padding: '14px 16px',
                background: hovered === template.id ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                border: `1.5px solid ${hovered === template.id ? 'var(--color-brand-500)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all var(--transition-fast)',
                transform: hovered === template.id ? 'translateY(-1px)' : 'none',
                boxShadow: hovered === template.id ? 'var(--shadow-md)' : 'none',
              }}
            >
              <span style={{ fontSize: '24px', lineHeight: 1 }}>{template.icon}</span>
              <div>
                <div
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 2,
                  }}
                >
                  {template.name}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    lineHeight: 1.4,
                  }}
                >
                  {template.description}
                </div>
              </div>
              {template.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                  {template.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'rgba(37,99,235,0.1)',
                        color: 'var(--color-brand-600)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
