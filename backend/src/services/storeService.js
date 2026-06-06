import { nanoid } from 'nanoid';
import { store, EGG_PER_CARTON, USER_ROLES } from '../store.js';
import { getDatabaseConfig } from '../config/database.js';
import { createToken, hashPassword, sanitizeUser, verifyPassword } from '../utils/auth.js';

const ACTIVE_ROUTE_STATUSES = new Set(['Abierta', 'En proceso']);

const now = () => new Date().toISOString();
const today = (value = now()) => String(value).slice(0, 10);
const num = value => Number(value) || 0;
const round2 = value => Number(num(value).toFixed(2));
const round4 = value => Number(num(value).toFixed(4));
const cartonsFromUnits = units => round2(num(units) / EGG_PER_CARTON);

class StoreService {
  authenticate({ username, password }) {
    if (!username || !password) throw new Error('Usuario y contrasena son requeridos');

    const normalized = String(username).trim().toLowerCase();
    const user = store.users.find(item =>
      item.username.toLowerCase() === normalized
      || (item.email && item.email.toLowerCase() === normalized));

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error('Credenciales invalidas');
    }

    if (user.status !== 'activo' || user.active === false) {
      throw new Error('Tu usuario esta inactivo');
    }

    user.lastLoginAt = now();
    this.recordAudit({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user.id,
      entityName: user.displayName,
      details: 'Inicio de sesion',
    });

    const token = createToken({
      sub: user.id,
      role: user.role,
      iat: Date.now(),
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000),
    });

    return {
      token,
      user: sanitizeUser(user),
    };
  }

  getUserById(id) {
    return store.users.find(item => item.id === id) || null;
  }

  getSafeUserById(id) {
    return sanitizeUser(this.getUserById(id));
  }

  logout(actor) {
    if (actor) {
      this.recordAudit({
        userId: actor.id,
        action: 'LOGOUT',
        entityType: 'USER',
        entityId: actor.id,
        entityName: actor.displayName,
        details: 'Cierre de sesion',
      });
    }
    return { success: true };
  }

  requestPasswordReset(username) {
    const normalized = String(username || '').trim().toLowerCase();
    const user = store.users.find(item =>
      item.username.toLowerCase() === normalized
      || (item.email && item.email.toLowerCase() === normalized));

    if (user) {
      user.passwordRecovery = {
        enabled: true,
        resetToken: nanoid(24),
        resetRequestedAt: now(),
      };
      this.recordAudit({
        userId: user.id,
        action: 'PASSWORD_RESET_REQUEST',
        entityType: 'USER',
        entityId: user.id,
        entityName: user.displayName,
        details: 'Solicitud de recuperacion de contrasena',
      });
    }

    return {
      success: true,
      message: 'La estructura de recuperacion fue preparada. Integra el envio por correo al conectar la base real.',
    };
  }

  getAll(actor = null) {
    this.refreshAllRouteMetrics();
    this.refreshAllProductStock();
    return this.buildScopedState(actor);
  }

  getSchemaMeta() {
    return {
      unitsPerCarton: EGG_PER_CARTON,
      baseModels: ['User', 'Employee', 'Customer', 'Vendor', 'Product', 'Invoice', 'Transaction'],
      extendedModels: [
        'Route',
        'Truck',
        'InventoryLot',
        'Purchase',
        'PurchaseItem',
        'RouteLoad',
        'SaleItem',
        'Expense',
        'AccountReceivable',
        'AccountPayable',
        'RouteSettlement',
      ],
      roles: USER_ROLES,
      rules: [
        'Cada compra crea lotes de inventario con costo real por unidad y por carton.',
        'Cada venta desde ruta descuenta inventario del RouteLoad correspondiente.',
        'Las ventas libres se registran sobre la ruta virtual Venta Libre.',
        'Las ventas libres pueden hacerse sobre una ruta activa o sin ruta usando Venta Libre.',
        'La carga de una ruta reduce el inventario general y los sobrantes pueden volver al almacen.',
        'Los huevos devueltos y rotos se registran por ruta.',
        'Las ventas a credito crean cuentas por cobrar.',
        'Las compras a credito crean cuentas por pagar.',
        'Los gastos pueden relacionarse con ruta, camion o empleado.',
        'No existen endpoints de borrado para registros criticos; quedan reservados para admin.',
      ],
    };
  }

  dashboard(actor = null) {
    if (actor && actor.role === 'vendedor') return this.vendorDashboard(actor);
    this.refreshAllRouteMetrics();
    this.refreshAllProductStock();

    const todayKey = today();
    const invoicesToday = store.invoices.filter(invoice => today(invoice.issuedAt) === todayKey);
    const paymentsToday = store.customerPayments.filter(payment => today(payment.paymentDate) === todayKey);
    const expensesToday = store.expenses.filter(expense => today(expense.expenseDate) === todayKey);

    const salesToday = round2(invoicesToday.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
    const cashToday = round2(paymentsToday.reduce((sum, payment) => sum + payment.amount, 0));
    const expensesTodayTotal = round2(expensesToday.reduce((sum, expense) => sum + expense.amount, 0));
    const cogsToday = round2(this.getInvoicesCost(invoicesToday.map(invoice => invoice.id)));

    const totalSales = round2(store.invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
    const totalCOGS = round2(this.getInvoicesCost(store.invoices.map(invoice => invoice.id)));
    const totalExpenses = round2(store.expenses.reduce((sum, expense) => sum + expense.amount, 0));
    const totalPurchases = round2(store.purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0));

    const stockByType = store.products.map(product => {
      const units = this.getTotalStock(product.id);
      return {
        ...product,
        stockUnits: units,
        stockCartons: {
          cartons: Math.floor(units / EGG_PER_CARTON),
          rest: units % EGG_PER_CARTON,
          decimal: cartonsFromUnits(units).toFixed(1),
          decimalCartons: cartonsFromUnits(units).toFixed(2),
        },
      };
    });

    const totalUnits = stockByType.reduce((sum, product) => sum + product.stockUnits, 0);
    const pendingBalance = round2(store.customers.reduce((sum, customer) => sum + customer.balancePending, 0));
    const totalPayable = round2(store.accountPayables.reduce((sum, payable) => sum + payable.balanceDue, 0));

    return {
      salesToday,
      cashToday,
      expensesToday: expensesTodayTotal,
      cogsToday,
      grossProfitToday: round2(salesToday - cogsToday),
      netProfitToday: round2(salesToday - cogsToday - expensesTodayTotal),
      totalSales,
      totalCOGS,
      totalExpenses,
      totalPurchases,
      grossProfit: round2(totalSales - totalCOGS),
      netProfit: round2(totalSales - totalCOGS - totalExpenses),
      stockByType,
      stockUnits: totalUnits,
      stockCartons: { decimalCartons: cartonsFromUnits(totalUnits).toFixed(2) },
      activeRoutes: store.routes.filter(route => route.status === 'En proceso').length,
      availableTrucks: store.trucks.filter(truck => truck.status === 'Disponible').length,
      clients: store.customers.length,
      pendingBalance,
      totalPayable,
    };
  }

  reports(actor = null) {
    if (actor && actor.role === 'vendedor') return this.vendorReports(actor);
    this.refreshAllRouteMetrics();
    const salesMap = new Map();
    for (const invoice of store.invoices) {
      const key = today(invoice.issuedAt);
      const row = salesMap.get(key) || { date: key, total: 0, count: 0, cogs: 0 };
      row.total += invoice.totalAmount;
      row.count += 1;
      row.cogs += this.getInvoicesCost([invoice.id]);
      salesMap.set(key, row);
    }

    const salesByDay = Array.from(salesMap.values())
      .map(row => ({ ...row, total: round2(row.total), cogs: round2(row.cogs) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const expensesByCategory = Object.values(
      store.expenses.reduce((acc, expense) => {
        if (!acc[expense.category]) acc[expense.category] = { category: expense.category, total: 0 };
        acc[expense.category].total += expense.amount;
        return acc;
      }, {}),
    )
      .map(row => ({ ...row, total: round2(row.total) }))
      .sort((a, b) => b.total - a.total);

    const topClients = store.customers
      .filter(customer => !customer.isGeneralCustomer)
      .map(customer => {
        const invoices = store.invoices.filter(invoice => invoice.customerId === customer.id);
        return {
          ...customer,
          purchases: round2(invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)),
        };
      })
      .sort((a, b) => b.purchases - a.purchases)
      .slice(0, 10);

    const inventory = store.products.map(product => {
      const units = this.getTotalStock(product.id);
      return {
        ...product,
        stockUnits: units,
        cartons: { decimalCartons: cartonsFromUnits(units).toFixed(2) },
        batches: store.inventoryLots
          .filter(lot => lot.productId === product.id)
          .map(lot => ({
            ...lot,
            supplierName: this.getVendor(lot.vendorId)?.name || 'N/A',
          }))
          .sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate)),
      };
    });

    const routeProfit = store.routes.map(route => {
      const routeInvoices = store.invoices.filter(invoice => invoice.routeId === route.id);
      const routeInvoiceIds = routeInvoices.map(invoice => invoice.id);
      const totalSold = round2(routeInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
      const totalCashed = round2(store.customerPayments
        .filter(payment => routeInvoiceIds.includes(payment.invoiceId))
        .reduce((sum, payment) => sum + payment.amount, 0));
      const totalCredit = round2(totalSold - totalCashed);
      const totalCOGS = round2(this.getInvoicesCost(routeInvoiceIds));
      const expenses = round2(store.expenses
        .filter(expense => expense.routeId === route.id)
        .reduce((sum, expense) => sum + expense.amount, 0));
      const truck = this.getTruck(route.truckId);

      return {
        ...route,
        truckCode: truck?.code || 'N/A',
        totalSold,
        totalCashed,
        totalCredit,
        totalCOGS,
        grossProfit: round2(totalSold - totalCOGS),
        expenses,
        profit: round2(totalSold - totalCOGS - expenses),
        invoiceCount: routeInvoices.length,
      };
    });

    const totalRevenue = round2(store.invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
    const totalCOGS = round2(this.getInvoicesCost(store.invoices.map(invoice => invoice.id)));
    const totalExpenses = round2(store.expenses.reduce((sum, expense) => sum + expense.amount, 0));
    const profitLoss = {
      revenue: totalRevenue,
      cogs: totalCOGS,
      grossProfit: round2(totalRevenue - totalCOGS),
      grossMargin: totalRevenue > 0 ? ((totalRevenue - totalCOGS) / totalRevenue * 100).toFixed(1) : '0',
      expenses: totalExpenses,
      netProfit: round2(totalRevenue - totalCOGS - totalExpenses),
      netMargin: totalRevenue > 0 ? ((totalRevenue - totalCOGS - totalExpenses) / totalRevenue * 100).toFixed(1) : '0',
    };

    const purchasesBySupplier = store.vendors.map(vendor => {
      const purchases = store.purchases.filter(purchase => purchase.vendorId === vendor.id);
      return {
        ...vendor,
        purchaseCount: purchases.length,
        totalPurchased: round2(purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0)),
        totalPaid: round2(purchases.reduce((sum, purchase) => sum + purchase.paidAmount, 0)),
        totalPending: round2(purchases.reduce((sum, purchase) => sum + purchase.balanceDue, 0)),
      };
    });

    return {
      salesByDay,
      expensesByCategory,
      topClients,
      inventory,
      routeProfit,
      profitLoss,
      purchasesBySupplier,
      routeSettlements: store.routeSettlements,
    };
  }

  updateEggType(id, data) {
    const product = this.requireProduct(id);
    const unitPrice = num(data.unitPrice ?? data.pricePerUnit);
    const cartonPrice = num(data.cartonPrice ?? data.pricePerCarton);
    if (unitPrice > 0) {
      product.unitPrice = round2(unitPrice);
      product.pricePerUnit = product.unitPrice;
    }
    if (cartonPrice > 0) {
      product.cartonPrice = round2(cartonPrice);
      product.pricePerCarton = product.cartonPrice;
    }
    return product;
  }

  createSupplier(data) {
    if (!data.name) throw new Error('El nombre del proveedor es requerido');
    const vendor = {
      id: nanoid(8),
      name: data.name,
      contactPerson: data.contactPerson || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      createdAt: now(),
      balancePending: 0,
      status: data.status || 'activo',
      notes: data.notes || '',
      rnc: data.rnc || '',
    };
    store.vendors.unshift(vendor);
    return vendor;
  }

  updateSupplier(id, data) {
    const vendor = this.getVendor(id);
    if (!vendor) throw new Error('Proveedor no encontrado');
    Object.assign(vendor, {
      name: data.name ?? vendor.name,
      contactPerson: data.contactPerson ?? vendor.contactPerson,
      email: data.email ?? vendor.email,
      phone: data.phone ?? vendor.phone,
      address: data.address ?? vendor.address,
      status: data.status ?? vendor.status,
      notes: data.notes ?? vendor.notes,
      rnc: data.rnc ?? vendor.rnc,
    });
    return vendor;
  }

  createClient(data) {
    if (!data.name) throw new Error('El nombre del cliente es requerido');
    const routeId = data.routeId || data.assignedRouteId || null;
    const customer = {
      id: nanoid(8),
      name: data.name,
      contactPerson: data.contactPerson || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      createdAt: now(),
      assignedRouteId: routeId,
      routeId,
      balancePending: 0,
      balance: 0,
      status: data.status || 'activo',
      isGeneralCustomer: false,
      active: (data.status || 'activo') === 'activo',
      sector: data.sector || '',
    };
    store.customers.unshift(customer);
    return customer;
  }

  updateClient(id, data) {
    const customer = this.getCustomer(id);
    if (!customer) throw new Error('Cliente no encontrado');
    const routeId = data.routeId ?? data.assignedRouteId ?? customer.routeId;
    Object.assign(customer, {
      name: data.name ?? customer.name,
      contactPerson: data.contactPerson ?? customer.contactPerson,
      email: data.email ?? customer.email,
      phone: data.phone ?? customer.phone,
      address: data.address ?? customer.address,
      assignedRouteId: routeId,
      routeId,
      status: data.status ?? customer.status,
      active: (data.status ?? customer.status) === 'activo',
      sector: data.sector ?? customer.sector,
    });
    return customer;
  }

  createEmployee(data) {
    if (!data.name) throw new Error('El nombre del empleado es requerido');
    if (!USER_ROLES.includes(data.role)) throw new Error('Rol de empleado invalido');
    const employee = {
      id: nanoid(8),
      name: data.name,
      phone: data.phone || '',
      address: data.address || '',
      role: data.role,
      salaryType: data.salaryType || 'mensual',
      salaryAmount: round2(data.salaryAmount),
      status: data.status || 'activo',
      createdAt: now(),
    };
    store.employees.unshift(employee);
    return employee;
  }

  updateEmployee(id, data) {
    const employee = store.employees.find(item => item.id === id);
    if (!employee) throw new Error('Empleado no encontrado');
    if (data.role && !USER_ROLES.includes(data.role)) throw new Error('Rol de empleado invalido');
    Object.assign(employee, {
      name: data.name ?? employee.name,
      phone: data.phone ?? employee.phone,
      address: data.address ?? employee.address,
      role: data.role ?? employee.role,
      salaryType: data.salaryType ?? employee.salaryType,
      salaryAmount: data.salaryAmount !== undefined ? round2(data.salaryAmount) : employee.salaryAmount,
      status: data.status ?? employee.status,
    });
    return employee;
  }

  createUser(data) {
    if (!data.username) throw new Error('El username es requerido');
    const password = data.password || null;
    const passwordHash = data.passwordHash || (password ? hashPassword(password) : null);
    if (!passwordHash) throw new Error('La contrasena es requerida');
    if (!USER_ROLES.includes(data.role)) throw new Error('Rol de usuario invalido');
    const employee = data.employeeId ? store.employees.find(item => item.id === data.employeeId) : null;
    if (data.employeeId && !employee) throw new Error('Empleado relacionado no encontrado');
    const normalizedUsername = String(data.username).trim().toLowerCase();
    const normalizedEmail = String(data.email || '').trim().toLowerCase();
    const exists = store.users.some(item =>
      item.username.toLowerCase() === normalizedUsername
      || (normalizedEmail && item.email?.toLowerCase() === normalizedEmail));
    if (exists) throw new Error('Ya existe un usuario con ese correo o username');
    const user = {
      id: nanoid(8),
      username: normalizedUsername,
      passwordHash,
      role: data.role,
      permissions: Array.isArray(data.permissions) && data.permissions.length ? data.permissions : this.defaultPermissionsForRole(data.role),
      employeeId: data.employeeId || null,
      name: data.name || employee?.name || normalizedUsername,
      phone: data.phone || employee?.phone || '',
      email: normalizedEmail,
      displayName: data.displayName || employee?.name || data.username,
      status: data.status || 'activo',
      active: (data.status || 'activo') === 'activo',
      assignedRouteIds: Array.isArray(data.assignedRouteIds) ? data.assignedRouteIds : [],
      rememberTokenVersion: 1,
      passwordRecovery: {
        enabled: false,
        resetToken: null,
        resetRequestedAt: null,
      },
      createdAt: now(),
      lastLoginAt: null,
    };
    store.users.unshift(user);
    this.recordAudit({
      userId: data.actorUserId || 'usr-admin',
      action: 'USER_CREATE',
      entityType: 'USER',
      entityId: user.id,
      entityName: user.displayName,
      details: `Usuario ${user.username} creado con rol ${user.role}`,
    });
    return sanitizeUser(user);
  }

  updateUser(id, data) {
    const user = store.users.find(item => item.id === id);
    if (!user) throw new Error('Usuario no encontrado');
    if (data.role && !USER_ROLES.includes(data.role)) throw new Error('Rol de usuario invalido');
    if (data.employeeId) {
      const employee = store.employees.find(item => item.id === data.employeeId);
      if (!employee) throw new Error('Empleado relacionado no encontrado');
    }
    const nextUsername = data.username ? String(data.username).trim().toLowerCase() : user.username;
    const nextEmail = data.email !== undefined ? String(data.email || '').trim().toLowerCase() : user.email;
    const collision = store.users.some(item =>
      item.id !== user.id
      && (item.username.toLowerCase() === nextUsername || (nextEmail && item.email?.toLowerCase() === nextEmail)));
    if (collision) throw new Error('Ya existe un usuario con ese correo o username');

    const nextPasswordHash = data.passwordHash || (data.password ? hashPassword(data.password) : user.passwordHash);

    Object.assign(user, {
      username: nextUsername,
      passwordHash: nextPasswordHash,
      role: data.role ?? user.role,
      permissions: Array.isArray(data.permissions) ? data.permissions : user.permissions,
      employeeId: data.employeeId ?? user.employeeId,
      name: data.name ?? user.name,
      phone: data.phone ?? user.phone,
      email: nextEmail,
      displayName: data.displayName ?? user.displayName,
      status: data.status ?? user.status,
      active: (data.status ?? user.status) === 'activo',
      assignedRouteIds: Array.isArray(data.assignedRouteIds) ? data.assignedRouteIds : user.assignedRouteIds,
      lastLoginAt: data.lastLoginAt ?? user.lastLoginAt,
    });
    this.recordAudit({
      userId: data.actorUserId || 'usr-admin',
      action: 'USER_UPDATE',
      entityType: 'USER',
      entityId: user.id,
      entityName: user.displayName,
      details: `Usuario ${user.username} actualizado`,
    });
    return sanitizeUser(user);
  }

  setUserStatus(id, status, actorUserId = 'usr-admin') {
    const user = store.users.find(item => item.id === id);
    if (!user) throw new Error('Usuario no encontrado');
    user.status = status;
    user.active = status === 'activo';
    this.recordAudit({
      userId: actorUserId,
      action: status === 'activo' ? 'USER_ACTIVATE' : 'USER_DEACTIVATE',
      entityType: 'USER',
      entityId: user.id,
      entityName: user.displayName,
      details: `Usuario ${user.username} ${status}`,
    });
    return sanitizeUser(user);
  }

  deleteUser(id, actorUserId = 'usr-admin') {
    const index = store.users.findIndex(item => item.id === id);
    if (index === -1) throw new Error('Usuario no encontrado');
    if (store.users[index].role === 'admin' && store.users.filter(item => item.role === 'admin').length === 1) {
      throw new Error('No puedes eliminar el ultimo administrador');
    }
    const [removed] = store.users.splice(index, 1);
    this.recordAudit({
      userId: actorUserId,
      action: 'USER_DELETE',
      entityType: 'USER',
      entityId: removed.id,
      entityName: removed.displayName,
      details: `Usuario ${removed.username} eliminado`,
    });
    return { id: removed.id, deleted: true };
  }

  createProduct(data) {
    if (!data.name) throw new Error('El nombre del producto es requerido');
    const id = data.id || nanoid(8);
    const product = {
      id,
      name: data.name,
      description: data.description || '',
      SKU: data.SKU || data.sku || '',
      sku: data.sku || data.SKU || '',
      eggCategory: data.eggCategory || data.type || 'general',
      eggSize: data.eggSize || data.size || 'mediano',
      shellColor: data.shellColor || data.color || 'blanco',
      pricePerUnit: round2(data.pricePerUnit ?? data.unitPrice),
      unitPrice: round2(data.unitPrice ?? data.pricePerUnit),
      pricePerCarton: round2(data.pricePerCarton ?? data.cartonPrice),
      cartonPrice: round2(data.cartonPrice ?? data.pricePerCarton),
      stockQuantity: 0,
      unitsPerCarton: EGG_PER_CARTON,
      createdAt: now(),
      active: data.active ?? true,
    };
    store.products.unshift(product);
    return product;
  }

  updateProduct(id, data) {
    const product = this.requireProduct(id);
    Object.assign(product, {
      name: data.name ?? product.name,
      description: data.description ?? product.description,
      SKU: data.SKU ?? data.sku ?? product.SKU,
      sku: data.sku ?? data.SKU ?? product.sku,
      eggCategory: data.eggCategory ?? data.type ?? product.eggCategory,
      eggSize: data.eggSize ?? data.size ?? product.eggSize,
      shellColor: data.shellColor ?? data.color ?? product.shellColor,
      pricePerUnit: data.pricePerUnit !== undefined || data.unitPrice !== undefined ? round2(data.pricePerUnit ?? data.unitPrice) : product.pricePerUnit,
      unitPrice: data.unitPrice !== undefined || data.pricePerUnit !== undefined ? round2(data.unitPrice ?? data.pricePerUnit) : product.unitPrice,
      pricePerCarton: data.pricePerCarton !== undefined || data.cartonPrice !== undefined ? round2(data.pricePerCarton ?? data.cartonPrice) : product.pricePerCarton,
      cartonPrice: data.cartonPrice !== undefined || data.pricePerCarton !== undefined ? round2(data.cartonPrice ?? data.pricePerCarton) : product.cartonPrice,
      active: data.active ?? product.active,
    });
    return product;
  }

  createPurchase(data) {
    const vendorId = data.vendorId || data.supplierId;
    if (!vendorId) throw new Error('Selecciona un proveedor');
    if (!data.items?.length) throw new Error('Agrega al menos un producto');
    const vendor = this.getVendor(vendorId);
    if (!vendor) throw new Error('Proveedor no encontrado');

    const processedItems = data.items.map(item => {
      const productId = item.productId || item.eggTypeId;
      const product = this.requireProduct(productId);
      const mode = item.mode || (item.quantityCartons ? 'carton' : 'unit');
      const quantityBase = item.quantity ?? item.quantityUnits ?? item.quantityCartons;
      const quantityUnits = this.toUnits(quantityBase, mode);
      if (quantityUnits <= 0) throw new Error(`La cantidad debe ser mayor a 0 para ${product.name}`);

      let costPerCarton = num(item.costPerCarton);
      let costPerUnit = num(item.costPerUnit);

      if (costPerCarton <= 0 && costPerUnit > 0) costPerCarton = round2(costPerUnit * EGG_PER_CARTON);
      if (costPerUnit <= 0 && costPerCarton > 0) costPerUnit = round4(costPerCarton / EGG_PER_CARTON);
      if (costPerCarton <= 0 || costPerUnit <= 0) throw new Error(`Debes indicar costo por carton o por unidad para ${product.name}`);

      const quantityCartons = mode === 'carton' ? num(quantityBase) : cartonsFromUnits(quantityUnits);
      const total = round2(quantityUnits * costPerUnit);

      return {
        id: nanoid(8),
        purchaseId: '',
        productId,
        eggTypeId: productId,
        quantityUnits,
        totalUnits: quantityUnits,
        quantityCartons,
        quantity: mode === 'carton' ? num(quantityBase) : quantityUnits,
        mode,
        costPerUnit: round4(costPerUnit),
        costPerCarton: round2(costPerCarton),
        total,
        subtotal: total,
      };
    });

    const totalAmount = round2(processedItems.reduce((sum, item) => sum + item.total, 0));
    const actualPaid = Math.min(round2(data.paid), totalAmount);
    const createdAt = now();
    const purchaseDate = data.purchaseDate || createdAt;

    store.counters.purchase += 1;
    const purchase = {
      id: nanoid(8),
      purchaseNumber: `COM-${store.counters.purchase}`,
      number: `COM-${store.counters.purchase}`,
      vendorId,
      supplierId: vendorId,
      purchaseDate,
      date: purchaseDate,
      totalAmount,
      total: totalAmount,
      paidAmount: actualPaid,
      paid: actualPaid,
      balanceDue: round2(totalAmount - actualPaid),
      status: this.purchaseStatus(actualPaid, totalAmount),
      paymentMethod: data.paymentMethod || (actualPaid < totalAmount ? 'credito' : 'efectivo'),
      createdAt,
      createdByUserId: data.createdByUserId || 'usr-admin',
      notes: data.notes || '',
    };

    store.purchases.unshift(purchase);

    for (const item of processedItems) {
      item.purchaseId = purchase.id;
      store.purchaseItems.push(item);
      store.inventoryLots.push({
        id: nanoid(8),
        productId: item.productId,
        eggTypeId: item.productId,
        vendorId,
        supplierId: vendorId,
        purchaseId: purchase.id,
        purchaseDate,
        quantityUnits: item.quantityUnits,
        remainingUnits: item.quantityUnits,
        purchaseCostPerUnit: item.costPerUnit,
        costPerUnit: item.costPerUnit,
        purchaseCostPerCarton: item.costPerCarton,
        costPerCarton: item.costPerCarton,
        createdAt,
      });
    }

    if (purchase.balanceDue > 0) {
      store.accountPayables.unshift({
        id: nanoid(8),
        vendorId,
        supplierId: vendorId,
        purchaseId: purchase.id,
        totalAmount,
        amount: totalAmount,
        paidAmount: actualPaid,
        paid: actualPaid,
        balanceDue: purchase.balanceDue,
        dueDate: data.dueDate || this.addDays(today(purchaseDate), 30),
        status: this.purchaseStatus(actualPaid, totalAmount),
        createdAt,
      });
    }

    this.recordTransaction({
      type: 'compra',
      amount: totalAmount,
      recordedByUserId: purchase.createdByUserId,
      vendorId,
      purchaseId: purchase.id,
      description: `Compra ${purchase.purchaseNumber}`,
      createdAt: purchaseDate,
    });

    if (actualPaid > 0) {
      const payment = {
        id: nanoid(8),
        payableId: store.accountPayables.find(payable => payable.purchaseId === purchase.id)?.id || null,
        purchaseId: purchase.id,
        supplierId: vendorId,
        vendorId,
        date: purchaseDate,
        paymentDate: purchaseDate,
        amount: actualPaid,
        method: purchase.paymentMethod,
        note: 'Pago inicial',
        createdByUserId: purchase.createdByUserId,
      };
      store.vendorPayments.push(payment);
      this.recordTransaction({
        type: 'pago proveedor',
        amount: actualPaid,
        recordedByUserId: purchase.createdByUserId,
        vendorId,
        purchaseId: purchase.id,
        description: `Pago inicial ${purchase.purchaseNumber}`,
        createdAt: purchaseDate,
      });
    }

    this.refreshVendorBalance(vendorId);
    this.refreshAllProductStock();
    return this.buildPurchaseView(purchase);
  }

  addPayablePayment(data) {
    const payableId = data.payableId;
    const payable = store.accountPayables.find(item => item.id === payableId);
    if (!payable) throw new Error('Cuenta por pagar no encontrada');
    const amount = round2(data.amount);
    if (amount <= 0) throw new Error('El monto debe ser mayor a 0');
    if (amount > payable.balanceDue + 0.01) throw new Error(`El pago excede el saldo pendiente (${payable.balanceDue.toFixed(2)})`);

    payable.paidAmount = round2(payable.paidAmount + amount);
    payable.paid = payable.paidAmount;
    payable.balanceDue = round2(payable.totalAmount - payable.paidAmount);
    payable.status = this.purchaseStatus(payable.paidAmount, payable.totalAmount);

    const purchase = store.purchases.find(item => item.id === payable.purchaseId);
    if (purchase) {
      purchase.paidAmount = payable.paidAmount;
      purchase.paid = payable.paidAmount;
      purchase.balanceDue = payable.balanceDue;
      purchase.status = payable.status;
    }

    const payment = {
      id: nanoid(8),
      payableId,
      purchaseId: payable.purchaseId,
      supplierId: payable.vendorId,
      vendorId: payable.vendorId,
      date: data.paymentDate || now(),
      paymentDate: data.paymentDate || now(),
      amount,
      method: data.method || 'efectivo',
      note: data.note || '',
      createdByUserId: data.createdByUserId || 'usr-admin',
    };
    store.vendorPayments.push(payment);

    this.recordTransaction({
      type: 'pago proveedor',
      amount,
      recordedByUserId: payment.createdByUserId,
      vendorId: payable.vendorId,
      purchaseId: payable.purchaseId,
      description: payment.note || `Pago a proveedor ${purchase?.purchaseNumber || payable.purchaseId}`,
      createdAt: payment.paymentDate,
    });

    this.refreshVendorBalance(payable.vendorId);
    return payment;
  }

  createRoute(data) {
    const truckId = data.truckId || data.assignedTruckId || null;
    const truck = truckId ? this.getTruck(truckId) : null;
    if (truckId && !truck) throw new Error('Camion no encontrado');
    if (truck && !['Disponible', 'En ruta'].includes(truck.status)) {
      throw new Error(`El camion ${truck.code} no esta disponible (${truck.status})`);
    }

    const assignedUserId = data.assignedUserId || data.vendorUserId || null;
    const sellerEmployeeId = this.resolveEmployeeId(data.assignedSellerId || data.sellerId || assignedUserId);
    const driverEmployeeId = this.resolveEmployeeId(data.assignedDriverId || data.driverEmployeeId);
    const route = {
      id: nanoid(8),
      name: data.name || 'Ruta sin nombre',
      routeType: data.routeType || 'venta-desde-ruta',
      status: data.status || 'Abierta',
      createdAt: now(),
      startedAt: data.startedAt || data.startDate || now(),
      closedAt: data.closedAt || null,
      assignedTruckId: truckId,
      truckId,
      assignedSellerId: sellerEmployeeId,
      sellerId: sellerEmployeeId,
      assignedUserId,
      assignedDriverId: driverEmployeeId,
      driverEmployeeId,
      driver: this.getEmployeeName(driverEmployeeId) || data.driver || 'Pendiente',
      loadedUnits: round2(data.loadedUnits),
      soldUnits: 0,
      returnedUnits: 0,
      brokenUnits: 0,
      notes: data.notes || '',
    };

    if (truck && ACTIVE_ROUTE_STATUSES.has(route.status)) {
      truck.status = 'En ruta';
    }

    store.routes.unshift(route);

    if (Array.isArray(data.loadItems) && data.loadItems.length) {
      for (const item of data.loadItems) {
        this.createRouteLoad({
          ...item,
          routeId: route.id,
          truckId: truckId || item.truckId || null,
        });
      }
      this.refreshRouteMetrics(route.id);
    }

    return route;
  }

  updateRoute(id, data) {
    const route = this.requireRoute(id);
    const previousTruckId = route.truckId;
    const nextTruckId = data.truckId ?? data.assignedTruckId ?? route.truckId;

    if (nextTruckId && nextTruckId !== previousTruckId) {
      const truck = this.getTruck(nextTruckId);
      if (!truck) throw new Error('Camion no encontrado');
      if (!['Disponible', 'En ruta'].includes(truck.status)) {
        throw new Error(`El camion ${truck.code} no esta disponible (${truck.status})`);
      }
    }

    route.name = data.name ?? route.name;
    route.routeType = data.routeType ?? route.routeType;
    route.status = data.status ?? route.status;
    route.startedAt = data.startedAt ?? data.startDate ?? route.startedAt;
    route.closedAt = data.closedAt ?? route.closedAt;
    route.assignedTruckId = nextTruckId;
    route.truckId = nextTruckId;
    route.assignedSellerId = this.resolveEmployeeId(data.assignedSellerId || data.sellerId) || route.assignedSellerId;
    route.sellerId = route.assignedSellerId;
    route.assignedUserId = data.assignedUserId ?? data.vendorUserId ?? route.assignedUserId;
    route.assignedDriverId = this.resolveEmployeeId(data.assignedDriverId || data.driverEmployeeId) || route.assignedDriverId;
    route.driverEmployeeId = route.assignedDriverId;
    route.driver = this.getEmployeeName(route.assignedDriverId) || data.driver || route.driver;
    route.notes = data.notes ?? route.notes;

    if (data.loadedUnits !== undefined) route.loadedUnits = round2(data.loadedUnits);
    if (data.soldUnits !== undefined) route.soldUnits = round2(data.soldUnits);
    if (data.returnedUnits !== undefined) route.returnedUnits = round2(data.returnedUnits);

    if (previousTruckId && previousTruckId !== nextTruckId) {
      const previousTruck = this.getTruck(previousTruckId);
      if (previousTruck) previousTruck.status = 'Disponible';
    }

    if (nextTruckId) {
      const nextTruck = this.getTruck(nextTruckId);
      if (nextTruck && ACTIVE_ROUTE_STATUSES.has(route.status)) nextTruck.status = 'En ruta';
      if (nextTruck && route.status === 'Cerrada') nextTruck.status = 'Disponible';
    }

    if (route.status === 'Cerrada' && !route.closedAt) {
      route.closedAt = now();
    }

    this.refreshRouteMetrics(route.id);

    if (route.status === 'Cerrada') {
      this.settleRoute(route.id, data.approvedByUserId || 'usr-admin');
    }

    return route;
  }

  createRouteLoad(data) {
    const route = this.requireRoute(data.routeId);
    if (route.status === 'Cerrada') throw new Error('No se puede cargar inventario a una ruta cerrada');

    const productId = data.productId || data.eggTypeId;
    const product = this.requireProduct(productId);
    const quantityBase = data.loadedUnits ?? data.quantityUnits ?? data.loadedCartons ?? data.quantityCartons ?? data.quantity;
    const mode = data.mode || (data.loadedCartons || data.quantityCartons ? 'carton' : 'unit');
    const loadedUnits = this.toUnits(quantityBase, mode);
    if (loadedUnits <= 0) throw new Error(`La carga debe ser mayor a 0 para ${product.name}`);

    const truckId = data.truckId || route.truckId || route.assignedTruckId || null;
    if (truckId) {
      const truck = this.getTruck(truckId);
      if (!truck) throw new Error('Camion no encontrado');
      route.truckId = truckId;
      route.assignedTruckId = truckId;
      if (ACTIVE_ROUTE_STATUSES.has(route.status)) truck.status = 'En ruta';
    }

    const allocations = this.allocateFromWarehouse(productId, loadedUnits, data.inventoryLotId || null);
    const created = allocations.map(allocation => {
      store.counters.routeLoad += 1;
      const routeLoad = {
        id: nanoid(8),
        routeId: route.id,
        truckId,
        productId,
        eggTypeId: productId,
        inventoryLotId: allocation.inventoryLotId,
        vendorId: allocation.vendorId,
        loadedUnits: allocation.units,
        soldUnits: 0,
        returnedUnits: 0,
        brokenUnits: 0,
        remainingUnits: allocation.units,
        costPerUnit: allocation.costPerUnit,
        createdAt: now(),
      };
      store.routeLoads.push(routeLoad);
      return routeLoad;
    });

    this.refreshRouteMetrics(route.id);
    this.refreshAllProductStock();
    return created.length === 1 ? created[0] : created;
  }

  createInvoice(data) {
    if (!data.items?.length) throw new Error('La factura necesita al menos un producto');

    const isFreeSale = Boolean(data.isFree || data.invoiceType === 'venta-libre' || data.type === 'venta libre');
    const routeId = isFreeSale ? (data.routeId || 'r-free') : (data.routeId || 'r-free');
    const route = this.requireRoute(routeId);
    if (route.id !== 'r-free' && route.status !== 'En proceso') {
      throw new Error('El vendedor solo puede vender desde una ruta activa');
    }

    const sellerEmployeeId = this.resolveEmployeeId(data.sellerId || data.sellerEmployeeId || route.assignedSellerId);
    const actorUserId = data.actorUserId || null;
    if (route.id !== 'r-free' && actorUserId && route.assignedUserId && route.assignedUserId !== actorUserId) {
      throw new Error('No puedes vender en una ruta que no te fue asignada');
    }
    if (route.id !== 'r-free' && sellerEmployeeId && route.assignedSellerId && route.assignedSellerId !== sellerEmployeeId) {
      throw new Error('El vendedor solo puede vender desde su ruta activa asignada');
    }

    const customer = isFreeSale
      ? this.getGeneralCustomer()
      : this.getCustomer(data.clientId || data.customerId);

    if (!customer) throw new Error('Cliente no encontrado');
    if (!isFreeSale && customer.status !== 'activo') throw new Error('El cliente no esta activo');

    const processedItems = data.items.map(item => {
      const productId = item.productId || item.eggTypeId;
      const product = this.requireProduct(productId);
      const mode = item.mode || (item.quantityCartons ? 'carton' : 'unit');
      const quantityBase = item.quantity ?? item.quantityUnits ?? item.quantityCartons;
      const quantityUnits = this.toUnits(quantityBase, mode);
      if (quantityUnits <= 0) throw new Error(`La cantidad debe ser mayor a 0 para ${product.name}`);

      const allocations = this.consumeRouteInventory(route.id, productId, quantityUnits);
      const totalCost = round2(allocations.reduce((sum, allocation) => sum + allocation.units * allocation.costPerUnit, 0));
      const costPerUnit = quantityUnits > 0 ? round4(totalCost / quantityUnits) : 0;
      const salePricePerUnit = round2(item.salePricePerUnit ?? item.unitPrice ?? product.pricePerUnit);
      const salePricePerCarton = round2(item.salePricePerCarton ?? item.cartonPrice ?? product.pricePerCarton);
      const quantityCartons = mode === 'carton' ? num(quantityBase) : cartonsFromUnits(quantityUnits);
      const totalSale = round2(mode === 'carton' ? quantityCartons * salePricePerCarton : quantityUnits * salePricePerUnit);

      return {
        id: nanoid(8),
        invoiceId: '',
        productId,
        eggTypeId: productId,
        routeLoadId: allocations[0]?.routeLoadId || null,
        routeLoad: allocations[0]?.routeLoadId || null,
        quantityUnits,
        totalUnits: quantityUnits,
        quantityCartons,
        quantity: mode === 'carton' ? quantityCartons : quantityUnits,
        mode,
        salePricePerUnit,
        unitPrice: salePricePerUnit,
        salePricePerCarton,
        cartonPrice: salePricePerCarton,
        costPerUnit,
        totalSale,
        subtotal: totalSale,
        totalCost,
        grossProfit: round2(totalSale - totalCost),
        batchAllocations: allocations.map(allocation => ({
          batchId: allocation.inventoryLotId,
          routeLoadId: allocation.routeLoadId,
          units: allocation.units,
          costPerUnit: allocation.costPerUnit,
        })),
      };
    });

    const totalAmount = round2(processedItems.reduce((sum, item) => sum + item.totalSale, 0));
    const detailPaid = num(data.paymentDetails?.cash) + num(data.paymentDetails?.transfer);
    const actualPaid = Math.min(round2(data.paid || detailPaid), totalAmount);
    const issuedAt = data.issuedAt || now();
    const paymentDetails = this.normalizePaymentDetails(data.paymentDetails, data.paymentMethod, actualPaid, totalAmount);

    store.counters.invoice += 1;
    const invoice = {
      id: nanoid(8),
      invoiceNumber: `FAC-${store.counters.invoice}`,
      number: `FAC-${store.counters.invoice}`,
      invoiceDate: today(issuedAt),
      issuedAt,
      date: issuedAt,
      totalAmount,
      total: totalAmount,
      paidAmount: actualPaid,
      paid: actualPaid,
      balanceDue: round2(totalAmount - actualPaid),
      status: this.invoiceStatus(actualPaid, totalAmount),
      paymentStatus: this.invoiceStatus(actualPaid, totalAmount),
      invoiceStatus: 'emitida',
      createdAt: issuedAt,
      customerId: customer.id,
      clientId: isFreeSale ? null : customer.id,
      customerName: isFreeSale ? (data.clientName || data.freeClientName || customer.name) : customer.name,
      clientName: isFreeSale ? (data.clientName || data.freeClientName || customer.name) : customer.name,
      routeId: route.id,
      truckId: route.truckId || route.assignedTruckId || null,
      sellerUserId: actorUserId || this.employeeToUserId(sellerEmployeeId),
      sellerEmployeeId,
      sellerId: sellerEmployeeId,
      paymentMethod: data.paymentMethod || (actualPaid < totalAmount ? 'credito' : 'efectivo'),
      paymentDetails,
      invoiceType: isFreeSale ? 'venta-libre' : route.id === 'r-free' ? 'venta-libre' : 'venta-desde-ruta',
      isFreeSale,
      isFree: isFreeSale,
      notes: data.notes || '',
      dueDate: actualPaid < totalAmount ? (data.dueDate || this.addDays(today(issuedAt), 15)) : null,
    };

    store.invoices.unshift(invoice);

    for (const item of processedItems) {
      item.invoiceId = invoice.id;
      store.saleItems.push(item);
    }

    if (invoice.balanceDue > 0) {
      store.accountReceivables.unshift({
        id: nanoid(8),
        customerId: customer.id,
        invoiceId: invoice.id,
        totalAmount,
        amount: totalAmount,
        paidAmount: actualPaid,
        paid: actualPaid,
        balanceDue: invoice.balanceDue,
        status: invoice.status,
        dueDate: invoice.dueDate,
        createdAt: issuedAt,
      });
    }

    this.recordTransaction({
      type: 'venta',
      amount: totalAmount,
      recordedByUserId: invoice.sellerUserId || actorUserId || 'usr-admin',
      customerId: customer.id,
      invoiceId: invoice.id,
      routeId: route.id,
      truckId: invoice.truckId,
      employeeId: sellerEmployeeId,
      description: `Factura ${invoice.invoiceNumber}`,
      createdAt: issuedAt,
    });

    if (actualPaid > 0) {
      const payment = {
        id: nanoid(8),
        invoiceId: invoice.id,
        clientId: isFreeSale ? null : customer.id,
        customerId: customer.id,
        date: issuedAt,
        paymentDate: issuedAt,
        amount: actualPaid,
        method: invoice.paymentMethod,
        note: 'Pago inicial',
        createdByUserId: data.createdByUserId || actorUserId || 'usr-admin',
      };
      store.customerPayments.push(payment);
      this.recordTransaction({
        type: 'cobro cliente',
        amount: actualPaid,
        recordedByUserId: payment.createdByUserId,
        customerId: customer.id,
        invoiceId: invoice.id,
        routeId: route.id,
        truckId: invoice.truckId,
        employeeId: this.resolveEmployeeId(data.createdByUserId || actorUserId) || invoice.sellerEmployeeId || null,
        description: `Cobro inicial ${invoice.invoiceNumber}`,
        createdAt: issuedAt,
      });
    }

    this.refreshCustomerBalance(customer.id);
    this.refreshRouteMetrics(route.id);
    this.refreshAllProductStock();
    return this.buildInvoiceView(invoice);
  }

  addPayment(data) {
    const invoice = store.invoices.find(item => item.id === data.invoiceId);
    if (!invoice) throw new Error('Factura no encontrada');
    const amount = round2(data.amount);
    if (amount <= 0) throw new Error('El monto debe ser mayor a 0');
    if (amount > invoice.balanceDue + 0.01) throw new Error(`El pago excede el saldo pendiente (${invoice.balanceDue.toFixed(2)})`);

    invoice.paidAmount = round2(invoice.paidAmount + amount);
    invoice.paid = invoice.paidAmount;
    invoice.balanceDue = round2(invoice.totalAmount - invoice.paidAmount);
    invoice.status = this.invoiceStatus(invoice.paidAmount, invoice.totalAmount);
    invoice.paymentStatus = invoice.status;

    const receivable = store.accountReceivables.find(item => item.invoiceId === invoice.id);
    if (receivable) {
      receivable.paidAmount = round2(receivable.paidAmount + amount);
      receivable.paid = receivable.paidAmount;
      receivable.balanceDue = round2(receivable.totalAmount - receivable.paidAmount);
      receivable.status = this.invoiceStatus(receivable.paidAmount, receivable.totalAmount);
    }

    if (data.method === 'transferencia') {
      invoice.paymentDetails.transfer = round2((invoice.paymentDetails.transfer || 0) + amount);
    } else {
      invoice.paymentDetails.cash = round2((invoice.paymentDetails.cash || 0) + amount);
    }
    invoice.paymentDetails.credit = round2(invoice.totalAmount - invoice.paidAmount);

    const payment = {
      id: nanoid(8),
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      customerId: invoice.customerId,
      date: data.paymentDate || now(),
      paymentDate: data.paymentDate || now(),
      amount,
      method: data.method || 'efectivo',
      note: data.note || '',
      createdByUserId: data.createdByUserId || 'usr-admin',
    };
    store.customerPayments.push(payment);

    this.recordTransaction({
      type: 'cobro cliente',
      amount,
      recordedByUserId: payment.createdByUserId,
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      routeId: invoice.routeId,
      truckId: invoice.truckId,
      employeeId: invoice.sellerEmployeeId || null,
      description: payment.note || `Cobro ${invoice.invoiceNumber}`,
      createdAt: payment.paymentDate,
    });

    this.refreshCustomerBalance(invoice.customerId);
    return payment;
  }

  createTruck(data) {
    if (!data.code && !data.name) throw new Error('El codigo o nombre del camion es requerido');
    const capacityCartons = round2(data.capacityCartons);
    const truck = {
      id: nanoid(8),
      name: data.name || data.code,
      code: data.code || data.name,
      plate: data.plate || '',
      capacityCartons,
      capacityUnits: round2(data.capacityUnits || capacityCartons * EGG_PER_CARTON),
      status: data.status || 'Disponible',
      createdAt: now(),
    };
    store.trucks.unshift(truck);
    return truck;
  }

  updateTruck(id, data) {
    const truck = this.getTruck(id);
    if (!truck) throw new Error('Camion no encontrado');
    const capacityCartons = data.capacityCartons !== undefined ? round2(data.capacityCartons) : truck.capacityCartons;
    Object.assign(truck, {
      name: data.name ?? truck.name,
      code: data.code ?? truck.code,
      plate: data.plate ?? truck.plate,
      capacityCartons,
      capacityUnits: data.capacityUnits !== undefined ? round2(data.capacityUnits) : round2(capacityCartons * EGG_PER_CARTON),
      status: data.status ?? truck.status,
    });
    return truck;
  }

  createExpense(data) {
    const amount = round2(data.amount);
    if (amount <= 0) throw new Error('El monto debe ser mayor a 0');
    const expenseDate = data.expenseDate || data.date || now();
    if (data.actorUserId && data.routeId) {
      const route = this.requireRoute(data.routeId);
      if (route.assignedUserId && route.assignedUserId !== data.actorUserId && data.actorRole === 'vendedor') {
        throw new Error('Solo puedes registrar gastos en tu ruta asignada');
      }
    }
    const expense = {
      id: nanoid(8),
      category: data.category || 'Otros',
      amount,
      description: data.description || '',
      expenseDate,
      date: expenseDate,
      routeId: data.routeId || null,
      truckId: data.truckId || null,
      employeeId: this.resolveEmployeeId(data.employeeId || data.sellerId || null),
      seller: data.seller || this.getEmployeeName(data.employeeId) || null,
      createdBy: data.createdBy || data.createdByUserId || data.actorUserId || 'usr-admin',
      createdAt: now(),
    };
    store.expenses.unshift(expense);

    this.recordTransaction({
      type: 'gasto',
      amount,
      recordedByUserId: expense.createdBy,
      routeId: expense.routeId,
      truckId: expense.truckId,
      employeeId: expense.employeeId,
      description: expense.description || expense.category,
      createdAt: expenseDate,
    });

    if (expense.routeId) this.settleRoute(expense.routeId, 'usr-admin');
    return expense;
  }

  returnRouteInventory(routeId, data = {}) {
    const route = this.requireRoute(routeId);
    const returnDate = data.returnDate || now();
    const inputs = Array.isArray(data.items) && data.items.length
      ? data.items
      : store.routeLoads
        .filter(load => load.routeId === routeId && num(load.remainingUnits) > 0)
        .map(load => ({
          routeLoadId: load.id,
          returnedUnits: load.remainingUnits,
          brokenUnits: 0,
        }));

    if (!inputs.length) throw new Error('La ruta no tiene huevos pendientes para devolver');

    const createdReturns = [];

    for (const input of inputs) {
      const routeLoad = store.routeLoads.find(load => load.id === input.routeLoadId && load.routeId === routeId);
      if (!routeLoad) throw new Error('Carga de ruta no encontrada');

      const maxRemaining = num(routeLoad.remainingUnits);
      const brokenUnits = round2(input.brokenUnits);
      let returnedUnits = input.returnedUnits !== undefined ? round2(input.returnedUnits) : round2(maxRemaining - brokenUnits);

      if (brokenUnits < 0 || returnedUnits < 0) throw new Error('Los huevos devueltos o rotos no pueden ser negativos');
      if (returnedUnits + brokenUnits > maxRemaining + 0.01) {
        throw new Error('La devolucion excede los huevos restantes en la ruta');
      }

      routeLoad.returnedUnits = round2(num(routeLoad.returnedUnits) + returnedUnits);
      routeLoad.brokenUnits = round2(num(routeLoad.brokenUnits) + brokenUnits);
      routeLoad.remainingUnits = round2(maxRemaining - returnedUnits - brokenUnits);

      const sourceLot = store.inventoryLots.find(lot => lot.id === routeLoad.inventoryLotId);
      if (returnedUnits > 0) {
        store.counters.inventoryReturn += 1;
        const returnLot = {
          id: nanoid(8),
          productId: routeLoad.productId,
          eggTypeId: routeLoad.eggTypeId,
          vendorId: routeLoad.vendorId,
          supplierId: routeLoad.vendorId,
          purchaseId: null,
          purchaseDate: returnDate,
          quantityUnits: returnedUnits,
          remainingUnits: returnedUnits,
          purchaseCostPerUnit: routeLoad.costPerUnit,
          costPerUnit: routeLoad.costPerUnit,
          purchaseCostPerCarton: round2(routeLoad.costPerUnit * EGG_PER_CARTON),
          costPerCarton: round2(routeLoad.costPerUnit * EGG_PER_CARTON),
          createdAt: returnDate,
          sourceType: 'route-return',
          sourceLabel: 'Huevos devueltos',
          routeId,
          routeLoadId: routeLoad.id,
          note: `Huevos devueltos de la ruta ${route.name}`,
        };
        store.inventoryLots.unshift(returnLot);

        const returnRecord = {
          id: nanoid(8),
          returnNumber: `DEV-${store.counters.inventoryReturn}`,
          routeId,
          routeLoadId: routeLoad.id,
          productId: routeLoad.productId,
          eggTypeId: routeLoad.eggTypeId,
          inventoryLotId: returnLot.id,
          sourceInventoryLotId: routeLoad.inventoryLotId,
          vendorId: routeLoad.vendorId,
          returnedUnits,
          brokenUnits,
          costPerUnit: routeLoad.costPerUnit,
          returnDate,
          note: input.note || '',
          createdByUserId: data.createdByUserId || data.actorUserId || 'usr-admin',
        };
        store.inventoryReturns.unshift(returnRecord);
        createdReturns.push(returnRecord);

        this.recordTransaction({
          type: 'ajuste',
          amount: round2(returnedUnits * routeLoad.costPerUnit),
          recordedByUserId: returnRecord.createdByUserId,
          routeId,
          truckId: route.truckId,
          description: `Huevos devueltos a inventario general - ${route.name}`,
          createdAt: returnDate,
        });
      }

      if (brokenUnits > 0) {
        this.recordTransaction({
          type: 'ajuste',
          amount: round2(brokenUnits * routeLoad.costPerUnit),
          recordedByUserId: data.createdByUserId || data.actorUserId || 'usr-admin',
          routeId,
          truckId: route.truckId,
          description: `Huevos rotos reportados - ${route.name}`,
          createdAt: returnDate,
        });
      }

      if (sourceLot) sourceLot.updatedAt = returnDate;
    }

    this.refreshRouteMetrics(routeId);
    this.refreshAllProductStock();
    this.settleRoute(routeId, data.approvedByUserId || data.createdByUserId || 'usr-admin');

    return {
      route: this.getRoute(routeId),
      returns: createdReturns,
    };
  }

  settleRoute(routeId, approvedByUserId = 'usr-admin') {
    const route = this.requireRoute(routeId);
    const routeLoads = store.routeLoads.filter(item => item.routeId === routeId);
    const routeInvoices = store.invoices.filter(item => item.routeId === routeId);
    const invoiceIds = routeInvoices.map(item => item.id);
    const routeExpenses = store.expenses.filter(item => item.routeId === routeId);

    const totalLoadedUnits = round2(routeLoads.reduce((sum, item) => sum + item.loadedUnits, 0));
    const totalSoldUnits = round2(routeLoads.reduce((sum, item) => sum + item.soldUnits, 0));
    const totalReturnedUnits = round2(routeLoads.reduce((sum, item) => sum + item.returnedUnits, 0));
    const totalBrokenUnits = round2(routeLoads.reduce((sum, item) => sum + num(item.brokenUnits), 0));
    const totalCash = round2(routeInvoices.reduce((sum, invoice) => sum + num(invoice.paymentDetails?.cash), 0));
    const totalTransfer = round2(routeInvoices.reduce((sum, invoice) => sum + num(invoice.paymentDetails?.transfer), 0));
    const totalCredit = round2(routeInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0));
    const totalSales = round2(routeInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
    const totalCost = round2(this.getInvoicesCost(invoiceIds));
    const totalExpenses = round2(routeExpenses.reduce((sum, expense) => sum + expense.amount, 0));
    const grossProfit = round2(totalSales - totalCost);
    const netProfit = round2(grossProfit - totalExpenses);

    let settlement = store.routeSettlements.find(item => item.routeId === routeId);
    if (!settlement) {
      store.counters.settlement += 1;
      settlement = {
        id: nanoid(8),
        routeId,
        totalLoadedUnits: 0,
        totalSoldUnits: 0,
        totalReturnedUnits: 0,
        totalBrokenUnits: 0,
        totalCash: 0,
        totalTransfer: 0,
        totalCredit: 0,
        totalSales: 0,
        totalCost: 0,
        totalExpenses: 0,
        grossProfit: 0,
        netProfit: 0,
        status: 'borrador',
        approvedBy: approvedByUserId,
        createdAt: now(),
      };
      store.routeSettlements.unshift(settlement);
    }

    Object.assign(settlement, {
      totalLoadedUnits,
      totalSoldUnits,
      totalReturnedUnits,
      totalBrokenUnits,
      totalCash,
      totalTransfer,
      totalCredit,
      totalSales,
      totalCost,
      totalExpenses,
      grossProfit,
      netProfit,
      status: route.status === 'Cerrada' ? 'aprobado' : 'borrador',
      approvedBy: approvedByUserId,
      createdAt: settlement.createdAt || now(),
    });

    return settlement;
  }

  buildScopedState(actor = null) {
    const scope = this.getCollectionsForActor(actor);
    const customers = scope.customers
      .slice()
      .sort((a, b) =>
        Number(a.isGeneralCustomer) - Number(b.isGeneralCustomer)
        || Number(b.status === 'activo') - Number(a.status === 'activo')
        || a.name.localeCompare(b.name));

    const routes = scope.routes
      .slice()
      .sort((a, b) =>
        Number(a.id === 'r-free') - Number(b.id === 'r-free')
        || Number(b.status === 'En proceso') - Number(a.status === 'En proceso')
        || Number(b.status === 'Abierta') - Number(a.status === 'Abierta')
        || new Date(b.startedAt) - new Date(a.startedAt));

    const invoices = scope.invoices
      .slice()
      .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
      .map(invoice => this.buildInvoiceView(invoice, scope.saleItems));

    const purchases = scope.purchases
      .slice()
      .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
      .map(purchase => this.buildPurchaseView(purchase, scope.purchaseItems));

    return {
      company: store.company,
      runtime: {
        database: getDatabaseConfig(),
        usingMockData: getDatabaseConfig().driver === 'mock',
      },
      schema: this.getSchemaMeta(),
      currentUser: actor ? sanitizeUser(actor) : null,
      users: actor?.role === 'admin' ? scope.users.map(user => sanitizeUser(user)) : [sanitizeUser(actor)],
      employees: actor?.role === 'admin' ? scope.employees : scope.employees.filter(employee => employee.id === actor?.employeeId),
      customers,
      vendors: scope.vendors,
      products: scope.products,
      invoices,
      transactions: scope.transactions,
      routes,
      trucks: scope.trucks,
      inventoryLots: scope.inventoryLots,
      purchases,
      purchaseItems: scope.purchaseItems,
      routeLoads: scope.routeLoads,
      saleItems: scope.saleItems,
      expenses: scope.expenses,
      accountReceivables: scope.accountReceivables,
      accountPayables: scope.accountPayables,
      routeSettlements: scope.routeSettlements,
      customerPayments: scope.customerPayments,
      vendorPayments: scope.vendorPayments,
      inventoryReturns: scope.inventoryReturns,
      auditLogs: actor?.role === 'admin' ? scope.auditLogs : [],
      eggTypes: scope.products,
      suppliers: scope.vendors,
      clients: customers,
      batches: actor?.role === 'admin' ? scope.inventoryLots : this.buildVendorBatchView(scope),
      payables: scope.accountPayables,
      payments: scope.customerPayments,
      payablePayments: scope.vendorPayments,
      inventoryReturns: scope.inventoryReturns,
    };
  }

  vendorDashboard(actor) {
    const scope = this.getCollectionsForActor(actor);
    const activeRoute = scope.routes.find(route => route.status === 'En proceso') || scope.routes[0] || null;
    const activeRouteLoads = activeRoute ? scope.routeLoads.filter(load => load.routeId === activeRoute.id) : [];
    const activeRouteInvoices = activeRoute ? scope.invoices.filter(invoice => invoice.routeId === activeRoute.id) : [];
    const activeRouteExpenses = activeRoute ? scope.expenses.filter(expense => expense.routeId === activeRoute.id) : [];
    const loadedUnits = activeRouteLoads.reduce((sum, load) => sum + load.loadedUnits, 0);
    const soldUnits = activeRouteLoads.reduce((sum, load) => sum + load.soldUnits, 0);
    const availableUnits = activeRouteLoads.reduce((sum, load) => sum + load.remainingUnits, 0);
    const totalSales = activeRouteInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    const totalExpenses = activeRouteExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalCash = activeRouteInvoices.reduce((sum, invoice) => sum + num(invoice.paymentDetails?.cash), 0);
    const totalTransfer = activeRouteInvoices.reduce((sum, invoice) => sum + num(invoice.paymentDetails?.transfer), 0);
    const totalCredit = activeRouteInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);

    return {
      role: 'vendedor',
      activeRoute,
      truck: activeRoute ? this.getTruck(activeRoute.truckId) : null,
      loadedUnits: round2(loadedUnits),
      soldUnits: round2(soldUnits),
      availableUnits: round2(availableUnits),
      salesCount: activeRouteInvoices.length,
      expensesCount: activeRouteExpenses.length,
      totalSales: round2(totalSales),
      totalExpenses: round2(totalExpenses),
      totalCash: round2(totalCash),
      totalTransfer: round2(totalTransfer),
      totalCredit: round2(totalCredit),
      stockByType: this.getVendorStockByType(scope.routeLoads),
      routeCount: scope.routes.length,
    };
  }

  vendorReports(actor) {
    const scope = this.getCollectionsForActor(actor);
    const routeProfit = scope.routes.map(route => {
      const routeInvoices = scope.invoices.filter(invoice => invoice.routeId === route.id);
      const routeInvoiceIds = routeInvoices.map(invoice => invoice.id);
      const totalSold = round2(routeInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
      const totalCashed = round2(scope.customerPayments
        .filter(payment => routeInvoiceIds.includes(payment.invoiceId))
        .reduce((sum, payment) => sum + payment.amount, 0));
      const totalCredit = round2(totalSold - totalCashed);
      const totalCOGS = round2(scope.saleItems
        .filter(item => routeInvoiceIds.includes(item.invoiceId))
        .reduce((sum, item) => sum + item.totalCost, 0));
      const expenses = round2(scope.expenses
        .filter(expense => expense.routeId === route.id)
        .reduce((sum, expense) => sum + expense.amount, 0));

      return {
        ...route,
        truckCode: this.getTruck(route.truckId)?.code || 'N/A',
        totalSold,
        totalCashed,
        totalCredit,
        totalCOGS,
        grossProfit: round2(totalSold - totalCOGS),
        expenses,
        profit: round2(totalSold - totalCOGS - expenses),
        invoiceCount: routeInvoices.length,
      };
    });

    const totalRevenue = round2(scope.invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
    const totalCOGS = round2(scope.saleItems.reduce((sum, item) => sum + item.totalCost, 0));
    const totalExpenses = round2(scope.expenses.reduce((sum, expense) => sum + expense.amount, 0));

    return {
      salesByDay: this.groupSalesByDay(scope.invoices, scope.saleItems),
      expensesByCategory: this.groupExpensesByCategory(scope.expenses),
      topClients: scope.customers.map(customer => ({
        ...customer,
        purchases: round2(scope.invoices.filter(invoice => invoice.customerId === customer.id).reduce((sum, invoice) => sum + invoice.totalAmount, 0)),
      })).sort((a, b) => b.purchases - a.purchases),
      inventory: this.getVendorInventory(scope.routeLoads),
      routeProfit,
      profitLoss: {
        revenue: totalRevenue,
        cogs: totalCOGS,
        grossProfit: round2(totalRevenue - totalCOGS),
        grossMargin: totalRevenue > 0 ? ((totalRevenue - totalCOGS) / totalRevenue * 100).toFixed(1) : '0',
        expenses: totalExpenses,
        netProfit: round2(totalRevenue - totalCOGS - totalExpenses),
        netMargin: totalRevenue > 0 ? ((totalRevenue - totalCOGS - totalExpenses) / totalRevenue * 100).toFixed(1) : '0',
      },
      purchasesBySupplier: [],
      routeSettlements: scope.routeSettlements,
      vendorScope: true,
    };
  }

  buildPurchaseView(purchase, purchaseItems = store.purchaseItems) {
    return {
      ...purchase,
      items: purchaseItems.filter(item => item.purchaseId === purchase.id),
    };
  }

  buildInvoiceView(invoice, saleItems = store.saleItems) {
    return {
      ...invoice,
      items: saleItems.filter(item => item.invoiceId === invoice.id),
    };
  }

  getCollectionsForActor(actor = null) {
    if (!actor || actor.role === 'admin') {
      return {
        users: store.users,
        employees: store.employees,
        customers: store.customers,
        vendors: store.vendors,
        products: store.products,
        invoices: store.invoices,
        transactions: store.transactions,
        routes: store.routes,
        trucks: store.trucks,
        inventoryLots: store.inventoryLots,
        purchases: store.purchases,
        purchaseItems: store.purchaseItems,
        routeLoads: store.routeLoads,
        saleItems: store.saleItems,
        expenses: store.expenses,
        accountReceivables: store.accountReceivables,
        accountPayables: store.accountPayables,
        routeSettlements: store.routeSettlements,
        customerPayments: store.customerPayments,
        vendorPayments: store.vendorPayments,
        inventoryReturns: store.inventoryReturns,
        auditLogs: store.auditLogs,
      };
    }

    const routeIds = this.getAccessibleRouteIds(actor);
    const routeIdSet = new Set(routeIds);
    const routes = store.routes.filter(route => routeIdSet.has(route.id));
    const truckIdSet = new Set(routes.map(route => route.truckId).filter(Boolean));
    const routeLoadIdSet = new Set(store.routeLoads.filter(load => routeIdSet.has(load.routeId)).map(load => load.id));
    const routeLoads = store.routeLoads.filter(load => routeIdSet.has(load.routeId));
    const inventoryLotIdSet = new Set(routeLoads.map(load => load.inventoryLotId).filter(Boolean));
    const invoiceIdSet = new Set(store.invoices
      .filter(invoice => routeIdSet.has(invoice.routeId) || invoice.sellerUserId === actor.id)
      .map(invoice => invoice.id));
    const invoices = store.invoices.filter(invoice => invoiceIdSet.has(invoice.id));
    const customerIdSet = new Set(store.customers
      .filter(customer => routeIdSet.has(customer.routeId) || customer.isGeneralCustomer)
      .map(customer => customer.id));
    const customers = store.customers.filter(customer => customerIdSet.has(customer.id));

    return {
      users: store.users.filter(user => user.id === actor.id),
      employees: store.employees.filter(employee => employee.id === actor.employeeId),
      customers,
      vendors: [],
      products: store.products,
      invoices,
      transactions: store.transactions.filter(tx => routeIdSet.has(tx.routeId) || tx.recordedByUserId === actor.id),
      routes,
      trucks: store.trucks.filter(truck => truckIdSet.has(truck.id)),
      inventoryLots: store.inventoryLots.filter(lot => inventoryLotIdSet.has(lot.id)),
      purchases: [],
      purchaseItems: [],
      routeLoads,
      saleItems: store.saleItems.filter(item => invoiceIdSet.has(item.invoiceId) || routeLoadIdSet.has(item.routeLoadId)),
      expenses: store.expenses.filter(expense => routeIdSet.has(expense.routeId) || expense.createdBy === actor.id),
      accountReceivables: store.accountReceivables.filter(receivable => invoiceIdSet.has(receivable.invoiceId)),
      accountPayables: [],
      routeSettlements: store.routeSettlements.filter(settlement => routeIdSet.has(settlement.routeId)),
      customerPayments: store.customerPayments.filter(payment => invoiceIdSet.has(payment.invoiceId)),
      vendorPayments: [],
      inventoryReturns: store.inventoryReturns.filter(item => routeIdSet.has(item.routeId)),
      auditLogs: store.auditLogs.filter(log => log.userId === actor.id || routeIdSet.has(log.routeId)),
    };
  }

  getAccessibleRouteIds(actor) {
    if (!actor) return [];
    if (actor.role === 'admin') return store.routes.map(route => route.id);
    const assigned = Array.isArray(actor.assignedRouteIds) ? actor.assignedRouteIds : [];
    const routeAssigned = store.routes.filter(route => route.assignedUserId === actor.id).map(route => route.id);
    return Array.from(new Set([...assigned, ...routeAssigned]));
  }

  buildVendorBatchView(scope) {
    return scope.routeLoads.map(load => {
      const lot = scope.inventoryLots.find(item => item.id === load.inventoryLotId);
      return {
        id: load.id,
        supplierId: lot?.supplierId || lot?.vendorId || '',
        eggTypeId: load.eggTypeId,
        purchaseDate: lot?.purchaseDate || load.createdAt,
        quantityUnits: load.loadedUnits,
        remainingUnits: load.remainingUnits,
        brokenUnits: num(load.brokenUnits),
        costPerUnit: load.costPerUnit,
        costPerCarton: round2(load.costPerUnit * EGG_PER_CARTON),
        routeId: load.routeId,
        routeLoadId: load.id,
      };
    });
  }

  getVendorStockByType(routeLoads) {
    return store.products.map(product => {
      const loads = routeLoads.filter(load => load.productId === product.id);
      const loadedUnits = loads.reduce((sum, load) => sum + load.loadedUnits, 0);
      const soldUnits = loads.reduce((sum, load) => sum + load.soldUnits, 0);
      const availableUnits = loads.reduce((sum, load) => sum + load.remainingUnits, 0);
      return {
        ...product,
        loadedUnits,
        soldUnits,
        returnedUnits: loads.reduce((sum, load) => sum + num(load.returnedUnits), 0),
        brokenUnits: loads.reduce((sum, load) => sum + num(load.brokenUnits), 0),
        stockUnits: availableUnits,
        stockCartons: {
          cartons: Math.floor(availableUnits / EGG_PER_CARTON),
          rest: availableUnits % EGG_PER_CARTON,
          decimalCartons: cartonsFromUnits(availableUnits).toFixed(2),
        },
      };
    }).filter(product => product.loadedUnits > 0 || product.stockUnits > 0 || product.soldUnits > 0);
  }

  getVendorInventory(routeLoads) {
    return this.getVendorStockByType(routeLoads).map(item => ({
      ...item,
      stockUnits: item.stockUnits,
      cartons: { decimalCartons: cartonsFromUnits(item.stockUnits).toFixed(2) },
      batches: routeLoads.filter(load => load.productId === item.id).map(load => ({
        ...load,
        supplierName: this.getVendor(load.vendorId)?.name || 'N/A',
      })),
    }));
  }

  groupSalesByDay(invoices, saleItems) {
    const salesMap = new Map();
    for (const invoice of invoices) {
      const key = today(invoice.issuedAt);
      const row = salesMap.get(key) || { date: key, total: 0, count: 0, cogs: 0 };
      row.total += invoice.totalAmount;
      row.count += 1;
      row.cogs += saleItems
        .filter(item => item.invoiceId === invoice.id)
        .reduce((sum, item) => sum + item.totalCost, 0);
      salesMap.set(key, row);
    }
    return Array.from(salesMap.values())
      .map(row => ({ ...row, total: round2(row.total), cogs: round2(row.cogs) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  groupExpensesByCategory(expenses) {
    return Object.values(expenses.reduce((acc, expense) => {
      if (!acc[expense.category]) acc[expense.category] = { category: expense.category, total: 0 };
      acc[expense.category].total += expense.amount;
      return acc;
    }, {}))
      .map(item => ({ ...item, total: round2(item.total) }))
      .sort((a, b) => b.total - a.total);
  }

  defaultPermissionsForRole(role) {
    const permissions = {
      admin: ['*'],
      vendedor: ['routes.read.own', 'sales.create.own-route', 'expenses.create.own-route', 'reports.print.own'],
    };
    return permissions[role] || [];
  }

  toUnits(quantity, mode = 'unit') {
    return mode === 'carton' ? round2(num(quantity) * EGG_PER_CARTON) : round2(num(quantity));
  }

  invoiceStatus(paid, total) {
    if (num(paid) <= 0) return 'pendiente';
    if (num(paid) >= num(total)) return 'pagada';
    return 'parcial';
  }

  purchaseStatus(paid, total) {
    if (num(paid) <= 0) return 'pendiente';
    if (num(paid) >= num(total)) return 'pagado';
    return 'parcial';
  }

  normalizePaymentDetails(paymentDetails, paymentMethod, paidAmount, totalAmount) {
    const initialCash = num(paymentDetails?.cash);
    const initialTransfer = num(paymentDetails?.transfer);
    const paid = round2(paidAmount);
    let cash = initialCash;
    let transfer = initialTransfer;

    if (cash + transfer === 0 && paid > 0) {
      if (paymentMethod === 'transferencia') transfer = paid;
      else cash = paid;
    }

    if (cash + transfer > paid) {
      const factor = paid / (cash + transfer);
      cash = round2(cash * factor);
      transfer = round2(transfer * factor);
    }

    return {
      cash: round2(cash),
      transfer: round2(transfer),
      credit: round2(totalAmount - paid),
    };
  }

  allocateFromWarehouse(productId, unitsNeeded, preferredLotId = null) {
    const lots = store.inventoryLots
      .filter(lot => lot.productId === productId && lot.remainingUnits > 0 && (!preferredLotId || lot.id === preferredLotId))
      .sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate));

    if (!lots.length) throw new Error(`No hay inventario disponible en almacen para ${this.requireProduct(productId).name}`);

    const allocations = [];
    let remaining = unitsNeeded;

    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(lot.remainingUnits, remaining);
      lot.remainingUnits -= take;
      allocations.push({
        inventoryLotId: lot.id,
        vendorId: lot.vendorId,
        units: take,
        costPerUnit: lot.costPerUnit,
      });
      remaining -= take;
    }

    if (remaining > 0) {
      for (const allocation of allocations) {
        const lot = store.inventoryLots.find(item => item.id === allocation.inventoryLotId);
        if (lot) lot.remainingUnits += allocation.units;
      }
      throw new Error(`Inventario insuficiente en almacen para ${this.requireProduct(productId).name}. Faltan ${remaining} unidades.`);
    }

    return allocations;
  }

  consumeRouteInventory(routeId, productId, unitsNeeded) {
    const routeLoads = store.routeLoads
      .filter(load => load.routeId === routeId && load.productId === productId && load.remainingUnits > 0)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (!routeLoads.length) {
      throw new Error(`La ruta no tiene inventario cargado para ${this.requireProduct(productId).name}`);
    }

    const allocations = [];
    let remaining = unitsNeeded;

    for (const load of routeLoads) {
      if (remaining <= 0) break;
      const take = Math.min(load.remainingUnits, remaining);
      load.soldUnits += take;
      load.remainingUnits -= take;
      allocations.push({
        routeLoadId: load.id,
        inventoryLotId: load.inventoryLotId,
        units: take,
        costPerUnit: load.costPerUnit,
      });
      remaining -= take;
    }

    if (remaining > 0) {
      for (const allocation of allocations) {
        const routeLoad = store.routeLoads.find(item => item.id === allocation.routeLoadId);
        if (routeLoad) {
          routeLoad.soldUnits -= allocation.units;
          routeLoad.remainingUnits += allocation.units;
        }
      }
      throw new Error(`Inventario insuficiente en la ruta para ${this.requireProduct(productId).name}. Faltan ${remaining} unidades.`);
    }

    return allocations;
  }

  recordTransaction({
    type,
    amount,
    recordedByUserId,
    customerId = null,
    vendorId = null,
    invoiceId = null,
    purchaseId = null,
    routeId = null,
    truckId = null,
    employeeId = null,
    description = '',
    createdAt = now(),
  }) {
    store.transactions.push({
      id: nanoid(8),
      type,
      amount: round2(amount),
      transactionDate: today(createdAt),
      createdAt,
      recordedByUserId,
      customerId,
      vendorId,
      invoiceId,
      purchaseId,
      routeId,
      truckId,
      employeeId,
      description,
    });
  }

  recordAudit({
    userId,
    action,
    entityType,
    entityId,
    entityName,
    routeId = null,
    details = '',
    createdAt = now(),
  }) {
    store.auditLogs.unshift({
      id: nanoid(8),
      userId,
      action,
      entityType,
      entityId,
      entityName,
      routeId,
      details,
      createdAt,
    });
  }

  refreshRouteMetrics(routeId) {
    const route = this.getRoute(routeId);
    if (!route) return;
    const loads = store.routeLoads.filter(load => load.routeId === routeId);
    if (!loads.length) return;
    route.loadedUnits = round2(loads.reduce((sum, load) => sum + load.loadedUnits, 0));
    route.soldUnits = round2(loads.reduce((sum, load) => sum + load.soldUnits, 0));
    route.returnedUnits = round2(loads.reduce((sum, load) => sum + load.returnedUnits, 0));
    route.brokenUnits = round2(loads.reduce((sum, load) => sum + num(load.brokenUnits), 0));
  }

  refreshAllRouteMetrics() {
    for (const route of store.routes) this.refreshRouteMetrics(route.id);
  }

  refreshAllProductStock() {
    for (const product of store.products) {
      product.stockQuantity = this.getTotalStock(product.id);
    }
  }

  refreshCustomerBalance(customerId) {
    const customer = this.getCustomer(customerId);
    if (!customer) return;
    const balance = round2(store.accountReceivables
      .filter(receivable => receivable.customerId === customerId)
      .reduce((sum, receivable) => sum + receivable.balanceDue, 0));
    customer.balancePending = balance;
    customer.balance = balance;
  }

  refreshVendorBalance(vendorId) {
    const vendor = this.getVendor(vendorId);
    if (!vendor) return;
    vendor.balancePending = round2(store.accountPayables
      .filter(payable => payable.vendorId === vendorId)
      .reduce((sum, payable) => sum + payable.balanceDue, 0));
  }

  getInvoicesCost(invoiceIds) {
    const idSet = new Set(invoiceIds);
    return round2(store.saleItems
      .filter(item => idSet.has(item.invoiceId))
      .reduce((sum, item) => sum + item.totalCost, 0));
  }

  getTotalStock(productId) {
    const warehouseUnits = store.inventoryLots
      .filter(lot => lot.productId === productId)
      .reduce((sum, lot) => sum + lot.remainingUnits, 0);

    const routeUnits = store.routeLoads
      .filter(load => load.productId === productId)
      .reduce((sum, load) => sum + load.remainingUnits, 0);

    return round2(warehouseUnits + routeUnits);
  }

  requireProduct(id) {
    const product = store.products.find(item => item.id === id);
    if (!product) throw new Error('Producto no encontrado');
    return product;
  }

  requireRoute(id) {
    const route = this.getRoute(id);
    if (!route) throw new Error('Ruta no encontrada');
    return route;
  }

  getRoute(id) {
    return store.routes.find(item => item.id === id);
  }

  getTruck(id) {
    return store.trucks.find(item => item.id === id);
  }

  getVendor(id) {
    return store.vendors.find(item => item.id === id);
  }

  getCustomer(id) {
    return store.customers.find(item => item.id === id);
  }

  getGeneralCustomer() {
    return store.customers.find(item => item.isGeneralCustomer);
  }

  resolveEmployeeId(value) {
    if (!value) return null;
    const employee = store.employees.find(item => item.id === value);
    if (employee) return employee.id;
    const user = store.users.find(item => item.id === value || item.username === value);
    if (user?.employeeId) return user.employeeId;
    const byName = store.employees.find(item => item.name === value);
    return byName?.id || null;
  }

  employeeToUserId(employeeId) {
    if (!employeeId) return null;
    return store.users.find(user => user.employeeId === employeeId)?.id || null;
  }

  getEmployeeName(employeeId) {
    if (!employeeId) return null;
    return store.employees.find(employee => employee.id === employeeId)?.name || null;
  }

  addDays(baseDate, days) {
    const value = new Date(`${baseDate}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }
}

export const service = new StoreService();
