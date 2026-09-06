// Stackline — Usuarios & Roles (ES module)
import React, { useState, useMemo, useEffect } from 'react';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import DataTable from '../components/DataTable.jsx';
import { MODULES_PERM, ACTIONS, initPerms, permsToMatrix, matrixToPerms } from '../lib/permissions.js';
import { useUsers, useRoles, useBranches } from '../hooks/useMasters.js';
import { createUser, updateUser, createRole, updateRole } from '../api/security.js';
import { useTranslation } from 'react-i18next';
import { useAuthLevels } from '../hooks/useOperations.js';

// managerId/authLevelId/branchIds son el árbol de autorizaciones: jefe directo,
// nivel de autoridad y qué sucursales cubre como aprobador.
const initUserForm = () => ({ name: '', email: '', role: '', branch: '', password: '',
  managerId: '', authLevelId: '', branchIds: [] });
const initRoleForm = () => ({ name: '', desc: '' });

function userInitials(name) {
  return name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
}

export default function Users({ pushToast }) {
  const { t } = useTranslation();
  const { items: authLevels } = useAuthLevels();
  const { items: usersData, reload: reloadUsers } = useUsers();
  const { items: rolesData, reload: reloadRoles } = useRoles();
  const { items: branchesData } = useBranches();

  const [tab, setTab] = useState('usuarios');

  // ── Usuarios state ───────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState(initUserForm());
  const [userErrors, setUserErrors] = useState({});
  const [selected, setSelected] = useState([]);

  // ── Roles state ──────────────────────────────────────────────────────────
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);

  // Sincroniza datos del servicio (con fallback a mock) al estado local editable.
  useEffect(() => { setUsers(usersData); }, [usersData]);
  useEffect(() => {
    setRoles(rolesData);
    setSelectedRole((cur) => cur || rolesData[0] || null);
  }, [rolesData]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState(initRoleForm());
  const [rolePerms, setRolePerms] = useState(initPerms);

  // ── Usuarios: filtrado ───────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u =>
      (!q || u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)) &&
      (!filterRole   || u.role   === filterRole) &&
      (!filterBranch || u.branch === filterBranch) &&
      (!filterStatus || u.status === filterStatus)
    );
  }, [users, search, filterRole, filterBranch, filterStatus]);

  const stats = useMemo(() => ({
    total:    users.length,
    active:   users.filter(u => u.status === 'active').length,
    inactive: users.filter(u => u.status === 'inactive').length,
    online:   users.filter(u => u.last === 'En línea').length,
  }), [users]);

  const roleList   = [...new Set(users.map(u => u.role))].sort();
  const branchList = [...new Set(users.map(u => u.branch))].sort();

  // ── Usuarios: acciones ───────────────────────────────────────────────────
  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm(initUserForm());
    setUserErrors({});
    setShowUserModal(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setUserForm({ name: u.name, email: u.email || '', role: u.role, branch: u.branch, password: '',
      managerId: u.managerId ?? '', authLevelId: u.authLevelId ?? '', branchIds: u.branchIds || [] });
    setUserErrors({});
    setShowUserModal(true);
  };

  const toggleUserStatus = async (u) => {
    const status = u.status === 'active' ? 'inactive' : 'active';
    try {
      await updateUser(u.id, {
        name: u.name, email: u.email, password: null,
        roleId: u.roleId, branchId: u.branchId, status,
      });
      await reloadUsers();
      pushToast('Estado de usuario actualizado', 'success');
    } catch (err) {
      pushToast('No se pudo actualizar el estado: ' + err.message, 'danger');
    }
  };

  const validateUserForm = () => {
    const e = {};
    if (!userForm.name.trim())  e.name  = 'Requerido';
    if (!userForm.email.trim()) e.email = 'Requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) e.email = 'Correo inválido';
    if (!userForm.role)   e.role   = 'Selecciona un rol';
    if (!editingUser && !userForm.password) e.password = 'Requerida para usuarios nuevos';
    return e;
  };

  const saveUser = async () => {
    const e = validateUserForm();
    if (Object.keys(e).length) { setUserErrors(e); return; }
    const roleId = roles.find(r => r.name === userForm.role)?.id ?? null;
    const branchId = branchesData.find(b => b.name === userForm.branch)?.id ?? null;
    const payload = {
      name: userForm.name,
      email: userForm.email,
      password: userForm.password || null,
      roleId,
      branchId,
      status: editingUser ? editingUser.status : 'active',
      managerId: userForm.managerId ? Number(userForm.managerId) : null,
      authLevelId: userForm.authLevelId ? Number(userForm.authLevelId) : null,
      branchIds: userForm.branchIds.map(Number),
    };
    try {
      if (editingUser) await updateUser(editingUser.id, payload);
      else await createUser(payload);
      await reloadUsers();
      pushToast(editingUser ? 'Usuario actualizado' : 'Usuario creado', 'success');
      setShowUserModal(false);
    } catch (err) {
      pushToast('No se pudo guardar el usuario: ' + err.message, 'danger');
    }
  };

  const setUF = (field, val) => {
    setUserForm(f => ({ ...f, [field]: val }));
    if (userErrors[field]) setUserErrors(e => ({ ...e, [field]: '' }));
  };

  const toggleSelect = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () =>
    setSelected(prev => prev.length === filteredUsers.length ? [] : filteredUsers.map(u => u.id));

  // ── Roles: acciones ──────────────────────────────────────────────────────
  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm(initRoleForm());
    setRolePerms(initPerms());
    setShowRoleModal(true);
  };

  const openEditRole = (r) => {
    setEditingRole(r);
    setRoleForm({ name: r.name, desc: r.desc });
    setRolePerms(permsToMatrix(r.perms));
    setShowRoleModal(true);
  };

  const togglePerm = (mod, acc) =>
    setRolePerms(p => ({ ...p, [mod]: { ...p[mod], [acc]: !p[mod][acc] } }));

  const saveRole = async () => {
    if (!roleForm.name.trim()) return;
    const payload = {
      name: roleForm.name,
      description: roleForm.desc,
      permissions: matrixToPerms(rolePerms),
    };
    try {
      if (editingRole) await updateRole(editingRole.id, payload);
      else await createRole(payload);
      await reloadRoles();
      pushToast(editingRole ? 'Rol actualizado' : 'Rol creado', 'success');
      setShowRoleModal(false);
    } catch (err) {
      pushToast('No se pudo guardar el rol: ' + err.message, 'danger');
    }
  };

  const matrixForRole = selectedRole ? permsToMatrix(selectedRole.perms) : initPerms();

  return (
    <div className="page">
      {/* Cabecera */}
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('users.title', 'Usuarios & Roles')}</h1>
          <div className="page-subtitle">{t('users.subtitle', 'Gestión de accesos · Roles y permisos del sistema')}</div>
        </div>
        <div className="page-head-actions">
          {tab === 'usuarios' && (
            <>
              <Button icon="download">{t('common.export', 'Exportar')}</Button>
              <Button icon="plus" variant="accent" onClick={openCreateUser}>{t('users.newUser', 'Nuevo usuario')}
              </Button>
            </>
          )}
          {tab === 'roles' && (
            <Button icon="plus" variant="accent" onClick={openCreateRole}>{t('users.newRole', 'Nuevo rol')}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${tab === 'usuarios' ? 'active' : ''}`} onClick={() => setTab('usuarios')}>
          {t('users.tabs.users', 'Usuarios')} <span className="count">{users.length}</span>
        </div>
        <div className={`tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>
          {t('users.tabs.roles', 'Roles & permisos')} <span className="count">{roles.length}</span>
        </div>
      </div>

      {/* ── TAB: USUARIOS ─────────────────────────────────────────────────── */}
      {tab === 'usuarios' && (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            {[
              { label: t('users.stats.total', 'Total usuarios'),    value: stats.total,    color: '' },
              { label: t('users.stats.active', 'Activos'),          value: stats.active,   color: 'var(--success)' },
              { label: t('users.stats.inactive', 'Inactivos'),      value: stats.inactive, color: 'var(--muted)' },
              { label: t('users.stats.online', 'En línea ahora'),   value: stats.online,   color: 'var(--accent)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ flex: 1 }}>
                <div className="card-body" style={{ padding: '12px 16px' }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 400, color: s.color || 'var(--text)' }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="filterbar">
            <div style={{ position: 'relative', width: 280 }}>
              <Icon name="search" size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                className="input"
                style={{ width: '100%', paddingLeft: 26 }}
                placeholder={t('users.searchPlaceholder', 'Buscar usuario o rol…')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="input" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="">{t('users.allRoles', 'Todos los roles')}</option>
              {roleList.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="input" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="">{t('users.allBranches', 'Todas las sucursales')}</option>
              {branchList.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">{t('users.allStatuses', 'Todos los estados')}</option>
              <option value="active">{t('users.activeOnly', 'Activos')}</option>
              <option value="inactive">{t('users.inactiveOnly', 'Inactivos')}</option>
            </select>
            <div className="grow"></div>
            <span className="muted mono" style={{ fontSize: 11 }}>{filteredUsers.length} {t('users.results', 'resultados')}</span>
            {(search || filterRole || filterBranch || filterStatus) && (
              <Button icon="x" size="sm" onClick={() => { setSearch(''); setFilterRole(''); setFilterBranch(''); setFilterStatus(''); }}>{t('users.clearFilters', 'Limpiar')}
              </Button>
            )}
          </div>

          {/* Bulk actions */}
          {selected.length > 0 && (
            <div className="tbl-toolbar" style={{ borderRadius: 'var(--shape-md)', border: '1px solid var(--md-sys-color-outline-variant)', background: 'var(--md-sys-color-secondary-container)' }}>
              <span className="label-large" style={{ color: 'var(--md-sys-color-on-secondary-container)' }}>
                {selected.length} {t('users.selected', 'seleccionado')}{selected.length > 1 ? 's' : ''}
              </span>
              <Button variant="ghost" onClick={() => setSelected([])}>{t('users.deselect', 'Deseleccionar')}</Button>
              <Button icon="trash" variant="ghost" style={{ marginLeft: 'auto', color: 'var(--md-sys-color-error)' }}>{t('users.deactivateSelected', 'Desactivar seleccionados')}
              </Button>
            </div>
          )}
          <DataTable
            rowKey={(u) => u.id}
            rows={filteredUsers}
            selectable
            selected={selected}
            onSelectedChange={setSelected}
            density="compact"
            pageSize={15}
            emptyIcon="users"
            empty={t('users.noMatch', 'Sin usuarios que coincidan con los filtros')}
            columns={[
              { key: 'name', header: t('common.user', 'Usuario'), sortable: true, render: (u) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: u.status === 'active' ? 'var(--md-sys-color-primary-container)' : 'var(--surface-3)', color: u.status === 'active' ? 'var(--md-sys-color-on-primary-container)' : 'var(--muted)' }}>
                    {userInitials(u.name)}
                  </div>
                  <div className="cell-stack">
                    <span className="nm">{u.name}</span>
                    <span className="sku">{u.email || u.name.toLowerCase().replace(/[^a-z\s]/g, '').split(' ').join('.').slice(0, 16) + '@stackline.gt'}</span>
                  </div>
                </div>
              ) },
              { key: 'role', header: t('users.role', 'Rol'), sortable: true, render: (u) => <RolePill role={u.role} /> },
              { key: 'branch', header: t('common.branch', 'Sucursal'), sortable: true },
              { key: 'last', header: t('users.lastAccess', 'Último acceso'), render: (u) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {u.last === 'En línea' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />}
                  <span className="sku">{u.last}</span>
                </div>
              ) },
              { key: 'status', header: t('common.status', 'Estado'), sortable: true, render: (u) => u.status === 'active'
                ? <span className="badge-m3 success">{t('common.active', 'Activo')}</span>
                : <span className="badge-m3">{t('common.inactive', 'Inactivo')}</span> },
            ]}
            actions={(u) => (
              <>
                <button className="icon-btn" disabled
                  title={t('users.resetPasswordPending', 'Restablecer contraseña — pendiente de implementar')}
                  aria-label={t('users.resetPassword', 'Restablecer contraseña')}
                ><Icon name="shield" size={16} /></button>
                <button className="icon-btn" style={{ width: 32, height: 32 }} title={t('users.editUser', 'Editar usuario')} onClick={() => openEditUser(u)}><Icon name="edit" size={18} /></button>
                <button className="icon-btn" style={{ width: 32, height: 32 }} title={u.status === 'active' ? t('users.deactivateUser', 'Desactivar usuario') : t('users.activateUser', 'Activar usuario')} onClick={() => toggleUserStatus(u)}><Icon name={u.status === 'active' ? 'x' : 'check'} size={18} /></button>
              </>
            )}
          />
        </>
      )}

      {/* ── TAB: ROLES & PERMISOS ─────────────────────────────────────────── */}
      {tab === 'roles' && (
        <div className="grid-2">
          {/* Lista de roles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="card">
              <div className="card-head">
                <h3>{t('users.definedRoles', 'Roles definidos')}</h3>
                <Button icon="plus" variant="accent" size="sm" onClick={openCreateRole}>{t('users.newRole', 'Nuevo rol')}
                </Button>
              </div>
              <div className="card-body flush">
                <table className="mtable">
                  <thead>
                    <tr>
                      <th>{t('users.role', 'Rol')}</th>
                      <th>{t('common.description', 'Descripción')}</th>
                      <th className="num">{t('users.usersCount', 'Usuarios')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map(r => (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRole(r)}
                        style={{
                          cursor: 'pointer',
                          background: selectedRole?.id === r.id ? 'var(--accent-soft)' : undefined,
                        }}
                      >
                        <td>
                          <div className="row gap-8">
                            <Icon name="shield" size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 500 }}>{r.name}</span>
                          </div>
                        </td>
                        <td className="muted">{r.desc}</td>
                        <td className="num"><span className="badge-m3">{r.users}</span></td>
                        <td>
                          <button
                            className="icon-btn"
                            title={t('users.editRole', 'Editar rol')}
                            onClick={e => { e.stopPropagation(); openEditRole(r); }}
                          >
                            <Icon name="edit" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Usuarios con el rol seleccionado */}
            {selectedRole && (
              <div className="card">
                <div className="card-head">
                  <h3>{t('users.usersWithRole', 'Usuarios con rol')} · {selectedRole.name}</h3>
                </div>
                <div className="card-body flush">
                  {users.filter(u => u.role === selectedRole.name).length === 0 ? (
                    <div className="empty" style={{ padding: 20 }}>{t('users.noAssignedUsers', 'Sin usuarios asignados')}</div>
                  ) : (
                    <table className="mtable">
                      <tbody>
                        {users.filter(u => u.role === selectedRole.name).map(u => (
                          <tr key={u.id}>
                            <td>
                              <div className="row gap-8">
                                <div className="avatar" style={{ width: 24, height: 24, fontSize: 11 }}>
                                  {userInitials(u.name)}
                                </div>
                                <span style={{ fontWeight: 500, fontSize: 12 }}>{u.name}</span>
                              </div>
                            </td>
                            <td className="muted">{u.branch}</td>
                            <td>
                              {u.status === 'active'
                                ? <span className="badge-m3 success"><span className="dot" />{t('common.active', 'Activo')}</span>
                                : <span className="badge-m3"><span className="dot" style={{ background: 'var(--muted)' }} />{t('common.inactive', 'Inactivo')}</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Matriz de permisos del rol seleccionado */}
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="card-head">
              <h3>
                {t('users.permissions', 'Permisos')} · {selectedRole?.name || '—'}
                {selectedRole?.perms.includes('*') && (
                  <span className="badge-m3 accent" style={{ marginLeft: 8 }}>{t('users.fullAccess', 'Acceso total')}</span>
                )}
              </h3>
            </div>
            {selectedRole ? (
              <div className="card-body flush">
                <table className="mtable">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 160 }}>{t('users.module', 'Módulo')}</th>
                      {ACTIONS.map(a => (
                        <th key={a} className="center" style={{ textTransform: 'capitalize' }}>{a}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES_PERM.map(mod => {
                      const p = matrixForRole[mod];
                      return (
                        <tr key={mod}>
                          <td style={{ fontWeight: 500 }}>{mod}</td>
                          {ACTIONS.map(acc => (
                            <td key={acc} className="center">
                              {p[acc]
                                ? <Icon name="check" size={13} style={{ color: 'var(--success)' }} />
                                : <Icon name="x"     size={11} style={{ color: 'var(--border-strong)' }} />
                              }
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty card-body">{t('users.selectRoleToView', 'Selecciona un rol para ver sus permisos')}</div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: Crear / Editar Usuario ────────────────────────────────── */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingUser ? `${t('common.edit', 'Editar')} · ${editingUser.name}` : t('users.newUser', 'Nuevo usuario')}</h3>
              <button className="icon-btn" onClick={() => setShowUserModal(false)}>
                <Icon name="x" />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>{t('users.form.fullName', 'Nombre completo *')}</label>
                  <input
                    type="text"
                    placeholder={t('users.form.fullNamePlaceholder', 'Ej. María García')}
                    value={userForm.name}
                    onChange={e => setUF('name', e.target.value)}
                    autoFocus
                  />
                  {userErrors.name && <span className="login-error">{userErrors.name}</span>}
                </div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>{t('common.email', 'Correo electrónico *')}</label>
                  <input
                    type="email"
                    placeholder={t('users.form.emailPlaceholder', 'usuario@empresa.com')}
                    value={userForm.email}
                    onChange={e => setUF('email', e.target.value)}
                  />
                  {userErrors.email && <span className="login-error">{userErrors.email}</span>}
                </div>
                <div className="field">
                  <label>{t('users.role', 'Rol *')}</label>
                  <select value={userForm.role} onChange={e => setUF('role', e.target.value)}>
                    <option value="">{t('users.form.selectRole', 'Seleccionar…')}</option>
                    {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                  {userErrors.role && <span className="login-error">{userErrors.role}</span>}
                </div>
                <div className="field">
                  <label>{t('common.branch', 'Sucursal *')}</label>
                  <select value={userForm.branch} onChange={e => setUF('branch', e.target.value)}>
                    <option value="">{t('users.form.selectBranch', 'Seleccionar…')}</option>
                    {branchesData.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                  {userErrors.branch && <span className="login-error">{userErrors.branch}</span>}
                </div>
                <div className="field">
                  <label>{t('users.form.manager', 'Jefe directo')}</label>
                  <select value={userForm.managerId} onChange={e => setUF('managerId', e.target.value)}>
                    <option value="">{t('users.form.noManager', 'Sin jefe (raíz)')}</option>
                    {users.filter(u => !editingUser || u.id !== editingUser.id)
                      .map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>{t('users.form.authLevel', 'Nivel de autoridad')}</label>
                  <select value={userForm.authLevelId} onChange={e => setUF('authLevelId', e.target.value)}>
                    <option value="">{t('users.form.noLevel', 'Operativo (no aprueba)')}</option>
                    {authLevels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>{t('users.form.scope', 'Sucursales que cubre como aprobador')}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                    {branchesData.map(b => {
                      const on = userForm.branchIds.includes(b.id);
                      return (
                        <Button
                          key={b.id} type="button" size="sm"
                          variant={on ? 'accent' : 'outlined'}
                          icon={on ? 'check' : undefined}
                          onClick={() => setUF('branchIds', on
                            ? userForm.branchIds.filter(x => x !== b.id)
                            : [...userForm.branchIds, b.id])}
                        >{b.name}</Button>
                      );
                    })}
                  </div>
                  <span className="cfg-hint">
                    {t('users.form.scopeHint', 'Sin sucursales marcadas no podrá autorizar nada.')}
                  </span>
                </div>
                {!editingUser && (
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>{t('users.form.tempPassword', 'Contraseña temporal *')}</label>
                    <input
                      type="password"
                      placeholder={t('users.form.tempPasswordPlaceholder', 'Mínimo 8 caracteres')}
                      value={userForm.password}
                      onChange={e => setUF('password', e.target.value)}
                    />
                    {userErrors.password && <span className="login-error">{userErrors.password}</span>}
                  </div>
                )}
              </div>
              {userForm.role && (
                <div style={{
                  marginTop: 14, padding: '10px 14px',
                  background: 'var(--surface-2)', borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Icon name="shield" size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{userForm.role}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {roles.find(r => r.name === userForm.role)?.desc || ''}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <Button onClick={() => setShowUserModal(false)}>{t('common.cancel', 'Cancelar')}</Button>
              <Button icon="check" variant="accent" onClick={saveUser}>{editingUser ? t('users.saveChanges', 'Guardar cambios') : t('users.newUser', 'Crear usuario')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Crear / Editar Rol ─────────────────────────────────────── */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal" style={{ width: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingRole ? `${t('users.editRole', 'Editar rol')} · ${editingRole.name}` : t('users.newRole', 'Nuevo rol')}</h3>
              <button className="icon-btn" onClick={() => setShowRoleModal(false)}>
                <Icon name="x" />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="field">
                  <label>{t('users.form.roleName', 'Nombre del rol *')}</label>
                  <input
                    type="text"
                    value={roleForm.name}
                    onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={t('users.form.roleNamePlaceholder', 'Ej. Supervisor de ventas')}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>{t('common.description', 'Descripción')}</label>
                  <input
                    type="text"
                    value={roleForm.desc}
                    onChange={e => setRoleForm(f => ({ ...f, desc: e.target.value }))}
                    placeholder={t('users.form.roleDescPlaceholder', 'Resumen de responsabilidades')}
                  />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
                {t('users.permissionsMatrix', 'Matriz de permisos')}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="mtable">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 170 }}>{t('users.module', 'Módulo')}</th>
                      {ACTIONS.map(a => (
                        <th key={a} className="center" style={{ textTransform: 'capitalize' }}>{a}</th>
                      ))}
                      <th className="center">{t('users.all', 'Todo')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES_PERM.map(mod => {
                      const p = rolePerms[mod];
                      const allOn = ACTIONS.every(a => p[a]);
                      return (
                        <tr key={mod}>
                          <td style={{ fontWeight: 500 }}>{mod}</td>
                          {ACTIONS.map(acc => (
                            <td key={acc} className="center">
                              <input
                                type="checkbox"
                                checked={p[acc]}
                                onChange={() => togglePerm(mod, acc)}
                                style={{ accentColor: 'var(--accent)', width: 14, height: 14, cursor: 'pointer' }}
                              />
                            </td>
                          ))}
                          <td className="center">
                            <input
                              type="checkbox"
                              checked={allOn}
                              onChange={() => {
                                const val = !allOn;
                                setRolePerms(prev => ({ ...prev, [mod]: Object.fromEntries(ACTIONS.map(a => [a, val])) }));
                              }}
                              style={{ accentColor: 'var(--accent)', width: 14, height: 14, cursor: 'pointer' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-foot">
              <Button onClick={() => setShowRoleModal(false)}>{t('common.cancel', 'Cancelar')}</Button>
              <Button icon="check" variant="accent" disabled={!roleForm.name.trim()} onClick={saveRole}>{editingRole ? t('users.saveChanges', 'Guardar cambios') : t('users.newRole', 'Crear rol')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RolePill({ role }) {
  const map = {
    'Administrador': 'danger',
    'Encargado':     'warning',
    'Cajero':        'accent',
    'Inventario':    'info',
    'Contador':      '',
  };
  const cls = map[role] || '';
  return <span className={`badge-m3 ${cls}`}>{role}</span>;
}
