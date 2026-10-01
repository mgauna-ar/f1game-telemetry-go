import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { UI } from '../../constants/ui';
import styles from './CopyValueButton.module.css';

interface CopyValueButtonProps {
  value: string;
}

/** Shows a value, such as an IP address, as a button that copies it to the clipboard. */
export const CopyValueButton: React.FC<CopyValueButtonProps> = ({ value }) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      // The clipboard is missing outside secure contexts, e.g. a tablet on http://<lan-ip>:8080
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), UI.COPY_FEEDBACK_MS);
  };

  return (
    <button
      type="button"
      className={styles.button}
      data-copied={copied || undefined}
      onClick={handleCopy}
      title={copied ? t('common.copied') : t('common.copyValue', { value })}
      aria-label={t('common.copyValue', { value })}
    >
      <span>{value}</span>
      {copied ? <Check size={UI.ICON_SIZE_XS} /> : <Copy size={UI.ICON_SIZE_XS} />}
    </button>
  );
};
