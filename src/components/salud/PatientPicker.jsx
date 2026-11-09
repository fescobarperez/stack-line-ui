// Buscador de pacientes activos para agendar. Busca en el servidor por
// nombre, expediente, DPI, NIT o teléfono.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import { listPatients } from '../../api/salud.js';

export default function PatientPicker({ value, onChange }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  // Término de la última respuesta: el aviso de «sin resultados» espera a que llegue.
  const [buscado, setBuscado] = useState('');

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return undefined; }
    let vigente = true;
    const timer = setTimeout(async () => {
      try {
        const page = await listPatients({ search: term, status: 'activo', size: 8 });
        if (vigente) { setResults(page?.content || []); setBuscado(term); }
      } catch {
        if (vigente) { setResults([]); setBuscado(term); }
      }
    }, 300);
    return () => { vigente = false; clearTimeout(timer); };
  }, [q]);

  if (value) {
    return (
      <div className="salud-candidate">
        <div>
          <div className="salud-result-name">{value.name}</div>
          <div className="muted mono">{value.recordNumber}{value.phone ? ` · ${value.phone}` : ''}</div>
        </div>
        <Button type="button" variant="ghost" icon="edit" onClick={() => onChange(null)}>{t('agenda.form.changePatient', 'Cambiar')}</Button>
      </div>
    );
  }
  return (
    <div className="salud-search">
      <div className="search-wrap">
        <Icon name="search" className="icon" size={13} />
        <input className="search-input" value={q} autoFocus onChange={(e) => setQ(e.target.value)}
          placeholder={t('agenda.form.patientSearch', 'Buscar paciente por nombre, expediente o teléfono…')}
          aria-label={t('agenda.form.patientSearch', 'Buscar paciente por nombre, expediente o teléfono…')} />
      </div>
      {results.length > 0 && (
        <ul className="salud-results">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" className="salud-result" onClick={() => { onChange(p); setQ(''); setResults([]); }}>
                <span className="salud-result-name">{p.name}</span>
                <span className="muted mono">{p.recordNumber}{p.phone ? ` · ${p.phone}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && buscado === q.trim() && results.length === 0 && (
        <div className="muted salud-help">{t('agenda.form.noPatients', 'Sin pacientes activos que coincidan. Regístralo primero en Pacientes.')}</div>
      )}
    </div>
  );
}
