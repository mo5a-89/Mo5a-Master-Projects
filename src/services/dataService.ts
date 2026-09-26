/**
 * Centralized Enterprise Data Service & API Abstraction Layer (SSOT)
 * 
 * Provides unified, asynchronous CRUD operations for all enterprise domain models:
 * - Projects
 * - Customer Quotations & Supplier Quotations
 * - Suppliers & Vendor Capabilities
 * - Invoices & Payment Ledger
 * - Purchase Orders & Governance Approvals
 * - Delivery Notes
 * - Enterprise Settings & Master Identity
 * - Users & RBAC Matrix
 * 
 * Integrates directly with MasterEnterpriseStore, durable localStorage, and
 * background Google Drive auto-synchronization pipeline.
 */

import {
  Project,
  CustomerQuotation,
  SupplierQuotation,
  Supplier,
  Invoice,
  PurchaseOrder,
  DeliveryNote,
  Customer,
  TermsLibraryItem,
  User,
} from '../types';
import {
  getMasterEnterpriseState,
  commitMasterEnterpriseState,
  MasterEnterpriseState,
} from '../store/masterEnterpriseStore';
import { scheduleGoogleDriveAutoSync } from '../utils/googleDriveSync';
import { getAllUsers, saveAllUsers } from '../utils/authService';

// Storage keys
const STORAGE_KEYS = {
  PROJECTS: 'rmt_projects',
  CUSTOMER_QUOTATIONS: 'rmt_customer_quotations',
  SUPPLIER_QUOTATIONS: 'rmt_supplier_quotations',
  SUPPLIERS: 'rmt_suppliers',
  CUSTOMERS: 'rmt_customers',
  INVOICES: 'rmt_invoices',
  PURCHASE_ORDERS: 'rmt_purchase_orders',
  DELIVERY_NOTES: 'rmt_delivery_notes',
  TERMS_LIBRARY: 'rmt_terms_library',
  CLIENT_MASTERS: 'rmt_client_masters',
  THREE_WAY_MATCHES: 'rmt_three_way_matches',
};

/**
 * Internal helper to read JSON safely from localStorage
 */
function readStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[DataService] Error reading ${key} from storage:`, err);
    return defaultValue;
  }
}

/**
 * Internal helper to write JSON safely to localStorage and trigger events
 */
function writeStorage<T>(key: string, value: T, eventName?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (eventName) {
      window.dispatchEvent(new CustomEvent(eventName, { detail: value }));
    }
    window.dispatchEvent(new Event('storage'));
    
    // Trigger debounced cloud sync
    triggerBackgroundSync();
  } catch (err) {
    console.error(`[DataService] Error persisting ${key} to storage:`, err);
  }
}

/**
 * Collect complete application state and push to Google Drive background sync
 */
function triggerBackgroundSync(note?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const statePayload = {
      projects: readStorage<Project[]>(STORAGE_KEYS.PROJECTS, []),
      customerQuotations: readStorage<CustomerQuotation[]>(STORAGE_KEYS.CUSTOMER_QUOTATIONS, []),
      supplierQuotations: readStorage<SupplierQuotation[]>(STORAGE_KEYS.SUPPLIER_QUOTATIONS, []),
      suppliers: readStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []),
      customers: readStorage<Customer[]>(STORAGE_KEYS.CUSTOMERS, []),
      invoices: readStorage<Invoice[]>(STORAGE_KEYS.INVOICES, []),
      purchaseOrders: readStorage<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, []),
      deliveryNotes: readStorage<DeliveryNote[]>(STORAGE_KEYS.DELIVERY_NOTES, []),
      termsLibrary: readStorage<TermsLibraryItem[]>(STORAGE_KEYS.TERMS_LIBRARY, []),
      systemSettings: getMasterEnterpriseState(),
      users: getAllUsers(),
    };
    scheduleGoogleDriveAutoSync(statePayload, note || 'تحديث تلقائي للمنظومة عبر DataService');
  } catch (e) {
    console.warn('[DataService] Cloud sync trigger warning:', e);
  }
}

export const dataService = {
  // =========================================================================
  // 1. PROJECTS API
  // =========================================================================
  async getProjects(): Promise<Project[]> {
    return readStorage<Project[]>(STORAGE_KEYS.PROJECTS, []);
  },

  async saveProject(project: Project): Promise<Project> {
    const projects = await this.getProjects();
    const index = projects.findIndex((p) => p.id === project.id);
    const updatedProject: Project = {
      ...project,
      createdAt: project.createdAt || new Date().toISOString(),
    };

    let nextProjects: Project[];
    if (index >= 0) {
      nextProjects = [...projects];
      nextProjects[index] = updatedProject;
    } else {
      nextProjects = [updatedProject, ...projects];
    }

    writeStorage(STORAGE_KEYS.PROJECTS, nextProjects, 'rmt_projects_updated');
    return updatedProject;
  },

  async deleteProject(id: string): Promise<boolean> {
    const projects = await this.getProjects();
    const filtered = projects.filter((p) => p.id !== id);
    if (filtered.length === projects.length) return false;
    writeStorage(STORAGE_KEYS.PROJECTS, filtered, 'rmt_projects_updated');
    return true;
  },

  // =========================================================================
  // 2. CUSTOMER & SUPPLIER QUOTATIONS API
  // =========================================================================
  async getQuotations(): Promise<CustomerQuotation[]> {
    return readStorage<CustomerQuotation[]>(STORAGE_KEYS.CUSTOMER_QUOTATIONS, []);
  },

  async saveQuotation(quote: CustomerQuotation): Promise<CustomerQuotation> {
    const quotes = await this.getQuotations();
    const index = quotes.findIndex((q) => q.id === quote.id);
    const updatedQuote: CustomerQuotation = {
      ...quote,
      updatedAt: new Date().toISOString(),
      createdAt: quote.createdAt || new Date().toISOString(),
    };

    let nextQuotes: CustomerQuotation[];
    if (index >= 0) {
      nextQuotes = [...quotes];
      nextQuotes[index] = updatedQuote;
    } else {
      nextQuotes = [updatedQuote, ...quotes];
    }

    writeStorage(STORAGE_KEYS.CUSTOMER_QUOTATIONS, nextQuotes, 'rmt_quotations_updated');
    return updatedQuote;
  },

  async deleteQuotation(id: string): Promise<boolean> {
    const quotes = await this.getQuotations();
    const filtered = quotes.filter((q) => q.id !== id);
    if (filtered.length === quotes.length) return false;
    writeStorage(STORAGE_KEYS.CUSTOMER_QUOTATIONS, filtered, 'rmt_quotations_updated');
    return true;
  },

  async getSupplierQuotations(): Promise<SupplierQuotation[]> {
    return readStorage<SupplierQuotation[]>(STORAGE_KEYS.SUPPLIER_QUOTATIONS, []);
  },

  async saveSupplierQuotation(quote: SupplierQuotation): Promise<SupplierQuotation> {
    const quotes = await this.getSupplierQuotations();
    const index = quotes.findIndex((q) => q.id === quote.id);
    const updatedQuote: SupplierQuotation = {
      ...quote,
      createdAt: quote.createdAt || new Date().toISOString(),
    };

    let nextQuotes: SupplierQuotation[];
    if (index >= 0) {
      nextQuotes = [...quotes];
      nextQuotes[index] = updatedQuote;
    } else {
      nextQuotes = [updatedQuote, ...quotes];
    }

    writeStorage(STORAGE_KEYS.SUPPLIER_QUOTATIONS, nextQuotes, 'rmt_supplier_quotes_updated');
    return updatedQuote;
  },

  async deleteSupplierQuotation(id: string): Promise<boolean> {
    const quotes = await this.getSupplierQuotations();
    const filtered = quotes.filter((q) => q.id !== id);
    if (filtered.length === quotes.length) return false;
    writeStorage(STORAGE_KEYS.SUPPLIER_QUOTATIONS, filtered, 'rmt_supplier_quotes_updated');
    return true;
  },

  // =========================================================================
  // 3. SUPPLIERS & VENDOR CAPABILITIES API
  // =========================================================================
  async getSuppliers(): Promise<Supplier[]> {
    return readStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
  },

  async saveSupplier(supplier: Supplier): Promise<Supplier> {
    const suppliers = await this.getSuppliers();
    const index = suppliers.findIndex((s) => s.id === supplier.id);
    const updatedSupplier: Supplier = {
      ...supplier,
      createdAt: supplier.createdAt || new Date().toISOString(),
    };

    let nextSuppliers: Supplier[];
    if (index >= 0) {
      nextSuppliers = [...suppliers];
      nextSuppliers[index] = updatedSupplier;
    } else {
      nextSuppliers = [updatedSupplier, ...suppliers];
    }

    writeStorage(STORAGE_KEYS.SUPPLIERS, nextSuppliers, 'rmt_suppliers_updated');
    return updatedSupplier;
  },

  async deleteSupplier(id: string): Promise<boolean> {
    const suppliers = await this.getSuppliers();
    const filtered = suppliers.filter((s) => s.id !== id);
    if (filtered.length === suppliers.length) return false;
    writeStorage(STORAGE_KEYS.SUPPLIERS, filtered, 'rmt_suppliers_updated');
    return true;
  },

  // =========================================================================
  // 4. INVOICES & REVENUE API
  // =========================================================================
  async getInvoices(): Promise<Invoice[]> {
    return readStorage<Invoice[]>(STORAGE_KEYS.INVOICES, []);
  },

  async saveInvoice(invoice: Invoice): Promise<Invoice> {
    const invoices = await this.getInvoices();
    const index = invoices.findIndex((i) => i.id === invoice.id);
    const updatedInvoice: Invoice = {
      ...invoice,
      updatedAt: new Date().toISOString(),
      createdAt: invoice.createdAt || new Date().toISOString(),
    };

    let nextInvoices: Invoice[];
    if (index >= 0) {
      nextInvoices = [...invoices];
      nextInvoices[index] = updatedInvoice;
    } else {
      nextInvoices = [updatedInvoice, ...invoices];
    }

    writeStorage(STORAGE_KEYS.INVOICES, nextInvoices, 'rmt_invoices_updated');
    return updatedInvoice;
  },

  async deleteInvoice(id: string): Promise<boolean> {
    const invoices = await this.getInvoices();
    const filtered = invoices.filter((i) => i.id !== id);
    if (filtered.length === invoices.length) return false;
    writeStorage(STORAGE_KEYS.INVOICES, filtered, 'rmt_invoices_updated');
    return true;
  },

  // =========================================================================
  // 5. PURCHASE ORDERS & PROCUREMENT GOVERNANCE API
  // =========================================================================
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return readStorage<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, []);
  },

  async savePurchaseOrder(po: PurchaseOrder): Promise<PurchaseOrder> {
    const pos = await this.getPurchaseOrders();
    const index = pos.findIndex((p) => p.id === po.id);
    const updatedPO: PurchaseOrder = {
      ...po,
      updatedAt: new Date().toISOString(),
      createdAt: po.createdAt || new Date().toISOString(),
    };

    let nextPOs: PurchaseOrder[];
    if (index >= 0) {
      nextPOs = [...pos];
      nextPOs[index] = updatedPO;
    } else {
      nextPOs = [updatedPO, ...pos];
    }

    writeStorage(STORAGE_KEYS.PURCHASE_ORDERS, nextPOs, 'rmt_pos_updated');
    return updatedPO;
  },

  async deletePurchaseOrder(id: string): Promise<boolean> {
    const pos = await this.getPurchaseOrders();
    const filtered = pos.filter((p) => p.id !== id);
    if (filtered.length === pos.length) return false;
    writeStorage(STORAGE_KEYS.PURCHASE_ORDERS, filtered, 'rmt_pos_updated');
    return true;
  },

  // =========================================================================
  // 6. DELIVERY NOTES API
  // =========================================================================
  async getDeliveryNotes(): Promise<DeliveryNote[]> {
    return readStorage<DeliveryNote[]>(STORAGE_KEYS.DELIVERY_NOTES, []);
  },

  async saveDeliveryNote(dn: DeliveryNote): Promise<DeliveryNote> {
    const dns = await this.getDeliveryNotes();
    const index = dns.findIndex((d) => d.id === dn.id);
    const updatedDN: DeliveryNote = {
      ...dn,
      updatedAt: new Date().toISOString(),
      createdAt: dn.createdAt || new Date().toISOString(),
    };

    let nextDNs: DeliveryNote[];
    if (index >= 0) {
      nextDNs = [...dns];
      nextDNs[index] = updatedDN;
    } else {
      nextDNs = [updatedDN, ...dns];
    }

    writeStorage(STORAGE_KEYS.DELIVERY_NOTES, nextDNs, 'rmt_dns_updated');
    return updatedDN;
  },

  async deleteDeliveryNote(id: string): Promise<boolean> {
    const dns = await this.getDeliveryNotes();
    const filtered = dns.filter((d) => d.id !== id);
    if (filtered.length === dns.length) return false;
    writeStorage(STORAGE_KEYS.DELIVERY_NOTES, filtered, 'rmt_dns_updated');
    return true;
  },

  // =========================================================================
  // 7. ENTERPRISE SETTINGS & IDENTITY SCHEMA API
  // =========================================================================
  async getEnterpriseSettings(): Promise<MasterEnterpriseState> {
    return getMasterEnterpriseState();
  },

  async updateEnterpriseSettings(settings: Partial<MasterEnterpriseState>): Promise<MasterEnterpriseState> {
    const committed = commitMasterEnterpriseState((prev) => ({
      ...prev,
      ...settings,
    }));
    triggerBackgroundSync('تحديث إعدادات المؤسسة والهوية المعتمدة');
    return committed;
  },

  // =========================================================================
  // 8. USERS & RBAC API
  // =========================================================================
  async getUsers(): Promise<User[]> {
    return getAllUsers();
  },

  async saveUser(user: User): Promise<User> {
    const users = getAllUsers();
    const index = users.findIndex((u) => u.id === user.id || u.username.toLowerCase() === user.username.toLowerCase());
    let nextUsers: User[];
    if (index >= 0) {
      nextUsers = [...users];
      nextUsers[index] = { ...users[index], ...user };
    } else {
      nextUsers = [...users, user];
    }
    saveAllUsers(nextUsers);
    commitMasterEnterpriseState((prev) => ({
      ...prev,
      rbac: { users: nextUsers },
    }));
    triggerBackgroundSync('تحديث حسابات وصلاحيات المستخدمين');
    return user;
  },

  async deleteUser(id: string): Promise<boolean> {
    const users = getAllUsers();
    const filtered = users.filter((u) => u.id !== id);
    if (filtered.length === users.length) return false;
    saveAllUsers(filtered);
    commitMasterEnterpriseState((prev) => ({
      ...prev,
      rbac: { users: filtered },
    }));
    triggerBackgroundSync('حذف مستخدم من المنظومة');
    return true;
  },

  // =========================================================================
  // 9. CUSTOMERS & TERMS LIBRARY API
  // =========================================================================
  async getCustomers(): Promise<Customer[]> {
    return readStorage<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
  },

  async saveCustomer(customer: Customer): Promise<Customer> {
    const customers = await this.getCustomers();
    const index = customers.findIndex((c) => c.id === customer.id);
    let nextCustomers: Customer[];
    if (index >= 0) {
      nextCustomers = [...customers];
      nextCustomers[index] = customer;
    } else {
      nextCustomers = [customer, ...customers];
    }
    writeStorage(STORAGE_KEYS.CUSTOMERS, nextCustomers, 'rmt_customers_updated');
    return customer;
  },

  async deleteCustomer(id: string): Promise<boolean> {
    const customers = await this.getCustomers();
    const filtered = customers.filter((c) => c.id !== id);
    if (filtered.length === customers.length) return false;
    writeStorage(STORAGE_KEYS.CUSTOMERS, filtered, 'rmt_customers_updated');
    return true;
  },

  async getTermsLibrary(): Promise<TermsLibraryItem[]> {
    return readStorage<TermsLibraryItem[]>(STORAGE_KEYS.TERMS_LIBRARY, []);
  },

  async saveTermsLibrary(terms: TermsLibraryItem[]): Promise<TermsLibraryItem[]> {
    writeStorage(STORAGE_KEYS.TERMS_LIBRARY, terms, 'rmt_terms_updated');
    return terms;
  },

  // =========================================================================
  // 10. ATOMIC FULL-SYSTEM STATE ACCESS (For Backup & Cloud Sync)
  // =========================================================================
  async getAllState() {
    return {
      projects: await this.getProjects(),
      customerQuotations: await this.getQuotations(),
      supplierQuotations: await this.getSupplierQuotations(),
      suppliers: await this.getSuppliers(),
      customers: await this.getCustomers(),
      invoices: await this.getInvoices(),
      purchaseOrders: await this.getPurchaseOrders(),
      deliveryNotes: await this.getDeliveryNotes(),
      termsLibrary: await this.getTermsLibrary(),
      systemSettings: await this.getEnterpriseSettings(),
      users: await this.getUsers(),
    };
  },
};
