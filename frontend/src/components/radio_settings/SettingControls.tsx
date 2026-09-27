import React, { useId } from 'react';
import { Select } from '../ui/Field';
import { Switch } from '../ui/Switch';
import styles from './RadioSettings.module.css';

export interface SettingSectionProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** Controls on the right of the title. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** A titled group of settings in a radio settings tab. */
export const SettingSection: React.FC<SettingSectionProps> = ({ icon, title, actions, children }) => {
  const titleId = useId();
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.sectionHeader}>
        <h3 id={titleId} className={styles.sectionTitle}>
          {icon && <span aria-hidden="true">{icon}</span>}
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  );
};

export interface ToggleRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The small line used inside an alert accordion. */
  compact?: boolean;
}

/** A setting turned on or off: its name (and description) and a switch; the whole row is the label. */
export const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onChange, compact = false }) => (
  <label className={styles.toggleRow} data-compact={compact || undefined}>
    {description ? (
      <span className={styles.toggleText}>
        <span className={styles.toggleTitle}>{label}</span>
        <span className={styles.toggleDesc}>{description}</span>
      </span>
    ) : (
      <span>{label}</span>
    )}
    <Switch checked={checked} onChange={onChange} />
  </label>
);

export interface SelectFieldProps {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}

/** A labelled select in a setting card. */
export const SelectField: React.FC<SelectFieldProps> = ({ label, value, onChange, children }) => {
  const id = useId();
  return (
    <div className={styles.box}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </Select>
    </div>
  );
};
