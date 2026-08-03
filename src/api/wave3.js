// Endpoints del Bloque 6 (Wave 3): planilla, activos fijos, lealtad, bancos y presupuestos.
import { api } from './client.js';

// ── Planilla ──────────────────────────────────────────────────────────
export const listEmployees = () => api.get('/api/employees');
export const createEmployee = (data) => api.post('/api/employees', data);
export const updateEmployee = (id, data) => api.put(`/api/employees/${id}`, data);
export const deleteEmployee = (id) => api.del(`/api/employees/${id}`);
export const listPayrollPeriods = () => api.get('/api/payroll-periods');
export const getPayrollPeriod = (id) => api.get(`/api/payroll-periods/${id}`);
export const createPayrollPeriod = (data) => api.post('/api/payroll-periods', data);
export const generatePayroll = (data) => api.post('/api/payroll-periods/generate', data);
export const processPayroll = (id) => api.post(`/api/payroll-periods/${id}/process`);
export const closePayroll = (id) => api.post(`/api/payroll-periods/${id}/close`);
export const payrollIgssReport = (id) => api.get(`/api/payroll-periods/${id}/igss`);
export const payrollIsrReport = (id) => api.get(`/api/payroll-periods/${id}/isr`);

// ── Activos fijos ─────────────────────────────────────────────────────
export const listAssets = () => api.get('/api/fixed-assets');
export const getAsset = (id) => api.get(`/api/fixed-assets/${id}`);
export const createAsset = (data) => api.post('/api/fixed-assets', data);
export const updateAsset = (id, data) => api.put(`/api/fixed-assets/${id}`, data);
export const deleteAsset = (id) => api.del(`/api/fixed-assets/${id}`);
export const assetDepreciationHistory = (id) => api.get(`/api/fixed-assets/${id}/depreciation`);
export const depreciateAsset = (id) => api.post(`/api/fixed-assets/${id}/depreciate`);
export const disposeAsset = (id, data) => api.post(`/api/fixed-assets/${id}/dispose`, data);

// ── Lealtad ───────────────────────────────────────────────────────────
export const listLoyaltyAccounts = () => api.get('/api/loyalty/accounts');
export const getLoyaltyAccount = (id) => api.get(`/api/loyalty/accounts/${id}`);
export const createLoyaltyAccount = (data) => api.post('/api/loyalty/accounts', data);
export const loyaltyMovements = (id) => api.get(`/api/loyalty/accounts/${id}/movements`);
export const addLoyaltyMovement = (id, data) => api.post(`/api/loyalty/accounts/${id}/movements`, data);

// ── Bancos y conciliación ─────────────────────────────────────────────
export const listBankAccounts = () => api.get('/api/bank-accounts');
export const getBankAccount = (id) => api.get(`/api/bank-accounts/${id}`);
export const createBankAccount = (data) => api.post('/api/bank-accounts', data);
export const updateBankAccount = (id, data) => api.put(`/api/bank-accounts/${id}`, data);
export const bankMovements = (id) => api.get(`/api/bank-accounts/${id}/movements`);
export const addBankMovement = (id, data) => api.post(`/api/bank-accounts/${id}/movements`, data);
export const bankReconciliations = (id) => api.get(`/api/bank-accounts/${id}/reconciliations`);
export const reconcileBank = (id, data) => api.post(`/api/bank-accounts/${id}/reconciliations`, data);

// ── Presupuestos ──────────────────────────────────────────────────────
export const listBudgets = () => api.get('/api/budgets');
export const getBudget = (id) => api.get(`/api/budgets/${id}`);
export const createBudget = (data) => api.post('/api/budgets', data);
export const addBudgetLine = (id, data) => api.post(`/api/budgets/${id}/lines`, data);
