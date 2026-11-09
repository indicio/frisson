/** Shared controls used by the React dashboard and migrated module panels. */

export function RangeControl({ label, value, min, max, step, suffix = '', onChange }) {
  return (
    <div className="control-item control-item--range">
      <label className="control-label">
        <span className="control-label-text">{label}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="value">{value}{suffix}</span>
      </label>
    </div>
  );
}

export function CheckControl({ label, checked, onChange }) {
  return (
    <div className="control-item">
      <label className="control-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
    </div>
  );
}

export function SelectControl({ label, value, options, onChange }) {
  return (
    <div className="control-item">
      <label className="control-label">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

export function ColorControl({ label, value, onChange }) {
  return (
    <div className="control-item">
      <label className="control-label">{label}</label>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
