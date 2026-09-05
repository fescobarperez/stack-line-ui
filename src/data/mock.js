// Stackline — Mock data (ES module)
// Sustituye con llamadas a /api/* cuando el backend esté listo.

// Stackline — Mock data
// All data is mock for demo purposes.

export const Q = (n) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const Qs = (n) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const CATEGORIES = [
  { id: 'todos', name: 'Todos', count: 1248 },
  { id: 'abarrotes', name: 'Abarrotes', count: 312, icon: '🥫' },
  { id: 'bebidas', name: 'Bebidas', count: 184, icon: '🥤' },
  { id: 'lacteos', name: 'Lácteos', count: 96, icon: '🥛' },
  { id: 'panaderia', name: 'Panadería', count: 64, icon: '🍞' },
  { id: 'limpieza', name: 'Limpieza', count: 142, icon: '🧴' },
  { id: 'higiene', name: 'Higiene', count: 118, icon: '🧼' },
  { id: 'snacks', name: 'Snacks', count: 156, icon: '🍿' },
  { id: 'congelados', name: 'Congelados', count: 88, icon: '🧊' },
  { id: 'papeleria', name: 'Papelería', count: 48, icon: '📎' },
  { id: 'mascotas', name: 'Mascotas', count: 40, icon: '🐾' },
];

export const PRODUCTS = [
  { sku: '7501055309856', name: 'Arroz Blanco Premium 1kg',     cat: 'abarrotes', price: 12.50, cost: 8.20,  stock: 142, min: 30, unit: 'unid', batch: 'L2604-A', exp: '2027-03' },
  { sku: '7501031311309', name: 'Frijol Negro 1kg',              cat: 'abarrotes', price: 14.00, cost: 9.50,  stock: 88,  min: 30, unit: 'unid', batch: 'L2604-B', exp: '2027-01' },
  { sku: '7501055361816', name: 'Azúcar Estándar 2kg',           cat: 'abarrotes', price: 18.75, cost: 13.00, stock: 64,  min: 25, unit: 'unid', batch: 'L2605-A', exp: '2028-06' },
  { sku: '7501008456789', name: 'Aceite Vegetal 900ml',          cat: 'abarrotes', price: 22.00, cost: 16.40, stock: 12,  min: 20, unit: 'unid', batch: 'L2604-C', exp: '2026-12' },
  { sku: '7501055312987', name: 'Sal Refinada 1kg',              cat: 'abarrotes', price: 6.50,  cost: 3.80,  stock: 210, min: 40, unit: 'unid' },
  { sku: '7501055365432', name: 'Pasta Spaghetti 200g',          cat: 'abarrotes', price: 4.75,  cost: 2.90,  stock: 188, min: 50, unit: 'unid', batch: 'L2603-X', exp: '2027-09' },
  { sku: '7501055333321', name: 'Harina de Maíz 1kg',            cat: 'abarrotes', price: 9.25,  cost: 6.10,  stock: 132, min: 30, unit: 'unid', batch: 'L2605-B', exp: '2026-11' },

  { sku: '7501031125678', name: 'Coca-Cola 600ml',               cat: 'bebidas', price: 8.50,  cost: 5.20, stock: 98,  min: 36, unit: 'unid' },
  { sku: '7501031125890', name: 'Pepsi 600ml',                   cat: 'bebidas', price: 8.00,  cost: 4.80, stock: 76,  min: 36, unit: 'unid' },
  { sku: '7501031145552', name: 'Agua Pura Salvavidas 600ml',    cat: 'bebidas', price: 4.50,  cost: 2.10, stock: 240, min: 60, unit: 'unid' },
  { sku: '7501031134567', name: 'Jugo Naranja Del Frutal 1L',    cat: 'bebidas', price: 16.00, cost: 11.20, stock: 8,   min: 18, unit: 'unid', batch: 'L2604-J', exp: '2026-08' },
  { sku: '7501031165432', name: 'Cerveza Gallo 350ml',           cat: 'bebidas', price: 10.50, cost: 6.80,  stock: 156, min: 48, unit: 'unid' },
  { sku: '7501031199911', name: 'Café Soluble Frasco 200g',      cat: 'bebidas', price: 42.00, cost: 28.50, stock: 28,  min: 12, unit: 'unid', batch: 'L2603-Y' },

  { sku: '7501074234567', name: 'Leche Foremost 1L',             cat: 'lacteos', price: 14.50, cost: 9.80,  stock: 22, min: 30, unit: 'unid', batch: 'L2604-M', exp: '2026-07-15' },
  { sku: '7501074234890', name: 'Yogurt Natural 250ml',          cat: 'lacteos', price: 9.00,  cost: 5.60,  stock: 34, min: 20, unit: 'unid', batch: 'L2604-Y', exp: '2026-07-22' },
  { sku: '7501074298765', name: 'Queso Fresco 200g',             cat: 'lacteos', price: 18.50, cost: 12.20, stock: 18, min: 12, unit: 'unid', batch: 'L2604-Q', exp: '2026-07-08' },
  { sku: '7501074276543', name: 'Mantequilla La Pradera 200g',   cat: 'lacteos', price: 22.00, cost: 14.80, stock: 16, min: 10, unit: 'unid', batch: 'L2604-MA' },

  { sku: '7501088100012', name: 'Pan Francés 4pz',               cat: 'panaderia', price: 6.00, cost: 3.20, stock: 28, min: 20, unit: 'paq', batch: 'HOY-A' },
  { sku: '7501088100029', name: 'Pan de Manteca',                cat: 'panaderia', price: 2.50, cost: 1.10, stock: 64, min: 30, unit: 'unid', batch: 'HOY-B' },
  { sku: '7501088100036', name: 'Bolillo / Champurrada',         cat: 'panaderia', price: 3.00, cost: 1.40, stock: 42, min: 20, unit: 'unid', batch: 'HOY-C' },

  { sku: '7501035010123', name: 'Detergente Ariel 1kg',          cat: 'limpieza', price: 38.50, cost: 26.40, stock: 42,  min: 18, unit: 'unid' },
  { sku: '7501035010130', name: 'Cloro Magia Blanca 1L',         cat: 'limpieza', price: 12.50, cost: 7.80,  stock: 88,  min: 24, unit: 'unid' },
  { sku: '7501035010147', name: 'Jabón Lavaplatos Axion',        cat: 'limpieza', price: 14.00, cost: 9.20,  stock: 56,  min: 20, unit: 'unid' },
  { sku: '7501035010154', name: 'Papel Higiénico Petalo 4pz',    cat: 'limpieza', price: 18.50, cost: 12.80, stock: 96,  min: 36, unit: 'paq' },
  { sku: '7501035010161', name: 'Limpiador Pinol 900ml',         cat: 'limpieza', price: 16.25, cost: 10.40, stock: 5,   min: 15, unit: 'unid' },

  { sku: '7501045500011', name: 'Shampoo Sedal 350ml',           cat: 'higiene', price: 28.00, cost: 18.50, stock: 38, min: 16, unit: 'unid' },
  { sku: '7501045500028', name: 'Pasta Dental Colgate 100ml',    cat: 'higiene', price: 16.50, cost: 10.80, stock: 64, min: 24, unit: 'unid' },
  { sku: '7501045500035', name: 'Desodorante Rexona Stick',      cat: 'higiene', price: 32.00, cost: 22.00, stock: 28, min: 14, unit: 'unid' },
  { sku: '7501045500042', name: 'Jabón Protex Barra',            cat: 'higiene', price: 7.50,  cost: 4.20,  stock: 142, min: 40, unit: 'unid' },

  { sku: '7501073400001', name: 'Sabritas Original 70g',         cat: 'snacks', price: 8.00,  cost: 4.80,  stock: 76, min: 30, unit: 'unid' },
  { sku: '7501073400018', name: 'Doritos Nacho 60g',             cat: 'snacks', price: 8.50,  cost: 5.10,  stock: 58, min: 30, unit: 'unid' },
  { sku: '7501073400025', name: 'Galletas María Gamesa',         cat: 'snacks', price: 5.00,  cost: 2.80,  stock: 124, min: 40, unit: 'unid' },
  { sku: '7501073400032', name: 'Chocolate Milky Way',           cat: 'snacks', price: 7.50,  cost: 4.50,  stock: 96, min: 30, unit: 'unid' },
  { sku: '7501073400049', name: 'Cacahuates Nishikawa 100g',     cat: 'snacks', price: 12.00, cost: 7.80,  stock: 44, min: 20, unit: 'unid' },

  { sku: '7501099112345', name: 'Pizza Congelada Stouffer',      cat: 'congelados', price: 38.00, cost: 26.80, stock: 18, min: 8, unit: 'unid', batch: 'L2604-P', exp: '2027-01' },
  { sku: '7501099112352', name: 'Helado Sarita 1L',              cat: 'congelados', price: 32.00, cost: 22.40, stock: 24, min: 10, unit: 'unid' },
  { sku: '7501099112369', name: 'Carne Molida 500g',             cat: 'congelados', price: 32.50, cost: 23.00, stock: 14, min: 10, unit: 'paq' },

  { sku: '7501122000123', name: 'Cuaderno 100 hojas',            cat: 'papeleria', price: 18.00, cost: 11.20, stock: 48, min: 15, unit: 'unid' },
  { sku: '7501122000130', name: 'Lápiz Mongol HB',               cat: 'papeleria', price: 2.50,  cost: 1.20,  stock: 184, min: 50, unit: 'unid' },
  { sku: '7501122000147', name: 'Lapicero Bic Azul',             cat: 'papeleria', price: 3.50,  cost: 1.80,  stock: 156, min: 50, unit: 'unid' },

  { sku: '7501144500011', name: 'Croquetas Perro 2kg',           cat: 'mascotas', price: 78.00, cost: 56.00, stock: 12, min: 8, unit: 'paq' },
  { sku: '7501144500028', name: 'Arena Gato 4kg',                cat: 'mascotas', price: 56.00, cost: 38.50, stock: 9,  min: 6, unit: 'paq' },
];

PRODUCTS.forEach(p => {
  const w = p.name.split(' ').filter(s => s.length > 2);
  p.initials = (w[0] || p.name).substring(0, 1).toUpperCase() + (w[1] ? w[1].substring(0,1).toUpperCase() : '');
  // avgCost = costo actual promedio ponderado (ligera variación sobre el costo base)
  p.avgCost = +(p.cost * (1 + (Math.random() * 0.04 - 0.02))).toFixed(4);
});

export const BRANCHES = [
  { id: 'mx', name: 'Sucursal Centro', addr: 'Zona 1, Guatemala', sales: 18420.50, status: 'active' },
  { id: 'zn10', name: 'Sucursal Zona 10', addr: '5a Av. 10-25 Z.10', sales: 24800.75, status: 'active' },
  { id: 'mix', name: 'Sucursal Mixco', addr: 'Calz. San Juan, Mixco', sales: 14300.00, status: 'active' },
  { id: 'ant', name: 'Sucursal Antigua', addr: '4a Calle Oriente, Antigua', sales: 9200.25, status: 'active' },
  { id: 'esc', name: 'Sucursal Escuintla', addr: 'Bulevar Centroamérica', sales: 6840.00, status: 'paused' },
];

export const SUPPLIERS = [
  { id: 'pv01', name: 'Distribuidora La Pradera, S.A.', nit: '8745619-2', contact: 'Lic. Carlos Méndez', phone: '+502 2235-4400', terms: '30 días', balance: 24560.00 },
  { id: 'pv02', name: 'Alimentos Maravilla',           nit: '6543210-1', contact: 'Sra. Ana Pérez',    phone: '+502 2387-1100', terms: '15 días', balance: 8420.50 },
  { id: 'pv03', name: 'Cervecería Centroamericana',    nit: '1234567-K', contact: 'Sr. Roberto Cano',  phone: '+502 2289-5500', terms: 'Contado', balance: 0 },
  { id: 'pv04', name: 'Productos Quaker GT',           nit: '9876543-4', contact: 'Lic. Sofía Ruiz',   phone: '+502 2360-8800', terms: '45 días', balance: 16200.00 },
  { id: 'pv05', name: 'Lácteos Foremost',              nit: '5432198-7', contact: 'Sra. María López',  phone: '+502 2378-2200', terms: '15 días', balance: 5680.25 },
  { id: 'pv06', name: 'Limpieza Industrial Maya',      nit: '3210987-3', contact: 'Sr. Diego Alvarado', phone: '+502 2459-3300', terms: '30 días', balance: 3120.00 },
];

export const USERS = [
  { id: 'u1', name: 'Ana López',         role: 'Administrador',  branch: 'Zona 10',  status: 'active',  last: 'Hace 2 min' },
  { id: 'u2', name: 'Carlos Méndez',     role: 'Cajero',         branch: 'Zona 10',  status: 'active',  last: 'En línea' },
  { id: 'u3', name: 'María Hernández',   role: 'Encargado',      branch: 'Centro',   status: 'active',  last: 'Hace 14 min' },
  { id: 'u4', name: 'José Ramírez',      role: 'Cajero',         branch: 'Mixco',    status: 'active',  last: 'En línea' },
  { id: 'u5', name: 'Lucía Castillo',    role: 'Inventario',     branch: 'Zona 10',  status: 'active',  last: 'Hace 1 h' },
  { id: 'u6', name: 'Pedro Morales',     role: 'Cajero',         branch: 'Antigua',  status: 'active',  last: 'Hace 3 min' },
  { id: 'u7', name: 'Roberto Estrada',   role: 'Cajero',         branch: 'Escuintla',status: 'inactive', last: 'Hace 12 días' },
  { id: 'u8', name: 'Sofía Aguilar',     role: 'Contador',       branch: 'Centro',   status: 'active',  last: 'Hace 22 min' },
];

export const CLIENTS = [
  { id: 1, name: 'Supermercado El Ahorro, S.A.',  nit: '4521789-3', clientType: 'mayorista', address: '5a Calle 12-34, Zona 1, Guatemala',    phone: '+502 2238-1100', email: 'compras@elahorro.gt',   creditLimit: 50000, paymentTerms: 30, balance: 12400.00, status: 'active',  createdAt: '2025-01-15' },
  { id: 2, name: 'Tienda La Esperanza',           nit: '6234501-8', clientType: 'minorista', address: 'Calz. Roosevelt km 12.5, Mixco',         phone: '+502 5544-8821', email: null,                    creditLimit: 8000,  paymentTerms: 15, balance: 2150.50,  status: 'active',  createdAt: '2025-02-03' },
  { id: 3, name: 'Consumidor Final',              nit: 'CF',        clientType: 'CF',        address: null,                                     phone: null,             email: null,                    creditLimit: 0,     paymentTerms: 0,  balance: 0,        status: 'active',  createdAt: '2025-01-01' },
  { id: 4, name: 'Restaurante Don Quijote',       nit: '8876543-2', clientType: 'mayorista', address: '6a Av. 5-10, Zona 10, Guatemala',        phone: '+502 2366-7700', email: 'pedidos@donquijote.gt', creditLimit: 25000, paymentTerms: 30, balance: 6800.00,  status: 'active',  createdAt: '2025-03-08' },
  { id: 5, name: 'Mini-super Claudia',            nit: '3347821-5', clientType: 'minorista', address: 'Col. Las Flores, Zona 12',               phone: '+502 5612-3344', email: null,                    creditLimit: 3000,  paymentTerms: 0,  balance: 0,        status: 'active',  createdAt: '2025-03-20' },
  { id: 6, name: 'Distribuidora Fuentes, S.A.',   nit: '7865432-1', clientType: 'mayorista', address: 'Bulevar Liberación 12-50, Zona 9',       phone: '+502 2385-4400', email: 'info@dfuentes.com.gt',  creditLimit: 100000,paymentTerms: 45, balance: 38900.00, status: 'active',  createdAt: '2025-01-22' },
  { id: 7, name: 'Hotel Gran Metrópolis',         nit: '9234567-0', clientType: 'exento',    address: 'Av. Reforma 14-01, Zona 9',              phone: '+502 2421-5555', email: 'compras@granmetro.gt',  creditLimit: 40000, paymentTerms: 30, balance: 14200.00, status: 'active',  createdAt: '2025-02-14' },
  { id: 8, name: 'Lic. Roberto Cifuentes',        nit: '2187654-9', clientType: 'CF',        address: 'Zona 15, Guatemala',                     phone: '+502 5878-2244', email: 'rcifuentes@gmail.com',  creditLimit: 1000,  paymentTerms: 0,  balance: 450.00,   status: 'active',  createdAt: '2025-04-02' },
  { id: 9, name: 'Cafetería Universitaria USAC',  nit: '1024578-K', clientType: 'exento',    address: 'Ciudad Universitaria, Zona 12',           phone: '+502 2418-8000', email: null,                    creditLimit: 15000, paymentTerms: 30, balance: 3200.00,  status: 'active',  createdAt: '2025-04-18' },
  { id:10, name: 'Abarrotería San Pedro',         nit: '5543210-7', clientType: 'minorista', address: 'San Pedro Sacatepéquez, Sacatepéquez',   phone: '+502 7832-1122', email: null,                    creditLimit: 5000,  paymentTerms: 15, balance: 1850.00,  status: 'blocked', createdAt: '2025-05-01' },
];

export const CLIENT_PAYMENTS = [
  { id: 1, clientId: 1, saleId: 'T-2026-00142', amount: 5000.00, date: '2026-05-10', paymentMethod: 'transferencia', reference: 'TRF-48821', notes: null },
  { id: 2, clientId: 1, saleId: 'T-2026-00110', amount: 8000.00, date: '2026-04-28', paymentMethod: 'cheque',        reference: 'CHQ-00341', notes: 'Cheque Banrural' },
  { id: 3, clientId: 4, saleId: null,            amount: 3000.00, date: '2026-05-15', paymentMethod: 'efectivo',      reference: null,        notes: 'Abono cuenta' },
  { id: 4, clientId: 6, saleId: 'T-2026-00088', amount: 15000.00,date: '2026-05-18', paymentMethod: 'transferencia', reference: 'TRF-48900', notes: null },
  { id: 5, clientId: 7, saleId: null,            amount: 10000.00,date: '2026-05-20', paymentMethod: 'cheque',        reference: 'CHQ-00412', notes: 'Pago mensual' },
];

export const ROLES = [
  { id: 'r1', name: 'Administrador', perms: ['*'], users: 2, desc: 'Acceso total al sistema' },
  { id: 'r2', name: 'Encargado',     perms: ['pos','inv:r','rpt','tkt'], users: 4, desc: 'Operación de sucursal' },
  { id: 'r3', name: 'Cajero',        perms: ['pos','tkt:r'], users: 12, desc: 'Solo punto de venta' },
  { id: 'r4', name: 'Inventario',    perms: ['inv','rpt:com'], users: 3, desc: 'Stock y compras' },
  { id: 'r5', name: 'Contador',      perms: ['rpt','tkt'], users: 2, desc: 'Reportería y facturación' },
];

// Recent sales / tickets
export const TICKETS = [
  { id: 'T-2026-04823', date: '2026-05-21 14:32', cashier: 'Carlos M.',  branch: 'Zona 10', items: 6,  pay: 'Tarjeta',     total: 248.75, status: 'paid' },
  { id: 'T-2026-04822', date: '2026-05-21 14:28', cashier: 'Carlos M.',  branch: 'Zona 10', items: 2,  pay: 'Efectivo',    total: 32.00,  status: 'paid' },
  { id: 'T-2026-04821', date: '2026-05-21 14:21', cashier: 'José R.',    branch: 'Mixco',   items: 14, pay: 'Tarjeta',     total: 542.30, status: 'paid' },
  { id: 'T-2026-04820', date: '2026-05-21 14:18', cashier: 'María H.',   branch: 'Centro',  items: 4,  pay: 'Efectivo',    total: 76.50,  status: 'paid' },
  { id: 'T-2026-04819', date: '2026-05-21 14:11', cashier: 'Carlos M.',  branch: 'Zona 10', items: 1,  pay: 'Transferencia',total: 78.00,  status: 'paid' },
  { id: 'T-2026-04818', date: '2026-05-21 14:02', cashier: 'José R.',    branch: 'Mixco',   items: 8,  pay: 'Tarjeta',     total: 324.85, status: 'paid' },
  { id: 'T-2026-04817', date: '2026-05-21 13:58', cashier: 'Pedro M.',   branch: 'Antigua', items: 3,  pay: 'Efectivo',    total: 48.50,  status: 'paid' },
  { id: 'T-2026-04816', date: '2026-05-21 13:54', cashier: 'María H.',   branch: 'Centro',  items: 11, pay: 'Efectivo',    total: 198.25, status: 'paid' },
  { id: 'T-2026-04815', date: '2026-05-21 13:42', cashier: 'Carlos M.',  branch: 'Zona 10', items: 5,  pay: 'Tarjeta',     total: 156.75, status: 'refunded' },
  { id: 'T-2026-04814', date: '2026-05-21 13:38', cashier: 'José R.',    branch: 'Mixco',   items: 2,  pay: 'Efectivo',    total: 22.00,  status: 'paid' },
  { id: 'T-2026-04813', date: '2026-05-21 13:30', cashier: 'María H.',   branch: 'Centro',  items: 9,  pay: 'Tarjeta',     total: 412.40, status: 'paid' },
  { id: 'T-2026-04812', date: '2026-05-21 13:24', cashier: 'Pedro M.',   branch: 'Antigua', items: 6,  pay: 'Transferencia',total: 142.00, status: 'paid' },
  { id: 'T-2026-04811', date: '2026-05-21 13:18', cashier: 'Carlos M.',  branch: 'Zona 10', items: 4,  pay: 'Efectivo',    total: 88.50,  status: 'paid' },
  { id: 'T-2026-04810', date: '2026-05-21 13:09', cashier: 'José R.',    branch: 'Mixco',   items: 15, pay: 'Tarjeta',     total: 624.10, status: 'paid' },
  { id: 'T-2026-04809', date: '2026-05-21 13:02', cashier: 'María H.',   branch: 'Centro',  items: 3,  pay: 'Efectivo',    total: 56.75,  status: 'paid' },
];

// Sales by day (last 14 days)
export const SALES_TREND = [
  { d: '2026-05-08', total: 18420, tickets: 142 },
  { d: '2026-05-09', total: 22100, tickets: 168 },
  { d: '2026-05-10', total: 19800, tickets: 154 },
  { d: '2026-05-11', total: 14200, tickets: 112 },
  { d: '2026-05-12', total: 16800, tickets: 132 },
  { d: '2026-05-13', total: 21400, tickets: 162 },
  { d: '2026-05-14', total: 23800, tickets: 184 },
  { d: '2026-05-15', total: 26200, tickets: 196 },
  { d: '2026-05-16', total: 28400, tickets: 218 },
  { d: '2026-05-17', total: 22000, tickets: 168 },
  { d: '2026-05-18', total: 20100, tickets: 156 },
  { d: '2026-05-19', total: 24700, tickets: 188 },
  { d: '2026-05-20', total: 27300, tickets: 204 },
  { d: '2026-05-21', total: 18650, tickets: 142 },
];

// Sales by category
export const SALES_BY_CAT = [
  { cat: 'Abarrotes',   sales: 86420, pct: 28 },
  { cat: 'Bebidas',     sales: 64200, pct: 21 },
  { cat: 'Snacks',      sales: 42800, pct: 14 },
  { cat: 'Lácteos',     sales: 36200, pct: 12 },
  { cat: 'Limpieza',    sales: 32100, pct: 10 },
  { cat: 'Higiene',     sales: 24500,  pct: 8 },
  { cat: 'Otros',       sales: 21380,  pct: 7 },
];

// Top products
export const TOP_PRODUCTS = [
  { sku: '7501031145552', name: 'Agua Pura Salvavidas 600ml', qty: 1248, total: 5616.00, trend: '+12%' },
  { sku: '7501031125678', name: 'Coca-Cola 600ml',            qty: 892,  total: 7582.00, trend: '+18%' },
  { sku: '7501055309856', name: 'Arroz Blanco Premium 1kg',   qty: 624,  total: 7800.00, trend: '+4%'  },
  { sku: '7501031165432', name: 'Cerveza Gallo 350ml',        qty: 542,  total: 5691.00, trend: '+22%' },
  { sku: '7501073400025', name: 'Galletas María Gamesa',      qty: 488,  total: 2440.00, trend: '-3%'  },
  { sku: '7501035010130', name: 'Cloro Magia Blanca 1L',      qty: 386,  total: 4825.00, trend: '+8%'  },
  { sku: '7501074234567', name: 'Leche Foremost 1L',          qty: 348,  total: 5046.00, trend: '-1%'  },
  { sku: '7501088100029', name: 'Pan de Manteca',             qty: 324,  total: 810.00,  trend: '+15%' },
];

// Purchase orders con ítems de detalle
export const PURCHASE_ORDERS = [
  {
    id: 'OC-2026-0142', date: '2026-05-20', supplier: 'Distribuidora La Pradera, S.A.', supplierId: 'pv01',
    total: 8420.00, status: 'received', branch: 'Zona 10', branchId: 'zn10', notes: null,
    items: [
      { id: 1, sku: '7501055309856', name: 'Arroz Blanco Premium 1kg',  qtyOrdered: 60, qtyReceived: 60, unitCost: 8.20 },
      { id: 2, sku: '7501031311309', name: 'Frijol Negro 1kg',           qtyOrdered: 40, qtyReceived: 40, unitCost: 9.50 },
      { id: 3, sku: '7501055361816', name: 'Azúcar Estándar 2kg',        qtyOrdered: 30, qtyReceived: 30, unitCost: 13.00 },
      { id: 4, sku: '7501008456789', name: 'Aceite Vegetal 900ml',       qtyOrdered: 24, qtyReceived: 24, unitCost: 16.40 },
    ],
  },
  {
    id: 'OC-2026-0141', date: '2026-05-20', supplier: 'Cervecería Centroamericana', supplierId: 'pv03',
    total: 12600.00, status: 'partial', branch: 'Centro', branchId: 'mx', notes: 'Entrega en dos partes',
    items: [
      { id: 5, sku: '7501031165432', name: 'Cerveza Gallo 350ml',    qtyOrdered: 288, qtyReceived: 96, unitCost: 6.80 },
      { id: 6, sku: '7501031125678', name: 'Coca-Cola 600ml',         qtyOrdered: 120, qtyReceived: 0,  unitCost: 5.20 },
      { id: 7, sku: '7501031125890', name: 'Pepsi 600ml',             qtyOrdered: 120, qtyReceived: 0,  unitCost: 4.80 },
    ],
  },
  {
    id: 'OC-2026-0140', date: '2026-05-19', supplier: 'Lácteos Foremost', supplierId: 'pv05',
    total: 3680.50, status: 'received', branch: 'Mixco', branchId: 'mix', notes: null,
    items: [
      { id: 8,  sku: '7501074234567', name: 'Leche Foremost 1L',          qtyOrdered: 48, qtyReceived: 48, unitCost: 9.80 },
      { id: 9,  sku: '7501074234890', name: 'Yogurt Natural 250ml',       qtyOrdered: 36, qtyReceived: 36, unitCost: 5.60 },
      { id: 10, sku: '7501074298765', name: 'Queso Fresco 200g',           qtyOrdered: 24, qtyReceived: 24, unitCost: 12.20 },
      { id: 11, sku: '7501074276543', name: 'Mantequilla La Pradera 200g', qtyOrdered: 18, qtyReceived: 18, unitCost: 14.80 },
    ],
  },
  {
    id: 'OC-2026-0139', date: '2026-05-18', supplier: 'Alimentos Maravilla', supplierId: 'pv02',
    total: 14200.00, status: 'pending', branch: 'Zona 10', branchId: 'zn10', notes: 'Urgente — stock bajo',
    items: [
      { id: 12, sku: '7501055312987', name: 'Sal Refinada 1kg',        qtyOrdered: 80,  qtyReceived: 0, unitCost: 3.80 },
      { id: 13, sku: '7501055365432', name: 'Pasta Spaghetti 200g',    qtyOrdered: 100, qtyReceived: 0, unitCost: 2.90 },
      { id: 14, sku: '7501073400025', name: 'Galletas María Gamesa',   qtyOrdered: 120, qtyReceived: 0, unitCost: 2.80 },
      { id: 15, sku: '7501073400001', name: 'Sabritas Original 70g',   qtyOrdered: 60,  qtyReceived: 0, unitCost: 4.80 },
      { id: 16, sku: '7501073400018', name: 'Doritos Nacho 60g',        qtyOrdered: 60,  qtyReceived: 0, unitCost: 5.10 },
    ],
  },
  {
    id: 'OC-2026-0138', date: '2026-05-18', supplier: 'Productos Quaker GT', supplierId: 'pv04',
    total: 6840.00, status: 'received', branch: 'Antigua', branchId: 'ant', notes: null,
    items: [
      { id: 17, sku: '7501031199911', name: 'Café Soluble Frasco 200g', qtyOrdered: 24, qtyReceived: 24, unitCost: 28.50 },
      { id: 18, sku: '7501055333321', name: 'Harina de Maíz 1kg',       qtyOrdered: 60, qtyReceived: 60, unitCost: 6.10 },
    ],
  },
  {
    id: 'OC-2026-0137', date: '2026-05-17', supplier: 'Limpieza Industrial Maya', supplierId: 'pv06',
    total: 5320.00, status: 'received', branch: 'Centro', branchId: 'mx', notes: null,
    items: [
      { id: 19, sku: '7501035010123', name: 'Detergente Ariel 1kg',       qtyOrdered: 36, qtyReceived: 36, unitCost: 26.40 },
      { id: 20, sku: '7501035010130', name: 'Cloro Magia Blanca 1L',      qtyOrdered: 48, qtyReceived: 48, unitCost: 7.80 },
      { id: 21, sku: '7501035010147', name: 'Jabón Lavaplatos Axion',     qtyOrdered: 40, qtyReceived: 40, unitCost: 9.20 },
      { id: 22, sku: '7501035010161', name: 'Limpiador Pinol 900ml',      qtyOrdered: 24, qtyReceived: 24, unitCost: 10.40 },
    ],
  },
  {
    id: 'OC-2026-0136', date: '2026-05-16', supplier: 'Distribuidora La Pradera, S.A.', supplierId: 'pv01',
    total: 9840.50, status: 'received', branch: 'Zona 10', branchId: 'zn10', notes: null,
    items: [
      { id: 23, sku: '7501055309856', name: 'Arroz Blanco Premium 1kg', qtyOrdered: 50, qtyReceived: 50, unitCost: 8.20 },
      { id: 24, sku: '7501055361816', name: 'Azúcar Estándar 2kg',      qtyOrdered: 40, qtyReceived: 40, unitCost: 13.00 },
      { id: 25, sku: '7501008456789', name: 'Aceite Vegetal 900ml',     qtyOrdered: 30, qtyReceived: 30, unitCost: 16.40 },
    ],
  },
  {
    id: 'OC-2026-0135', date: '2026-05-16', supplier: 'Alimentos Maravilla', supplierId: 'pv02',
    total: 4220.00, status: 'cancelled', branch: 'Mixco', branchId: 'mix', notes: 'Cancelada por falta de presupuesto',
    items: [
      { id: 26, sku: '7501073400032', name: 'Chocolate Milky Way',      qtyOrdered: 60, qtyReceived: 0, unitCost: 4.50 },
      { id: 27, sku: '7501073400049', name: 'Cacahuates Nishikawa 100g',qtyOrdered: 40, qtyReceived: 0, unitCost: 7.80 },
    ],
  },
  {
    id: 'OC-2026-0134', date: '2026-05-15', supplier: 'Cervecería Centroamericana', supplierId: 'pv03',
    total: 14400.00, status: 'received', branch: 'Zona 10', branchId: 'zn10', notes: null,
    items: [
      { id: 28, sku: '7501031165432', name: 'Cerveza Gallo 350ml', qtyOrdered: 288, qtyReceived: 288, unitCost: 6.80 },
      { id: 29, sku: '7501031125678', name: 'Coca-Cola 600ml',      qtyOrdered: 96,  qtyReceived: 96,  unitCost: 5.20 },
    ],
  },
  {
    id: 'OC-2026-0133', date: '2026-05-14', supplier: 'Lácteos Foremost', supplierId: 'pv05',
    total: 2840.00, status: 'received', branch: 'Centro', branchId: 'mx', notes: null,
    items: [
      { id: 30, sku: '7501074234567', name: 'Leche Foremost 1L',    qtyOrdered: 36, qtyReceived: 36, unitCost: 9.80 },
      { id: 31, sku: '7501074234890', name: 'Yogurt Natural 250ml', qtyOrdered: 24, qtyReceived: 24, unitCost: 5.60 },
    ],
  },
];

// Transferencias entre sucursales
export const TRANSFERS = [
  {
    id: 'TR-48892', date: '2026-05-22', fromBranch: 'Zona 10', toBranch: 'Centro',   transporter: 'Juan Pérez',
    status: 'completed',
    items: [
      { sku: '7501035010130', name: 'Cloro Magia Blanca 1L',   qty: 12, qtyReceived: 12 },
      { sku: '7501031145552', name: 'Agua Pura Salvavidas 600ml', qty: 24, qtyReceived: 24 },
    ],
  },
  {
    id: 'TR-48893', date: '2026-05-22', fromBranch: 'Centro',   toBranch: 'Mixco',    transporter: 'Carlos López',
    status: 'in_transit',
    items: [
      { sku: '7501055309856', name: 'Arroz Blanco Premium 1kg', qty: 20, qtyReceived: 0 },
      { sku: '7501055361816', name: 'Azúcar Estándar 2kg',      qty: 15, qtyReceived: 0 },
      { sku: '7501031311309', name: 'Frijol Negro 1kg',          qty: 10, qtyReceived: 0 },
    ],
  },
  {
    id: 'TR-48891', date: '2026-05-21', fromBranch: 'Zona 10', toBranch: 'Antigua',  transporter: 'Miguel Torres',
    status: 'completed',
    items: [
      { sku: '7501045500011', name: 'Shampoo Sedal 350ml',       qty: 6,  qtyReceived: 6  },
      { sku: '7501045500028', name: 'Pasta Dental Colgate 100ml',qty: 12, qtyReceived: 12 },
    ],
  },
  {
    id: 'TR-48890', date: '2026-05-21', fromBranch: 'Mixco',    toBranch: 'Zona 10',  transporter: null,
    status: 'draft',
    items: [
      { sku: '7501074234567', name: 'Leche Foremost 1L',         qty: 8,  qtyReceived: 0 },
      { sku: '7501074234890', name: 'Yogurt Natural 250ml',      qty: 12, qtyReceived: 0 },
    ],
  },
  {
    id: 'TR-48889', date: '2026-05-20', fromBranch: 'Antigua',  toBranch: 'Centro',   transporter: 'Ana Solís',
    status: 'cancelled',
    items: [
      { sku: '7501099112352', name: 'Helado Sarita 1L', qty: 5, qtyReceived: 0 },
    ],
  },
];

// Stock movements (kardex)
export const STOCK_MOVEMENTS = [
  { date: '2026-05-21 13:42', sku: '7501031125678', name: 'Coca-Cola 600ml', type: 'sale',     qty: -6,  ref: 'T-2026-04823', user: 'Carlos M.' },
  { date: '2026-05-21 13:30', sku: '7501055309856', name: 'Arroz Blanco 1kg', type: 'sale',     qty: -2,  ref: 'T-2026-04822', user: 'Carlos M.' },
  { date: '2026-05-21 12:18', sku: '7501035010130', name: 'Cloro Magia 1L',   type: 'transfer', qty: -12, ref: 'TR-00892',     user: 'Lucía C.' },
  { date: '2026-05-21 11:42', sku: '7501088100029', name: 'Pan de Manteca',   type: 'reception',qty: +48, ref: 'OC-2026-0142', user: 'María H.' },
  { date: '2026-05-21 10:32', sku: '7501031165432', name: 'Cerveza Gallo',    type: 'reception',qty: +96, ref: 'OC-2026-0141', user: 'Lucía C.' },
  { date: '2026-05-21 09:14', sku: '7501074234567', name: 'Leche Foremost 1L', type: 'adjustment', qty: -2, ref: 'AJ-0042',     user: 'Lucía C.' },
  { date: '2026-05-20 18:28', sku: '7501031145552', name: 'Agua Pura 600ml',   type: 'sale',     qty: -24, ref: 'T-2026-04781', user: 'José R.' },
  { date: '2026-05-20 16:05', sku: '7501088100100', name: 'Pizza Stouffer',    type: 'sale',     qty: -1,  ref: 'T-2026-04772', user: 'Pedro M.' },
  { date: '2026-05-20 14:32', sku: '7501045500011', name: 'Shampoo Sedal',     type: 'transfer', qty: +6,  ref: 'TR-00890',     user: 'Ana L.' },
  { date: '2026-05-20 11:18', sku: '7501055361816', name: 'Azúcar 2kg',        type: 'reception',qty: +24, ref: 'OC-2026-0138', user: 'María H.' },
];

// Registros de caja (historial + turno actual)
export const CASH_REGISTERS = [
  { id: 3, branchId: 'zn10', branch: 'Zona 10',   cashier: 'Carlos Méndez',  openedAt: '2026-05-23 08:02', closedAt: null,           openingAmount: 500.00,  closingAmount: null,    status: 'open',   salesTotal: 4820.50, salesCash: 2840.00, salesCard: 1980.50, refunds: 120.00 },
  { id: 7, branchId: 'mx',   branch: 'Centro',     cashier: 'María Hernández',openedAt: '2026-05-23 07:45', closedAt: null,           openingAmount: 300.00,  closingAmount: null,    status: 'open',   salesTotal: 3210.75, salesCash: 1950.00, salesCard: 1260.75, refunds: 0 },
  { id: 5, branchId: 'mix',  branch: 'Mixco',      cashier: 'José Ramírez',   openedAt: '2026-05-23 08:15', closedAt: null,           openingAmount: 400.00,  closingAmount: null,    status: 'open',   salesTotal: 1840.25, salesCash: 1210.00, salesCard: 630.25,  refunds: 0 },
  // Cierres anteriores
  { id: 2, branchId: 'zn10', branch: 'Zona 10',   cashier: 'Carlos Méndez',  openedAt: '2026-05-22 08:00', closedAt: '2026-05-22 18:30', openingAmount: 500.00, closingAmount: 3240.00, status: 'closed', salesTotal: 14820.50, salesCash: 8600.00, salesCard: 6220.50, refunds: 240.00, diff: -60.00 },
  { id: 1, branchId: 'mx',   branch: 'Centro',     cashier: 'Ana López',      openedAt: '2026-05-22 07:50', closedAt: '2026-05-22 18:45', openingAmount: 300.00, closingAmount: 4180.00, status: 'closed', salesTotal: 12400.00, salesCash: 7200.00, salesCard: 5200.00, refunds: 0,      diff: +80.00 },
  { id: 6, branchId: 'ant',  branch: 'Antigua',    cashier: 'Pedro Morales',  openedAt: '2026-05-22 08:30', closedAt: '2026-05-22 17:00', openingAmount: 250.00, closingAmount: 1890.00, status: 'closed', salesTotal: 8240.00,  salesCash: 4800.00, salesCard: 3440.00, refunds: 180.00, diff: 0 },
  { id: 4, branchId: 'mix',  branch: 'Mixco',      cashier: 'José Ramírez',   openedAt: '2026-05-21 08:10', closedAt: '2026-05-21 18:00', openingAmount: 400.00, closingAmount: 2810.00, status: 'closed', salesTotal: 9800.00,  salesCash: 5600.00, salesCard: 4200.00, refunds: 60.00,  diff: +10.00 },
];

// Notificaciones del sistema
export const NOTIFICATIONS = [
  { id: 1, type: 'stock_low',      title: 'Stock crítico: Aceite Vegetal 900ml', body: '2 unidades en Zona 10 — mínimo 20', route: 'inventory', readAt: null,        createdAt: '2026-05-23 09:14' },
  { id: 2, type: 'stock_low',      title: 'Stock bajo: Leche Foremost 1L', body: '22 unidades — mínimo 30', route: 'inventory', readAt: null,        createdAt: '2026-05-23 08:52' },
  { id: 3, type: 'expiry',         title: 'Vencimiento próximo: Queso Fresco 200g', body: 'Vence en 15 días — Lote L2604-Q', route: 'inventory', readAt: null,        createdAt: '2026-05-23 08:00' },
  { id: 4, type: 'po_pending',     title: 'OC pendiente sin recibir: OC-2026-0139', body: 'Desde 2026-05-18 — Alimentos Maravilla', route: 'purchases', readAt: null,       createdAt: '2026-05-22 18:00' },
  { id: 5, type: 'transfer',       title: 'Transferencia en tránsito: TR-48893', body: 'Centro → Mixco · Pendiente de recepción', route: 'transfers', readAt: null,       createdAt: '2026-05-22 14:30' },
  { id: 6, type: 'cash',           title: 'Diferencia en cierre de caja', body: 'Zona 10 · −Q 60.00 en corte del 22 May', route: 'cash', readAt: '2026-05-23 07:00', createdAt: '2026-05-22 18:32' },
  { id: 7, type: 'cxc',            title: 'Saldo vencido: Distribuidora Fuentes', body: 'Q 38,900 — 45 días de plazo excedido', route: 'clients', readAt: '2026-05-22 09:00', createdAt: '2026-05-21 08:00' },
  { id: 8, type: 'expiry',         title: 'Vencimiento próximo: Jugo Del Frutal 1L', body: 'Vence en 75 días — Lote L2604-J', route: 'inventory', readAt: '2026-05-20 10:00', createdAt: '2026-05-20 08:00' },
];

export const LOW_STOCK = PRODUCTS.filter(p => p.stock < p.min);

export const EXPIRING_SOON = PRODUCTS
  .filter(p => p.exp)
  .map(p => ({ ...p, daysLeft: Math.floor((new Date(p.exp + (p.exp.length === 7 ? '-15' : '')).getTime() - Date.now()) / 86400000) }))
  .filter(p => p.daysLeft < 90)
  .sort((a, b) => a.daysLeft - b.daysLeft);

// Plan de cuentas (simplificado para frontend)
export const ACCOUNTS = [
  { code: '1',      parentCode: null,   name: 'ACTIVO',                              level: 1, normalBalance: 'debit',  allowsEntries: false },
  { code: '11',     parentCode: '1',    name: 'Activo Corriente',                    level: 2, normalBalance: 'debit',  allowsEntries: false },
  { code: '1101',   parentCode: '11',   name: 'Caja y Bancos',                       level: 3, normalBalance: 'debit',  allowsEntries: false },
  { code: '110101', parentCode: '1101', name: 'Caja General',                        level: 4, normalBalance: 'debit',  allowsEntries: true  },
  { code: '110102', parentCode: '1101', name: 'Banco Industrial CTA 001',            level: 4, normalBalance: 'debit',  allowsEntries: true  },
  { code: '110103', parentCode: '1101', name: 'Banco G&T Continental',               level: 4, normalBalance: 'debit',  allowsEntries: true  },
  { code: '1102',   parentCode: '11',   name: 'Cuentas por Cobrar Clientes',         level: 3, normalBalance: 'debit',  allowsEntries: false },
  { code: '110201', parentCode: '1102', name: 'Clientes Nacionales',                 level: 4, normalBalance: 'debit',  allowsEntries: true  },
  { code: '1103',   parentCode: '11',   name: 'Inventarios',                         level: 3, normalBalance: 'debit',  allowsEntries: false },
  { code: '110301', parentCode: '1103', name: 'Inventario de Mercaderías',           level: 4, normalBalance: 'debit',  allowsEntries: true  },
  { code: '1105',   parentCode: '11',   name: 'IVA Crédito Fiscal',                  level: 3, normalBalance: 'debit',  allowsEntries: true  },
  { code: '12',     parentCode: '1',    name: 'Activo No Corriente',                 level: 2, normalBalance: 'debit',  allowsEntries: false },
  { code: '120101', parentCode: '12',   name: 'Mobiliario y Equipo',                 level: 4, normalBalance: 'debit',  allowsEntries: true  },
  { code: '2',      parentCode: null,   name: 'PASIVO',                              level: 1, normalBalance: 'credit', allowsEntries: false },
  { code: '21',     parentCode: '2',    name: 'Pasivo Corriente',                    level: 2, normalBalance: 'credit', allowsEntries: false },
  { code: '210101', parentCode: '21',   name: 'Proveedores Nacionales',              level: 4, normalBalance: 'credit', allowsEntries: true  },
  { code: '210201', parentCode: '21',   name: 'IVA por Pagar (Débito Fiscal)',       level: 4, normalBalance: 'credit', allowsEntries: true  },
  { code: '210401', parentCode: '21',   name: 'Sueldos por Pagar',                  level: 4, normalBalance: 'credit', allowsEntries: true  },
  { code: '3',      parentCode: null,   name: 'CAPITAL Y RESERVAS',                 level: 1, normalBalance: 'credit', allowsEntries: false },
  { code: '3101',   parentCode: '3',    name: 'Capital Social Pagado',              level: 3, normalBalance: 'credit', allowsEntries: true  },
  { code: '3103',   parentCode: '3',    name: 'Utilidades Retenidas',               level: 3, normalBalance: 'credit', allowsEntries: true  },
  { code: '3104',   parentCode: '3',    name: 'Resultado del Ejercicio',            level: 3, normalBalance: 'credit', allowsEntries: true  },
  { code: '4',      parentCode: null,   name: 'INGRESOS',                           level: 1, normalBalance: 'credit', allowsEntries: false },
  { code: '410101', parentCode: '4',    name: 'Ventas al Contado',                  level: 4, normalBalance: 'credit', allowsEntries: true  },
  { code: '410102', parentCode: '4',    name: 'Ventas a Crédito',                   level: 4, normalBalance: 'credit', allowsEntries: true  },
  { code: '5',      parentCode: null,   name: 'COSTOS Y GASTOS',                    level: 1, normalBalance: 'debit',  allowsEntries: false },
  { code: '510101', parentCode: '5',    name: 'Costo de Mercadería Vendida',        level: 4, normalBalance: 'debit',  allowsEntries: true  },
  { code: '520101', parentCode: '5',    name: 'Sueldos y Salarios — Ventas',        level: 4, normalBalance: 'debit',  allowsEntries: true  },
  { code: '530103', parentCode: '5',    name: 'Arrendamientos',                     level: 4, normalBalance: 'debit',  allowsEntries: true  },
  { code: '530104', parentCode: '5',    name: 'Energía Eléctrica',                  level: 4, normalBalance: 'debit',  allowsEntries: true  },
  { code: '540102', parentCode: '5',    name: 'Comisiones Bancarias',               level: 4, normalBalance: 'debit',  allowsEntries: true  },
];

export const ACCOUNTING_PERIODS = [
  { id: 1, name: 'Enero 2026',   startDate: '2026-01-01', endDate: '2026-01-31', status: 'closed' },
  { id: 2, name: 'Febrero 2026', startDate: '2026-02-01', endDate: '2026-02-28', status: 'closed' },
  { id: 3, name: 'Marzo 2026',   startDate: '2026-03-01', endDate: '2026-03-31', status: 'closed' },
  { id: 4, name: 'Abril 2026',   startDate: '2026-04-01', endDate: '2026-04-30', status: 'closed' },
  { id: 5, name: 'Mayo 2026',    startDate: '2026-05-01', endDate: '2026-05-31', status: 'open'   },
];

export const JOURNAL_ENTRIES = [
  {
    id: 1, date: '2026-05-23', periodId: 5, type: 'auto', description: 'Venta al contado — T-2026-04823',
    reference: 'T-2026-04823', sourceType: 'sale', totalDebit: 8500.00, totalCredit: 8500.00, status: 'posted',
    lines: [
      { accountCode: '110101', name: 'Caja General',               debit: 8500.00, credit: 0       },
      { accountCode: '410101', name: 'Ventas al Contado',           debit: 0,       credit: 7589.29 },
      { accountCode: '210201', name: 'IVA por Pagar (Débito Fiscal)',debit: 0,       credit: 910.71  },
    ],
  },
  {
    id: 2, date: '2026-05-23', periodId: 5, type: 'auto', description: 'Costo de venta — T-2026-04823',
    reference: 'T-2026-04823', sourceType: 'sale', totalDebit: 5600.00, totalCredit: 5600.00, status: 'posted',
    lines: [
      { accountCode: '510101', name: 'Costo de Mercadería Vendida', debit: 5600.00, credit: 0       },
      { accountCode: '110301', name: 'Inventario de Mercaderías',   debit: 0,       credit: 5600.00 },
    ],
  },
  {
    id: 3, date: '2026-05-22', periodId: 5, type: 'auto', description: 'Recepción OC — OC-2026-0139',
    reference: 'OC-2026-0139', sourceType: 'purchase', totalDebit: 15904.00, totalCredit: 15904.00, status: 'posted',
    lines: [
      { accountCode: '110301', name: 'Inventario de Mercaderías',   debit: 14200.00, credit: 0       },
      { accountCode: '1105',   name: 'IVA Crédito Fiscal',          debit: 1704.00,  credit: 0       },
      { accountCode: '210101', name: 'Proveedores Nacionales',      debit: 0,        credit: 15904.00 },
    ],
  },
  {
    id: 4, date: '2026-05-22', periodId: 5, type: 'auto', description: 'Pago cliente CxC — Supermercado El Ahorro',
    reference: 'TRF-48821', sourceType: 'client_payment', totalDebit: 5000.00, totalCredit: 5000.00, status: 'posted',
    lines: [
      { accountCode: '110102', name: 'Banco Industrial CTA 001',    debit: 5000.00, credit: 0       },
      { accountCode: '110201', name: 'Clientes Nacionales',         debit: 0,       credit: 5000.00 },
    ],
  },
  {
    id: 5, date: '2026-05-20', periodId: 5, type: 'manual', description: 'Pago planilla — Sueldos mayo 2026 quincena 1',
    reference: 'PL-2026-05-1', sourceType: null, totalDebit: 24800.00, totalCredit: 24800.00, status: 'posted',
    lines: [
      { accountCode: '520101', name: 'Sueldos y Salarios — Ventas', debit: 18600.00, credit: 0       },
      { accountCode: '210401', name: 'Sueldos por Pagar',           debit: 0,        credit: 18600.00 },
      { accountCode: '530104', name: 'Energía Eléctrica',           debit: 6200.00,  credit: 0       },
      { accountCode: '110101', name: 'Caja General',                debit: 0,        credit: 6200.00 },
    ],
  },
  {
    id: 6, date: '2026-05-15', periodId: 5, type: 'manual', description: 'Pago arrendamiento local Zona 10 — mayo 2026',
    reference: 'ARR-MAY26', sourceType: null, totalDebit: 8500.00, totalCredit: 8500.00, status: 'posted',
    lines: [
      { accountCode: '530103', name: 'Arrendamientos',              debit: 8500.00, credit: 0       },
      { accountCode: '110102', name: 'Banco Industrial CTA 001',    debit: 0,       credit: 8500.00 },
    ],
  },
];

// Promos
export const PROMOS = [
  { id: 'P1', name: '2x1 Cerveza Gallo Lunes', type: '2x1',        target: 'Cerveza Gallo 350ml', valid: 'Lunes',         status: 'active' },
  { id: 'P2', name: '15% off Lácteos Vencer pronto', type: 'descuento', target: 'Categoría Lácteos', valid: '21-25 May',    status: 'active' },
  { id: 'P3', name: 'Compra 3 paga 2 Snacks',      type: '3x2',     target: 'Categoría Snacks',    valid: 'Fines de semana', status: 'active' },
  { id: 'P4', name: '10% Q.O. Cliente Mayorista',  type: 'descuento', target: 'Cliente Tipo Mayorista', valid: 'Permanente', status: 'active' },
  { id: 'P5', name: 'Café + 1 Pan = Q12',          type: 'combo',   target: 'Café Soluble + Pan',   valid: 'Mañanas',      status: 'paused' },
];

