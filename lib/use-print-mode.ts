'use client';

import { useEffect, useState } from 'react';

export type PrintMode = 'queue' | 'rawbt' | 'browser';

const STORAGE_KEY = 'rcontrol_print_mode';
const LEGACY_RAWBT_KEY = 'rcontrol_rawbt_enabled';

export function usePrintMode() {
  const [printMode, setPrintModeState] = useState<PrintMode>('queue');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'queue' || stored === 'rawbt' || stored === 'browser') {
      setPrintModeState(stored);
    } else if (localStorage.getItem(LEGACY_RAWBT_KEY) === 'true') {
      setPrintModeState('rawbt');
    }
  }, []);

  function setPrintMode(mode: PrintMode) {
    setPrintModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  return [printMode, setPrintMode] as const;
}
