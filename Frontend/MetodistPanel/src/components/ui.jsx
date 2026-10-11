import React from 'react';

export function InlineTabs({items, value, onChange, className = '', compact}) {
  return (
    <div className={`profile-tabs section-tabs ${compact ? 'is-compact' : ''} ${className}`.trim()}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`profile-tab ${value === item.id ? 'is-active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
}

export function Field({label, error, children}) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <div className="field-label">{label}</div>
      {children}
      {error ? <div className="chart-note">{error}</div> : null}
    </div>
  );
}

export function WizardSteps({current, accent, onStepSelect}) {
  const steps = ['Основная информация', 'Контент', 'Публикация'];
  return (
    <div className={`wizard ${accent ? 'accent' : ''}`}>
      {steps.map((step, index) => (
        <button
          type="button"
          className={`wizard-step ${current === index + 1 ? 'is-current' : ''}`}
          key={step}
          onClick={() => onStepSelect?.(index + 1)}
        >
          <div className="wizard-index">{index + 1}</div>
          <div className="wizard-label">{step}</div>
        </button>
      ))}
    </div>
  );
}

export function Breadcrumbs({path}) {
  return <div className="breadcrumbs">{path}</div>;
}
