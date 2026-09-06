import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { Firestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, orderBy, limit, writeBatch } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  /**
   * Firestore rechaza undefined y aborta la escritura entera con
   * "Unsupported field value: undefined". Un campo opcional que el
   * formulario deja vacio bastaba para tumbar el alta completa.
   *
   * Se limpia aqui, en la frontera de datos, y no en cada llamada: asi el
   * problema no puede reaparecer al añadir un campo opcional nuevo.
   * null si se conserva, porque significa "sin valor" de forma explicita.
   */
  private limpiar<T>(data: T): T {
    if (data === null || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map(v => this.limpiar(v)) as T;
    if (data instanceof Date) return data;

    const salida: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(data as Record<string, unknown>)) {
      if (valor === undefined) continue;
      salida[clave] = this.limpiar(valor);
    }
    return salida as T;
  }

  constructor() {
    this.auth.languageCode = 'es';
  }

  // ============================================
  // AUTH METHODS
  // ============================================
  getAuth() {
    return this.auth;
  }

  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  onAuthStateChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(this.auth, callback);
  }

  async signIn(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  async signUp(email: string, password: string) {
    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
    // Enviar verificación pero no bloquear login
    if (userCredential.user) {
      // No requerimos verificación para development
    }
    return userCredential;
  }

  /** Envia el correo de restablecimiento de contraseña. */
  async sendPasswordReset(email: string) {
    return sendPasswordResetEmail(this.auth, email);
  }

  async signOut() {
    return signOut(this.auth);
  }

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this.auth, provider);
  }

  // ============================================
  // USER PROFILE
  // ============================================
  async getUserProfile(userId: string) {
    const docRef = doc(this.firestore, `users/${userId}/profile/data`);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }

  async createUserProfile(userId: string, data: any) {
    const docRef = doc(this.firestore, `users/${userId}/profile/data`);
    return setDoc(docRef, data, { merge: true });
  }

  // ============================================
  // USER PROFILE (NEW - Onboarding)
  // ============================================
  async getUserProfileComplete(userId: string) {
    const docRef = doc(this.firestore, `users/${userId}/profile/data`);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }

  async saveUserProfile(userId: string, data: any) {
    const docRef = doc(this.firestore, `users/${userId}/profile/data`);
    return setDoc(docRef, data, { merge: true });
  }

  // ============================================
  // MONTHS STRUCTURE (NEW)
  // ============================================
  
  // Get month ID from date
  getPeriodoId(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  // Get or create month document
  async getOrCreatePeriodo(userId: string, year: number, month: number): Promise<string> {
    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    const monthRef = doc(this.firestore, `users/${userId}/periodos/${periodoId}`);
    const monthSnap = await getDoc(monthRef);
    
    if (!monthSnap.exists()) {
      await setDoc(monthRef, this.limpiar({
        id: periodoId,
        year,
        month,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }
    
    return periodoId;
  }

  // Get all months for user
  async getPeriodosUsuario(userId: string): Promise<any[]> {
    const q = query(
      collection(this.firestore, `users/${userId}/periodos`),
      orderBy('year', 'desc'),
      orderBy('month', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Get transactions from months structure (with legacy fallback)
  async getHistorialPorPeriodo(userId: string, year: number, month: number) {
    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    
    // Try new structure first
    const q = query(
      collection(this.firestore, `users/${userId}/periodos/${periodoId}/historial`),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    const newTxs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // If new structure has data, use it
    if (newTxs.length > 0) {
      return newTxs;
    }
    
    // Fallback: check legacy flat structure and filter by month
    try {
      const legacyQ = query(
        collection(this.firestore, `users/${userId}/historial`),
        orderBy('date', 'desc'),
        limit(100)
      );
      const legacySnapshot = await getDocs(legacyQ);
      const legacyTxs = legacySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((tx: any) => {
          const txDate = new Date(tx.date || tx.createdAt);
          return txDate.getFullYear() === year && txDate.getMonth() + 1 === month;
        });
      
      return legacyTxs;
    } catch {
      return [];
    }
  }

  // Create transaction in months structure
  async crearRegistro(userId: string, data: any): Promise<any> {
    const date = new Date(data.date);
    const periodoId = this.getPeriodoId(date);
    
    // Ensure month exists
    await this.getOrCreatePeriodo(userId, date.getFullYear(), date.getMonth() + 1);
    
    const docRef = doc(collection(this.firestore, `users/${userId}/periodos/${periodoId}/historial`));
    const txData = {
      ...data,
      id: docRef.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, txData);
    
    // Update financial state
    await this.actualizarEstadoDocumental(userId, periodoId);
    
    return txData;
  }

  // Update transaction in months structure
  async actualizarRegistro(userId: string, registroId: string, data: any): Promise<void> {
    // Find the transaction to know its month by checking all months
    // For now, we'll try the current month and previous months
    const now = new Date();
    let found = false;
    
    for (let i = 0; i <= 2; i++) {
      let year = now.getFullYear();
      let month = now.getMonth() + 1 - i;
      if (month <= 0) {
        month = 12 + month;
        year = year - 1;
      }
      const periodoId = `${year}-${String(month).padStart(2, '0')}`;
      
      const docRef = doc(this.firestore, `users/${userId}/periodos/${periodoId}/historial/${registroId}`);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const txData = docSnap.data();
        const periodoId = this.getPeriodoId(new Date(txData['date']));
        const updateRef = doc(this.firestore, `users/${userId}/periodos/${periodoId}/historial/${registroId}`);
        
        await setDoc(updateRef, this.limpiar({
          ...data,
          updatedAt: new Date().toISOString()
        }), { merge: true });
        
        await this.actualizarEstadoDocumental(userId, periodoId);
        found = true;
        break;
      }
    }
    
    if (!found) throw new Error('Registro no encontrada');
  }

  // Delete transaction from months structure
  async eliminarRegistro(userId: string, registroId: string): Promise<void> {
    // Find the transaction to know its month
    const now = new Date();
    let found = false;
    
    for (let i = 0; i <= 2; i++) {
      let year = now.getFullYear();
      let month = now.getMonth() + 1 - i;
      if (month <= 0) {
        month = 12 + month;
        year = year - 1;
      }
      const periodoId = `${year}-${String(month).padStart(2, '0')}`;
      
      const docRef = doc(this.firestore, `users/${userId}/periodos/${periodoId}/historial/${registroId}`);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const txData = docSnap.data();
        const periodoId = this.getPeriodoId(new Date(txData['date']));
        const deleteRef = doc(this.firestore, `users/${userId}/periodos/${periodoId}/historial/${registroId}`);
        
        await setDoc(deleteRef, this.limpiar({ deletedAt: new Date().toISOString(), deleted: true }), { merge: true });
        
        await this.actualizarEstadoDocumental(userId, periodoId);
        found = true;
        break;
      }
    }
    
    if (!found) throw new Error('Registro no encontrada');
  }

  // Get financial state for a month
  async getEstadoDocumental(userId: string, year: number, month: number): Promise<any> {
    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    const docRef = doc(this.firestore, `users/${userId}/periodos/${periodoId}`);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as any)?.['estadoDocumental'] : null;
  }

  // Update financial state (pre-calculated)
  async actualizarEstadoDocumental(userId: string, periodoId: string) {
    // Get all transactions for the month
    const q = query(collection(this.firestore, `users/${userId}/periodos/${periodoId}/historial`));
    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(doc => doc.data());
    
    // Get income data for this month
    const [year, month] = periodoId.split('-').map(Number);
    const incomeData = await this.calcularDocumentosPeriodo(userId, year, month);
    
    // Calculate totals from transactions (actual received)
    const income = transactions.filter((t: any) => t.amount > 0).reduce((s: number, t: any) => s + t.amount, 0);
    const expenses = transactions.filter((t: any) => t.amount < 0).reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
    
    // Use income data for budgeted amounts
    const budgetedIncome = incomeData.totalBudgeted;
    const initialBalance = incomeData.initialBalance;
    
    // Available now = initial balance + received
    const availableNow = initialBalance + income;
    
    // Budgeted balance = initial + expected income - budgeted expenses
    const budgetedExpenses = expenses; // For now, assume budget = actual for expenses
    
    const balance = availableNow - expenses; // Actual balance
    const budgetedBalance = (initialBalance + budgetedIncome) - budgetedExpenses; // Expected at end of month
    
    const savings = availableNow - expenses;
    const budgetedSavings = (initialBalance + budgetedIncome) - budgetedExpenses;
    const savingsRate = budgetedIncome > 0 ? (budgetedSavings / budgetedIncome) * 100 : 0;
    
    // Calculate 50/30/20 breakdown
    const expensesByType = { need: 0, want: 0, saving: 0 };
    transactions.filter((t: any) => t.amount < 0 && t.ruleType).forEach((t: any) => {
      const type = t.ruleType as keyof typeof expensesByType;
      if (type in expensesByType) {
        expensesByType[type] += Math.abs(t.amount);
      }
    });
    
    // Calculate financial score (simple version)
    let score = 50; // base
    if (savingsRate >= 20) score += 20;
    else if (savingsRate >= 10) score += 10;
    if (expenses <= income) score += 20;
    if (income > 0) score += 10;
    
    // Determine health status
    let healthStatus: 'excellent' | 'good' | 'warning' | 'critical' = 'good';
    if (score >= 80) healthStatus = 'excellent';
    else if (score >= 60) healthStatus = 'good';
    else if (score >= 40) healthStatus = 'warning';
    else healthStatus = 'critical';
    
    // Save financial state with income breakdown
    const estadoDocumental = {
      // Income
      income,
      incomeBudgeted: budgetedIncome,
      incomeReceived: income,
      incomePending: budgetedIncome - income,
      initialBalance,
      availableNow,
      expectedByEndOfMonth: initialBalance + budgetedIncome,
      
      // Expenses
      expenses,
      expensesBudgeted: budgetedExpenses,
      
      // Balance
      balance,
      budgetedBalance,
      
      // Savings
      savings,
      savingsRate: Math.round(savingsRate * 10) / 10,
      
      // Score
      financialScore: score,
      healthStatus,
      
      // Expenses breakdown
      rule50320: expensesByType,
      lastUpdated: new Date().toISOString()
    };
    
    const stateRef = doc(this.firestore, `users/${userId}/periodos/${periodoId}`);
    await setDoc(stateRef, this.limpiar({ estadoDocumental }), { merge: true });
    
    return estadoDocumental;
  }

  // Get month summary
  async getResumenDelPeriodo(userId: string, year: number, month: number): Promise<any> {
    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    
    // Try to get cached state first
    const state = await this.getEstadoDocumental(userId, year, month);
    if (state) return state;
    
    // If not exists, calculate and return
    await this.actualizarEstadoDocumental(userId, periodoId);
    return this.getEstadoDocumental(userId, year, month);
  }

  // ============================================
  // GOALS (Múltiples)
  // ============================================
  
  // Get all goals (new - multiple)
  async getFlujos(userId: string) {
    const q = query(
      collection(this.firestore, `users/${userId}/flujos`),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Get all goals including completed/paused/cancelled
  async getTodosLosFlujos(userId: string) {
    const q = query(
      collection(this.firestore, `users/${userId}/flujos`)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Get single goal
  async getFlujoPorId(userId: string, flujoId: string): Promise<any> {
    const docRef = doc(this.firestore, `users/${userId}/flujos/${flujoId}`);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  // Create goal
  async crearFlujo(userId: string, data: any): Promise<any> {
    const docRef = doc(collection(this.firestore, `users/${userId}/flujos`));
    const now = new Date().toISOString();
    const goalData = {
      ...data,
      id: docRef.id,
      userId,
      etapasCompletadas: data.etapasCompletadas || 0,
      status: 'active',
      estaCompletado: false,
      etapas: [],
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, goalData);
    return goalData;
  }

  // Update goal
  async actualizarFlujo(userId: string, flujoId: string, data: any) {
    const docRef = doc(this.firestore, `users/${userId}/flujos/${flujoId}`);
    await setDoc(docRef, this.limpiar({ ...data, updatedAt: new Date().toISOString() }), { merge: true });
  }

  // Add contribution to goal
  async aprobarEtapa(userId: string, flujoId: string, amount: number, note?: string) {
    const goal: any = await this.getFlujoPorId(userId, flujoId);
    if (!goal) throw new Error('Goal not found');
    
    const contribution = {
      id: Date.now().toString(),
      amount,
      date: new Date().toISOString(),
      note
    };
    
    const newAmount = (goal.etapasCompletadas || 0) + amount;
    const estaCompletado = newAmount >= (goal.etapasTotales || 0);
    
    const docRef = doc(this.firestore, `users/${userId}/flujos/${flujoId}`);
    await setDoc(docRef, this.limpiar({
      etapasCompletadas: newAmount,
      estaCompletado,
      status: estaCompletado ? 'completed' : 'active',
      etapas: [...(goal.etapas || []), contribution],
      updatedAt: new Date().toISOString()
    }), { merge: true });
  }

  // Delete/deactivate goal
  async eliminarFlujo(userId: string, flujoId: string) {
    const docRef = doc(this.firestore, `users/${userId}/flujos/${flujoId}`);
    await setDoc(docRef, this.limpiar({ 
      status: 'cancelled',
      updatedAt: new Date().toISOString()
    }), { merge: true });
  }

  // ============================================
  // INCOME SOURCES (NEW)
  // ============================================
  
  // Get all income sources for user
  async getDocumentos(userId: string) {
    const q = query(
      collection(this.firestore, `users/${userId}/documentos`),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Get active income sources
  async getDocumentosActivos(userId: string) {
    const q = query(
      collection(this.firestore, `users/${userId}/documentos`),
      where('activo', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Create income source
  async crearDocumento(userId: string, data: any): Promise<any> {
    const docRef = doc(collection(this.firestore, `users/${userId}/documentos`));
    const now = new Date().toISOString();
    const sourceData = {
      ...data,
      id: docRef.id,
      userId,
      activo: true,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, sourceData);
    return sourceData;
  }

  // Update income source
  async actualizarDocumento(userId: string, documentoId: string, data: any) {
    const docRef = doc(this.firestore, `users/${userId}/documentos/${documentoId}`);
    await setDoc(docRef, this.limpiar({ ...data, updatedAt: new Date().toISOString() }), { merge: true });
  }

  // Delete (deactivate) income source
  async archivarDocumento(userId: string, documentoId: string) {
    const docRef = doc(this.firestore, `users/${userId}/documentos/${documentoId}`);
    await setDoc(docRef, this.limpiar({ activo: false, updatedAt: new Date().toISOString() }));
  }

  // Record income received
  async registrarVersionDocumento(userId: string, documentoId: string, amount: number, receivedDate: string) {
    const docRef = doc(this.firestore, `users/${userId}/documentos/${documentoId}`);
    await setDoc(docRef, this.limpiar({ 
      actualAmount: amount,
      lastPaymentDate: receivedDate,
      updatedAt: new Date().toISOString()
    }), { merge: true });
  }

  // ============================================
  // INCOME HISTORY (Permanent Movement Log)
  // ============================================

  // ============================================
  // ARCHIVOS ADJUNTOS
  // ============================================

  /**
   * Guarda el archivo en una subcoleccion propia, no dentro del documento.
   *
   * Firestore limita cada documento a 1 MiB. Manteniendo los adjuntos en
   * documentos separados, la ficha sigue siendo ligera de listar aunque
   * tenga varios archivos pesados colgando.
   */
  async guardarArchivo(userId: string, documentoId: string, archivo: any): Promise<string> {
    const ref = doc(collection(this.firestore, `users/${userId}/documentos/${documentoId}/archivos`));
    await setDoc(ref, this.limpiar({ ...archivo, id: ref.id }));
    return ref.id;
  }

  /** Metadatos de los adjuntos, sin el contenido: listar no debe descargar megas. */
  async getArchivosMeta(userId: string, documentoId: string): Promise<any[]> {
    const snap = await getDocs(collection(this.firestore, `users/${userId}/documentos/${documentoId}/archivos`));
    return snap.docs.map(d => {
      const { contenido, ...meta } = d.data() as any;
      return { ...meta, id: d.id };
    });
  }

  /** Contenido completo de un adjunto, solo cuando se va a descargar. */
  async getArchivo(userId: string, documentoId: string, archivoId: string): Promise<any | null> {
    const snap = await getDoc(doc(this.firestore, `users/${userId}/documentos/${documentoId}/archivos/${archivoId}`));
    return snap.exists() ? snap.data() : null;
  }

  async eliminarArchivo(userId: string, documentoId: string, archivoId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `users/${userId}/documentos/${documentoId}/archivos/${archivoId}`));
  }

  async agregarBitacora(userId: string, entry: any): Promise<string> {
    const docRef = doc(collection(this.firestore, `users/${userId}/bitacora`));
    await setDoc(docRef, this.limpiar({ ...entry, id: docRef.id }));
    return docRef.id;
  }

  async getBitacora(userId: string): Promise<any[]> {
    const snapshot = await getDocs(collection(this.firestore, `users/${userId}/bitacora`));
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Ordenar por fecha y hora descendente en el cliente
    return entries.sort((a: any, b: any) => {
      const dateCompare = (b.date || '').localeCompare(a.date || '');
      if (dateCompare !== 0) return dateCompare;
      return (b.time || '').localeCompare(a.time || '');
    });
  }

  async actualizarBitacora(userId: string, entryId: string, data: any): Promise<void> {
    const docRef = doc(this.firestore, `users/${userId}/bitacora/${entryId}`);
    await setDoc(docRef, data, { merge: true });
  }

  // ============================================
  // INITIAL BALANCE
  // ============================================
  
  // Get initial balance
  async getAcervoInicial(userId: string): Promise<number> {
    const docRef = doc(this.firestore, `users/${userId}/profile/data`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data['initialBalance'] || 0;
    }
    return 0;
  }

  async setAcervoInicial(userId: string, amount: number) {
    const docRef = doc(this.firestore, `users/${userId}/profile/data`);
    await setDoc(docRef, this.limpiar({ initialBalance: amount }), { merge: true });
  }

  // ============================================
  // MONTHLY INCOME CALCULATION
  // ============================================
  
  // Calculate monthly income with dates
  async calcularDocumentosPeriodo(userId: string, year: number, month: number): Promise<any> {
    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const isCurrentMonth = currentYear === year && currentMonth === month;
    
    // Get active income sources
    const sources = await this.getDocumentosActivos(userId);
    
    // Get initial balance
    const initialBalance = await this.getAcervoInicial(userId);
    
    // Get transactions for the month to calculate what's actually received
    const transactions = await this.getHistorialPorPeriodo(userId, year, month);
    const incomeTransactions = transactions.filter((t: any) => t.amount > 0);
    const totalReceived = incomeTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
    
    // Calculate expected vs received per source
    const sourceDetails = sources.map((source: any) => {
      // Find transactions from this source
      const sourceTransactions = incomeTransactions.filter((t: any) => 
        t.description?.toLowerCase().includes(source.name.toLowerCase()) ||
        t.incomeSourceId === source.id
      );
      const received = sourceTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
      
      const expectedDate = source.paymentDayOfMonth;
      const isOverdue = isCurrentMonth && expectedDate && currentDay > expectedDate && received === 0;
      const isPending = isCurrentMonth && expectedDate && currentDay < expectedDate && received === 0;
      const isReceived = received > 0;
      
      let status: 'pending' | 'partial' | 'received' | 'overdue' = 'pending';
      if (isReceived) status = received >= source.amount ? 'received' : 'partial';
      else if (isOverdue) status = 'overdue';
      else if (isPending) status = 'pending';
      
      return {
        documentoId: source.id,
        name: source.name,
        type: source.type,
        budgeted: source.amount,
        received,
        expectedDate,
        receivedDate: source.lastPaymentDate,
        status
      };
    });
    
    // Calculate totals
    const totalBudgeted = sources.reduce((sum: number, s: any) => sum + s.amount, 0);
    const totalExpected = sourceDetails.reduce((sum: number, s: any) => sum + s.budgeted, 0);
    
    // Available now = initial balance + received so far
    const availableNow = initialBalance + totalReceived;
    
    // Expected by end of month
    const expectedByEndOfMonth = initialBalance + totalBudgeted;
    
    return {
      periodoId,
      totalBudgeted,
      totalExpected,
      totalReceived,
      totalPending: totalExpected - totalReceived,
      initialBalance,
      availableNow,
      expectedByEndOfMonth,
      sources: sourceDetails,
      lastUpdated: new Date().toISOString()
    };
  }

  // ============================================
  // EXPENSES (NEW - Sistema Dual)
  // ============================================

  // Get all expenses for user
  async getSolicitudes(userId: string): Promise<any[]> {
    const q = query(
      collection(this.firestore, `users/${userId}/solicitudes`),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Get active expenses
  async getSolicitudesActivas(userId: string): Promise<any[]> {
    const q = query(
      collection(this.firestore, `users/${userId}/solicitudes`),
      where('activo', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Get expenses by month
  async getSolicitudesPorPeriodo(userId: string, year: number, month: number): Promise<any[]> {
    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    const q = query(
      collection(this.firestore, `users/${userId}/periodos/${periodoId}/solicitudes`),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Create expense
  async crearSolicitud(userId: string, data: any): Promise<any> {
    const docRef = doc(collection(this.firestore, `users/${userId}/solicitudes`));
    const now = new Date().toISOString();
    const expenseData = {
      ...data,
      id: docRef.id,
      userId,
      activo: true,
      actualAmount: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, expenseData);
    return expenseData;
  }

  // Update expense
  async actualizarSolicitud(userId: string, solicitudId: string, data: any) {
    const docRef = doc(this.firestore, `users/${userId}/solicitudes/${solicitudId}`);
    await setDoc(docRef, this.limpiar({ ...data, updatedAt: new Date().toISOString() }), { merge: true });
  }

  // Mark expense as paid
  async marcarSolicitudAtendida(userId: string, solicitudId: string, paidAmount: number, fechaAtencion?: string) {
    const docRef = doc(this.firestore, `users/${userId}/solicitudes/${solicitudId}`);
    await setDoc(docRef, this.limpiar({
      actualAmount: paidAmount,
      fechaAtencion: fechaAtencion || new Date().toISOString(),
      status: 'paid',
      updatedAt: new Date().toISOString()
    }), { merge: true });
  }

  // Cancel/deactivate expense
  async anularSolicitud(userId: string, solicitudId: string) {
    const docRef = doc(this.firestore, `users/${userId}/solicitudes/${solicitudId}`);
    await setDoc(docRef, this.limpiar({
      status: 'cancelled',
      isRecurring: false,
      activo: false,
      updatedAt: new Date().toISOString()
    }), { merge: true });
  }

  // Calculate monthly expense summary
  async calcularSolicitudesPeriodo(userId: string, year: number, month: number): Promise<any> {
    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    const today = new Date();
    const currentDay = today.getDate();
    
    // Get all active expenses
    const allExpenses = await this.getSolicitudesActivas(userId);
    
    // Separate primordial and non-primordial
    const primordial = allExpenses.filter((e: any) => e.esPrioritaria);
    const nonPrimordial = allExpenses.filter((e: any) => !e.esPrioritaria);
    
    // Calculate totals
    const totalBudgeted = allExpenses.reduce((sum: number, e: any) => sum + (e.budgetedAmount || 0), 0);
    const totalActual = allExpenses.reduce((sum: number, e: any) => sum + (e.actualAmount || 0), 0);
    
    const primordialBudgeted = primordial.reduce((sum: number, e: any) => sum + (e.budgetedAmount || 0), 0);
    const primordialActual = primordial.reduce((sum: number, e: any) => sum + (e.actualAmount || 0), 0);
    
    const nonPrimordialBudgeted = nonPrimordial.reduce((sum: number, e: any) => sum + (e.budgetedAmount || 0), 0);
    const nonPrimordialActual = nonPrimordial.reduce((sum: number, e: any) => sum + (e.actualAmount || 0), 0);
    
    // Get upcoming payments (next 7 days)
    const upcomingPayments = allExpenses
      .filter((e: any) => e.diaLimiteMes && e.status !== 'paid' && e.status !== 'cancelled')
      .map((e: any) => ({
        solicitudId: e.id,
        name: e.name,
        amount: e.budgetedAmount,
        fechaLimite: e.diaLimiteMes,
        isOverdue: currentDay > e.diaLimiteMes
      }))
      .sort((a: any, b: any) => a.fechaLimite - b.fechaLimite);
    
    // Check for alerts
    const alerts: any[] = [];
    allExpenses.forEach((e: any) => {
      // Overdue
      if (e.status === 'overdue') {
        alerts.push({
          type: 'overdue',
          solicitudId: e.id,
          message: `${e.name} está vencido (Día ${e.diaLimiteMes})`
        });
      }
      // CuotaAlmacenamiento exceeded
      if (e.actualAmount > e.budgetedAmount) {
        alerts.push({
          type: 'budget_exceeded',
          solicitudId: e.id,
          message: `${e.name} excedió el cuota: ${e.actualAmount} vs ${e.budgetedAmount}`
        });
      }
      // Price change (subscription)
      if (e.esReincidente && e.prioridadAnterior && e.prioridadSolicitud !== e.prioridadAnterior) {
        alerts.push({
          type: 'price_change',
          solicitudId: e.id,
          message: `${e.name} cambió de precio: ${e.prioridadAnterior} → ${e.prioridadSolicitud}`
        });
      }
      // Variable spike
      if (e.isVariable && e.umbralAlerta && e.budgetedAmount && e.actualAmount) {
        const limit = e.budgetedAmount * (1 + e.umbralAlerta / 100);
        if (e.actualAmount > limit) {
          alerts.push({
            type: 'variable_spike',
            solicitudId: e.id,
            message: `${e.name}: ${e.actualAmount} supera umbral de ${limit.toFixed(2)} (${e.umbralAlerta}%)`
          });
        }
      }
    });
    
    // By category breakdown
    const byCategory = allExpenses.map((e: any) => ({
      category: e.category,
      name: e.name,
      budgeted: e.budgetedAmount,
      actual: e.actualAmount,
      status: e.status
    }));
    
    return {
      periodoId,
      totalBudgeted,
      totalActual,
      primordialBudgeted,
      primordialActual,
      primordialCount: primordial.length,
      nonPrimordialBudgeted,
      nonPrimordialActual,
      nonPrimordialCount: nonPrimordial.length,
      byCategory,
      upcomingPayments: upcomingPayments.slice(0, 5),
      alerts,
      lastUpdated: new Date().toISOString()
    };
  }

  // ============================================
  // BUDGETS (Cuota por Categoría)
  // ============================================
  
  // Get budgets for a month
  async getCuotasPorPeriodo(userId: string, year: number, month: number): Promise<any[]> {
    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    const q = query(
      collection(this.firestore, `users/${userId}/periodos/${periodoId}/almacenamiento`),
      orderBy('esPrioritaria'),
      orderBy('budgetedAmount', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Create or update budget for a category
  async definirCuota(userId: string, data: any): Promise<any> {
    const periodoId = data.periodoId;
    const docRef = doc(this.firestore, `users/${userId}/periodos/${periodoId}/almacenamiento/${data.category}`);
    const now = new Date().toISOString();
    
    const budgetData = {
      ...data,
      actualAmount: 0,
      disponibleMb: data.budgetedAmount,
      porcentajeUso: 0,
      status: 'on_track',
      history: [],
      createdAt: now,
      updatedAt: now
    };
    
    await setDoc(docRef, budgetData, { merge: true });
    return budgetData;
  }

  // Update actual spent for a budget
  async actualizarConsumoCuota(userId: string, category: string, periodoId: string, actualAmount: number) {
    const docRef = doc(this.firestore, `users/${userId}/periodos/${periodoId}/almacenamiento/${category}`);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return;
    
    const budget: any = docSnap.data();
    const porcentajeUso = Math.round((actualAmount / budget['budgetedAmount']) * 100);
    const disponibleMb = Math.max(0, budget['budgetedAmount'] - actualAmount);
    
    let status = 'on_track';
    if (porcentajeUso >= 100) status = 'exceeded';
    else if (porcentajeUso >= (budget['umbralAlerta'] || 80)) status = 'at_risk';
    else if (porcentajeUso === 0) status = 'unused';
    
    // Add to history
    const history = budget.history || [];
    history.push({
      date: new Date().toISOString(),
      actualAmount,
      percentage: porcentajeUso
    });
    
    await setDoc(docRef, this.limpiar({
      actualAmount,
      disponibleMb,
      porcentajeUso,
      status,
      history,
      updatedAt: new Date().toISOString()
    }), { merge: true });
  }

  // Calculate monthly budget summary with actuals
  async calcularResumenAlmacenamiento(userId: string, year: number, month: number): Promise<any> {
    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    
    // Get budgets for the month
    let budgets = await this.getCuotasPorPeriodo(userId, year, month);
    
    // If no budgets exist, create empty summary
    if (!budgets || budgets.length === 0) {
      return {
        periodoId,
        totalBudgeted: 0,
        totalActual: 0,
        totalRemaining: 0,
        overallPercentage: 0,
        overallStatus: 'unused',
        primordialBudgeted: 0,
        primordialActual: 0,
        nonPrimordialBudgeted: 0,
        nonPrimordialActual: 0,
        budgets: [],
        alerts: [],
        lastUpdated: new Date().toISOString()
      };
    }
    
    // Get actual expenses from transactions
    const transactions = await this.getHistorialPorPeriodo(userId, year, month);
    const expenses = transactions.filter((t: any) => t.amount < 0);
    
    // Group expenses by category and update budgets
    const expenseByCategory: Record<string, number> = {};
    expenses.forEach((t: any) => {
      const cat = t.category || 'other';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Math.abs(t.amount);
    });
    
    // Update each budget with actual amount
    const updatedBudgets = budgets.map((b: any) => {
      const actual = expenseByCategory[b.category] || 0;
      const porcentajeUso = b.budgetedAmount > 0 ? Math.round((actual / b.budgetedAmount) * 100) : 0;
      const disponibleMb = Math.max(0, b.budgetedAmount - actual);
      
      let status: 'on_track' | 'at_risk' | 'exceeded' | 'unused' = 'on_track';
      if (porcentajeUso >= 100) status = 'exceeded';
      else if (porcentajeUso >= (b.umbralAlerta || 80)) status = 'at_risk';
      else if (porcentajeUso === 0) status = 'unused';
      
      return { ...b, actualAmount: actual, disponibleMb, porcentajeUso, status };
    });
    
    // Calculate totals
    const totalBudgeted = updatedBudgets.reduce((sum: number, b: any) => sum + b.budgetedAmount, 0);
    const totalActual = updatedBudgets.reduce((sum: number, b: any) => sum + b.actualAmount, 0);
    
    const primordial = updatedBudgets.filter((b: any) => b.esPrioritaria);
    const nonPrimordial = updatedBudgets.filter((b: any) => !b.esPrioritaria);
    
    const primordialBudgeted = primordial.reduce((sum: number, b: any) => sum + b.budgetedAmount, 0);
    const primordialActual = primordial.reduce((sum: number, b: any) => sum + b.actualAmount, 0);
    const nonPrimordialBudgeted = nonPrimordial.reduce((sum: number, b: any) => sum + b.budgetedAmount, 0);
    const nonPrimordialActual = nonPrimordial.reduce((sum: number, b: any) => sum + b.actualAmount, 0);
    
    // Generate alerts
    const alerts = updatedBudgets
      .filter((b: any) => b.status === 'at_risk' || b.status === 'exceeded')
      .map((b: any) => ({
        category: b.category,
        name: b.categoryName,
        budgeted: b.budgetedAmount,
        actual: b.actualAmount,
        percentage: b.porcentajeUso,
        status: b.status
      }));
    
    const overallPercentage = totalBudgeted > 0 ? Math.round((totalActual / totalBudgeted) * 100) : 0;
    let overallStatus: 'on_track' | 'at_risk' | 'exceeded' | 'unused' = 'on_track';
    if (overallPercentage >= 100) overallStatus = 'exceeded';
    else if (overallPercentage >= 80) overallStatus = 'at_risk';
    else if (overallPercentage === 0) overallStatus = 'unused';
    
    return {
      periodoId,
      totalBudgeted,
      totalActual,
      totalRemaining: Math.max(0, totalBudgeted - totalActual),
      overallPercentage,
      overallStatus,
      primordialBudgeted,
      primordialActual,
      nonPrimordialBudgeted,
      nonPrimordialActual,
      budgets: updatedBudgets,
      alerts,
      lastUpdated: new Date().toISOString()
    };
  }

  // ============================================
  // SURPLUS & NOTIFICATIONS
  // ============================================
  async guardarRegistroCuota(userId: string, id: string, data: any) {
    const docRef = doc(this.firestore, `users/${userId}/cuotas/${id}`);
    return setDoc(docRef, data, { merge: true });
  }

  async getRegistroCuota(userId: string, id: string): Promise<any> {
    const docRef = doc(this.firestore, `users/${userId}/cuotas/${id}`);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }

  async getSurplusHistory(userId: string): Promise<any[]> {
    const colRef = collection(this.firestore, `users/${userId}/cuotas`);
    const q = query(colRef, orderBy('calculatedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async saveNotification(userId: string, notification: any) {
    const id = `${notification.year}-${String(notification.month).padStart(2, '0')}-${Date.now()}`;
    const docRef = doc(this.firestore, `users/${userId}/notifications/${id}`);
    return setDoc(docRef, notification, { merge: true });
  }

  async getNotifications(userId: string, unreadOnly: boolean = false): Promise<any[]> {
    const colRef = collection(this.firestore, `users/${userId}/notifications`);
    let q = query(colRef, orderBy('createdAt', 'desc'), limit(20));
    
    if (unreadOnly) {
      q = query(colRef, where('isRead', '==', false), orderBy('createdAt', 'desc'), limit(20));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async markNotificationAsRead(userId: string, notificationId: string) {
    const docRef = doc(this.firestore, `users/${userId}/notifications/${notificationId}`);
    return setDoc(docRef, this.limpiar({ isRead: true }), { merge: true });
  }

  // ============================================
  // MIGRATION HELPERS
  // ============================================

  async checkLegacyTransactions(userId: string): Promise<{ count: number }> {
    try {
      const q = query(
        collection(this.firestore, `users/${userId}/historial`),
        limit(1)
      );
      const snapshot = await getDocs(q);
      return { count: snapshot.size };
    } catch {
      return { count: 0 };
    }
  }

  async getLegacyTransactions(userId: string): Promise<any[]> {
    try {
      const q = query(
        collection(this.firestore, `users/${userId}/historial`),
        orderBy('date', 'desc'),
        limit(500)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch {
      return [];
    }
  }

  async checkLegacyGoal(userId: string): Promise<{ exists: boolean }> {
    try {
      const docRef = doc(this.firestore, `users/${userId}/flujos/data`);
      const docSnap = await getDoc(docRef);
      return { exists: docSnap.exists() };
    } catch {
      return { exists: false };
    }
  }

  async getLegacyGoal(userId: string): Promise<any | null> {
    try {
      const docRef = doc(this.firestore, `users/${userId}/flujos/data`);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch {
      return null;
    }
  }

  async checkLegacyCategories(userId: string): Promise<{ count: number }> {
    try {
      const q = query(
        collection(this.firestore, `users/${userId}/categories`),
        limit(1)
      );
      const snapshot = await getDocs(q);
      return { count: snapshot.size };
    } catch {
      return { count: 0 };
    }
  }

  async markAsMigrated(userId: string, type: 'transactions' | 'goals') {
    const docRef = doc(this.firestore, `users/${userId}/migration/status`);
    await setDoc(docRef, this.limpiar({
      [type]: true,
      [`${type}MigratedAt`]: new Date().toISOString()
    }), { merge: true });
  }

  async checkMigrationStatus(userId: string): Promise<boolean> {
    try {
      const docRef = doc(this.firestore, `users/${userId}/migration/status`);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return false;
      const data = docSnap.data();
      return data['transactions'] === true && data['goals'] === true;
    } catch {
      return false;
    }
  }
}