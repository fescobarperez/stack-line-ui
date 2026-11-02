// Responsables del paciente: tutor legal y/o quien paga. Siempre son
// clientes (la factura sale a su nombre y NIT), así que se eligen de la
// lista de clientes o se crean aquí mismo sin salir del formulario.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import { listClients, createClient } from '../../api/partners.js';
import { emptyGuardian } from '../../lib/patients.js';

/** Buscador de clientes con alta rápida (nombre, NIT y teléfono). */
function ClientSearch({ excludeIds, onPick, pushToast }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [creating, setCreating] = useState(false);
  const [nuevo, setNuevo] = useState({ name: '', nit: 'CF', phone: '' });

  // Por clave y no por arreglo: el arreglo es nuevo en cada render y el
  // efecto volvería a buscar sin parar.
  const excluidos = excludeIds.join(',');
  useEffect(() => {
    const term = q.trim();
    const fuera = excluidos ? excluidos.split(',').map(Number) : [];
    if (term.length < 2) { setResults([]); return undefined; }
    let vigente = true;
    const timer = setTimeout(async () => {
      try {
        const page = await listClients({ search: term, size: 8 });
        if (vigente) setResults((page?.content ?? page ?? []).filter((c) => !fuera.includes(c.id)));
      } catch {
        if (vigente) setResults([]);
      }
    }, 300);
    return () => { vigente = false; clearTimeout(timer); };
  }, [q, excluidos]);

  const crear = async () => {
    if (!nuevo.name.trim()) return;
    try {
      const c = await createClient({
        name: nuevo.name.trim(), nit: nuevo.nit.trim() || 'CF', clientType: 'CF',
        phone: nuevo.phone.trim() || null, creditLimit: 0, paymentTerms: 0, status: 'active',
      });
      onPick(c);
      setCreating(false);
      setNuevo({ name: '', nit: 'CF', phone: '' });
      setQ('');
    } catch (err) {
      pushToast?.(t('patients.guardians.createFailed', 'No se pudo crear el cliente: ') + err.message, 'danger');
    }
  };

  if (creating) {
    return (
      <div className="salud-row">
        <div className="form-grid salud-row-fields">
          <div className="field-group span-2">
            <label className="field-label">{t('patients.guardians.newName', 'Nombre del responsable *')}</label>
            <input className="field-input" value={nuevo.name} autoFocus
              onChange={(e) => setNuevo((n) => ({ ...n, name: e.target.value }))} />
          </div>
          <div className="field-group">
            <label className="field-label">NIT</label>
            <input className="field-input mono" value={nuevo.nit}
              onChange={(e) => setNuevo((n) => ({ ...n, nit: e.target.value }))} />
          </div>
          <div className="field-group">
            <label className="field-label">{t('patients.fields.phoneShort', 'Teléfono')}</label>
            <input className="field-input" value={nuevo.phone}
              onChange={(e) => setNuevo((n) => ({ ...n, phone: e.target.value }))} />
          </div>
        </div>
        <div className="salud-inline-actions">
          <Button type="button" variant="ghost" onClick={() => setCreating(false)}>{t('common.cancel', 'Cancelar')}</Button>
          <Button type="button" variant="accent" icon="check" disabled={!nuevo.name.trim()} onClick={crear}>
            {t('patients.guardians.createClient', 'Crear cliente')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="salud-search">
      <div className="search-wrap">
        <Icon name="search" className="icon" size={13} />
        <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t('patients.guardians.searchPlaceholder', 'Buscar cliente por nombre…')}
          aria-label={t('patients.guardians.searchPlaceholder', 'Buscar cliente por nombre…')} />
      </div>
      {results.length > 0 && (
        <ul className="salud-results">
          {results.map((c) => (
            <li key={c.id}>
              <button type="button" className="salud-result" onClick={() => { onPick(c); setQ(''); setResults([]); }}>
                <span className="salud-result-name">{c.name}</span>
                <span className="muted mono">{c.nit || 'CF'}{c.phone ? ` · ${c.phone}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="ghost" icon="plus" onClick={() => {
        setNuevo((n) => ({ ...n, name: q.trim() })); setCreating(true);
      }}>
        {t('patients.guardians.notFound', '¿No está? Crear cliente')}
      </Button>
    </div>
  );
}

export default function GuardianEditor({ guardians = [], onChange, patientClientId = null, pushToast }) {
  const { t } = useTranslation();
  const set = (i, patch) => onChange(guardians.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const remove = (i) => onChange(guardians.filter((_, j) => j !== i));
  const excluir = [patientClientId, ...guardians.map((g) => g.clientId)].filter((x) => x != null);

  const agregar = (c) => onChange([...guardians, {
    ...emptyGuardian(), clientId: c.id, name: c.name, nit: c.nit || '', phone: c.phone || '',
    // El primero suele ser quien paga: así la factura ya sale a su nombre.
    payer: !guardians.some((g) => g.payer),
  }]);

  return (
    <div className="salud-rows">
      <p className="muted salud-help">
        {t('patients.guardians.help', 'El tutor legal firma por un menor de edad. Quien paga recibe la factura (FEL) a su nombre y NIT.')}
      </p>
      {guardians.length === 0 && (
        <div className="salud-rows-empty muted">{t('patients.guardians.empty', 'Sin responsables. El paciente paga sus propias consultas.')}</div>
      )}
      {guardians.map((g, i) => (
        <div key={g.clientId ?? `n${i}`} className="salud-row">
          <div className="salud-guardian">
            <div>
              <div className="salud-result-name">{g.name}</div>
              <div className="muted mono">{g.nit || 'CF'}{g.phone ? ` · ${g.phone}` : ''}</div>
            </div>
            <div className="field-group">
              <label className="field-label">{t('patients.guardians.relationship', 'Parentesco *')}</label>
              <input className="field-input" value={g.relationship}
                placeholder={t('patients.guardians.relationshipHint', 'Madre, padre, empresa…')}
                onChange={(e) => set(i, { relationship: e.target.value })} />
            </div>
            <div className="salud-checks">
              <label className="salud-check">
                <input type="checkbox" checked={g.legalGuardian} onChange={(e) => set(i, { legalGuardian: e.target.checked })} />
                {t('patients.guardians.legal', 'Tutor legal')}
              </label>
              <label className="salud-check">
                <input type="checkbox" checked={g.payer}
                  onChange={(e) => onChange(guardians.map((x, j) => (
                    j === i ? { ...x, payer: e.target.checked } : (e.target.checked ? { ...x, payer: false } : x))))} />
                {t('patients.guardians.payer', 'Paga y recibe la factura')}
              </label>
            </div>
          </div>
          <Button variant="icon" icon="trash" type="button" title={t('common.remove', 'Quitar')} onClick={() => remove(i)} />
        </div>
      ))}
      <ClientSearch excludeIds={excluir} onPick={agregar} pushToast={pushToast} />
    </div>
  );
}
