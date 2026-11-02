// Buscador de diagnósticos CIE-10: por código («J06») o por palabras
// («cefalea tensión»). Si el diagnóstico no está en el catálogo, se agrega
// con el texto escrito y sin código.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon.jsx';
import { searchCie10 } from '../../api/salud.js';

export default function Cie10Picker({ onPick, disabled = false }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return undefined; }
    let vigente = true;
    const timer = setTimeout(async () => {
      try {
        const r = await searchCie10(term);
        if (vigente) setResults(r || []);
      } catch {
        if (vigente) setResults([]);
      }
    }, 250);
    return () => { vigente = false; clearTimeout(timer); };
  }, [q]);

  const elegir = (dx) => { onPick(dx); setQ(''); setResults([]); };
  const libre = q.trim();

  return (
    <div className="salud-search enc-cie10">
      <div className="search-wrap">
        <Icon name="search" className="icon" size={13} />
        <input className="search-input" value={q} disabled={disabled} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (results[0]) elegir(results[0]);
            else if (libre.length >= 3) elegir({ code: '', description: libre });
          }}
          placeholder={t('clinical.dx.search', 'Buscar diagnóstico CIE-10 por código o nombre…')}
          aria-label={t('clinical.dx.search', 'Buscar diagnóstico CIE-10 por código o nombre…')} />
      </div>
      {libre.length >= 2 && (
        <ul className="salud-results">
          {results.map((r) => (
            <li key={r.code}>
              <button type="button" className="salud-result enc-cie10-item" onClick={() => elegir(r)}>
                <span className="enc-code">{r.code}</span>
                <span>{r.description}</span>
              </button>
            </li>
          ))}
          {libre.length >= 3 && (
            <li>
              <button type="button" className="salud-result enc-cie10-free" onClick={() => elegir({ code: '', description: libre })}>
                <Icon name="plus" size={14} />
                <span>{t('clinical.dx.free', 'Usar «{{text}}» sin código', { text: libre })}</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
