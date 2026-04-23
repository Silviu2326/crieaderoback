import { Router } from 'express';
import * as transactionController from '../controllers/transactionController';
import * as invoiceController from '../controllers/invoiceController';
import * as inventoryController from '../controllers/inventoryController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============ TRANSACTIONS ============
// Get financial summary
router.get('/summary/:kennelId', transactionController.getFinancialSummary);

// Get all transactions for a kennel
router.get('/transactions/:kennelId', transactionController.getTransactions);

// Get transaction by ID
router.get('/transactions/detail/:id', transactionController.getTransactionById);

// Create transaction
router.post('/transactions/:kennelId', transactionController.createTransaction);

// Update transaction
router.put('/transactions/:id', transactionController.updateTransaction);

// Delete transaction
router.delete('/transactions/:id', authorize('MANAGER', 'BREEDER'), transactionController.deleteTransaction);

// ============ CATEGORIES ============
// Get all categories
router.get('/categories/:kennelId', transactionController.getCategories);

// Create category
router.post('/categories/:kennelId', transactionController.createCategory);

// Update category
router.put('/categories/:id', transactionController.updateCategory);

// Delete category
router.delete('/categories/:id', authorize('MANAGER', 'BREEDER'), transactionController.deleteCategory);

// ============ INVOICES ============
// Get invoice statistics
router.get('/invoices/stats/:kennelId', invoiceController.getInvoiceStats);

// Get overdue invoices
router.get('/invoices/overdue/:kennelId', invoiceController.getOverdueInvoices);

// Get all invoices
router.get('/invoices/:kennelId', invoiceController.getInvoices);

// Get invoice by ID
router.get('/invoices/detail/:id', invoiceController.getInvoiceById);

// Create invoice
router.post('/invoices/:kennelId', invoiceController.createInvoice);

// Update invoice
router.put('/invoices/:id', invoiceController.updateInvoice);

// Delete invoice
router.delete('/invoices/:id', authorize('MANAGER', 'BREEDER'), invoiceController.deleteInvoice);

// Record payment for invoice
router.post('/invoices/:id/payment', invoiceController.recordPayment);

// ============ INVENTORY ============
// Get inventory statistics
router.get('/inventory/stats/:kennelId', inventoryController.getInventoryStats);

// Get low stock alerts
router.get('/inventory/alerts/:kennelId', inventoryController.getLowStockAlerts);

// Get all inventory items
router.get('/inventory/:kennelId', inventoryController.getInventoryItems);

// Get inventory item by ID
router.get('/inventory/detail/:id', inventoryController.getInventoryItemById);

// Create inventory item
router.post('/inventory/:kennelId', inventoryController.createInventoryItem);

// Update inventory item
router.put('/inventory/:id', inventoryController.updateInventoryItem);

// Delete inventory item
router.delete('/inventory/:id', authorize('MANAGER', 'BREEDER'), inventoryController.deleteInventoryItem);

// Record inventory movement
router.post('/inventory/:id/movement', inventoryController.recordMovement);

// Adjust inventory
router.post('/inventory/:id/adjust', inventoryController.adjustInventory);

export default router;
