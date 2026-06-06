import { Router } from 'express';
import { service } from '../services/storeService.js';
import { requireAdmin, requireAuth, requireVendorRoute } from '../middleware/auth.js';
import { persistStore } from '../config/persistence.js';

const router = Router();
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const ok = (res, data) => res.json({ ok: true, data });
const wrap = fn => async (req, res, next) => {
  try {
    const result = await fn(req, res, next);
    if (MUTATION_METHODS.has(req.method)) {
      persistStore();
    }
    if (!res.headersSent) ok(res, result);
  } catch (error) {
    const status = error.statusCode || 400;
    res.status(status).json({ ok: false, message: error.message });
  }
};

router.get('/health', wrap(() => ({ status: 'ok' })));
router.get('/schema', wrap(() => service.getSchemaMeta()));
router.post('/auth/login', wrap(req => service.authenticate(req.body)));
router.post('/auth/request-password-reset', wrap(req => service.requestPasswordReset(req.body.username)));

router.use(requireAuth);

router.post('/auth/logout', wrap(req => service.logout(req.auth.user)));
router.get('/auth/me', wrap(req => req.auth.safeUser));

router.get('/state', wrap(req => service.getAll(req.auth.user)));
router.get('/dashboard', wrap(req => service.dashboard(req.auth.user)));
router.get('/reports', wrap(req => service.reports(req.auth.user)));

router.post('/users', requireAdmin, wrap(req => service.createUser({ ...req.body, actorUserId: req.auth.user.id })));
router.put('/users/:id', requireAdmin, wrap(req => service.updateUser(req.params.id, { ...req.body, actorUserId: req.auth.user.id })));
router.patch('/users/:id/status', requireAdmin, wrap(req => service.setUserStatus(req.params.id, req.body.status, req.auth.user.id)));
router.delete('/users/:id', requireAdmin, wrap(req => service.deleteUser(req.params.id, req.auth.user.id)));

router.post('/employees', requireAdmin, wrap(req => service.createEmployee(req.body)));
router.put('/employees/:id', requireAdmin, wrap(req => service.updateEmployee(req.params.id, req.body)));

router.post('/products', requireAdmin, wrap(req => service.createProduct(req.body)));
router.put('/products/:id', requireAdmin, wrap(req => service.updateProduct(req.params.id, req.body)));
router.put('/egg-types/:id', requireAdmin, wrap(req => service.updateEggType(req.params.id, req.body)));

router.post('/suppliers', requireAdmin, wrap(req => service.createSupplier(req.body)));
router.put('/suppliers/:id', requireAdmin, wrap(req => service.updateSupplier(req.params.id, req.body)));

router.post('/clients', requireAdmin, wrap(req => service.createClient(req.body)));
router.put('/clients/:id', requireAdmin, wrap(req => service.updateClient(req.params.id, req.body)));

router.post('/purchases', requireAdmin, wrap(req => service.createPurchase({ ...req.body, createdByUserId: req.auth.user.id })));
router.post('/payable-payments', requireAdmin, wrap(req => service.addPayablePayment({ ...req.body, createdByUserId: req.auth.user.id })));

router.post('/routes', requireAdmin, wrap(req => service.createRoute(req.body)));
router.put('/routes/:id', requireAdmin, wrap(req => service.updateRoute(req.params.id, req.body)));
router.post('/route-loads', requireAdmin, wrap(req => service.createRouteLoad(req.body)));
router.post('/routes/:id/returns', requireAdmin, wrap(req => service.returnRouteInventory(req.params.id, {
  ...req.body,
  createdByUserId: req.auth.user.id,
  actorUserId: req.auth.user.id,
})));
router.post('/routes/:id/settlement', requireAdmin, wrap(req => service.settleRoute(req.params.id, req.body.approvedByUserId || req.auth.user.id)));

router.post('/invoices', requireVendorRoute, wrap(req => service.createInvoice({
  ...req.body,
  actorUserId: req.auth.user.id,
  createdByUserId: req.auth.user.id,
})));
router.post('/payments', wrap(req => service.addPayment({ ...req.body, createdByUserId: req.auth.user.id })));

router.post('/trucks', requireAdmin, wrap(req => service.createTruck(req.body)));
router.put('/trucks/:id', requireAdmin, wrap(req => service.updateTruck(req.params.id, req.body)));

router.post('/expenses', requireVendorRoute, wrap(req => service.createExpense({
  ...req.body,
  actorUserId: req.auth.user.id,
  actorRole: req.auth.user.role,
  createdByUserId: req.auth.user.id,
})));

export default router;
