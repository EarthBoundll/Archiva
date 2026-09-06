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
    return setDoc(docRef, this.limpiar(data), { merge: true });
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
    return setDoc(docRef, this.limpiar(data), { merge: true });
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


  // Get all months for user

  // ============================================
  // BITACORA — FUENTE UNICA
  // ============================================
  //
  // Habia dos colecciones divergentes: los asientos se escribian en
  // `users/{uid}/bitacora` y una de las lecturas consultaba
  // `users/{uid}/periodos/{id}/historial`, que nada escribia. El contador de
  // movimientos del detalle de flujo marcaba cero siempre.
  //
  // Ahora todo entra y sale de `users/{uid}/bitacora`. El periodo se filtra
  // por el prefijo de la fecha, que ya viene en formato ISO.

  /** Asientos de un mes concreto. */
  async getHistorialPorPeriodo(userId: string, year: number, month: number) {
    const prefijo = `${year}-${String(month).padStart(2, '0')}`;
    const todos = await this.getBitacora(userId);
    return todos.filter((r: any) => String(r.date ?? '').startsWith(prefijo));
  }

  /** Alta de asiento. Se conserva el nombre por compatibilidad. */
  async crearRegistro(userId: string, data: any): Promise<any> {
    const id = await this.agregarBitacora(userId, {
      ...data,
      createdAt: data.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return { ...data, id };
  }

  async actualizarRegistro(userId: string, registroId: string, data: any): Promise<void> {
    await this.actualizarBitacora(userId, registroId, data);
  }

  /**
   * La bitacora es evidencia ante una auditoria: no se borra, se marca.
   * Un asiento retirado deja de contar en los agregados pero sigue ahi.
   */
  async eliminarRegistro(userId: string, registroId: string): Promise<void> {
    await this.actualizarBitacora(userId, registroId, {
      anulado: true,
      anuladoEl: new Date().toISOString()
    });
  }

  /**
   * Traslada a la bitacora los asientos que quedaron en la estructura por
   * periodos, sin duplicar los que ya estan. Devuelve cuantos movio.
   *
   * Se ejecuta una sola vez por usuario: deja constancia en el perfil para
   * no recorrer las subcolecciones en cada arranque.
   */
  async migrarHistorialAntiguo(userId: string): Promise<number> {
    const perfil = await this.getUserProfileComplete(userId);
    if (perfil?.['bitacoraUnificada']) return 0;

    const periodos = await getDocs(collection(this.firestore, `users/${userId}/periodos`));
    const yaEnBitacora = new Set(
      (await this.getBitacora(userId)).map((r: any) => this.huella(r))
    );

    let movidos = 0;
    for (const periodo of periodos.docs) {
      const asientos = await getDocs(
        collection(this.firestore, `users/${userId}/periodos/${periodo.id}/historial`)
      );

      for (const asiento of asientos.docs) {
        const datos = asiento.data() as any;
        // Los registros del producto anterior llevaban importe y no accion.
        if (!datos['accion']) continue;
        if (yaEnBitacora.has(this.huella(datos))) continue;

        await this.agregarBitacora(userId, { ...datos, migradoDe: periodo.id });
        yaEnBitacora.add(this.huella(datos));
        movidos++;
      }
    }

    await this.saveUserProfile(userId, {
      bitacoraUnificada: true,
      bitacoraUnificadaEl: new Date().toISOString(),
      bitacoraAsientosMigrados: movidos
    });

    return movidos;
  }

  /** Identidad de un asiento, para no duplicarlo al migrar. */
  private huella(r: any): string {
    return [r.documentoId ?? '', r.accion ?? '', r.date ?? '', r.time ?? '', r.titulo ?? '']
      .join('|');
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
    await setDoc(docRef, this.limpiar(goalData));
    return goalData;
  }

  // Update goal
  async actualizarFlujo(userId: string, flujoId: string, data: any) {
    const docRef = doc(this.firestore, `users/${userId}/flujos/${flujoId}`);
    await setDoc(docRef, this.limpiar({ ...data, updatedAt: new Date().toISOString() }), { merge: true });
  }

  /**
   * Registra el resultado de una etapa y ajusta el estado del flujo.
   *
   * Solo una etapa aprobada hace avanzar el contador. Observarla lo deja
   * donde estaba —el documento vuelve a quien lo presento y la misma etapa
   * sigue pendiente— y rechazarla suspende el flujo: la negativa firme de
   * un aprobador no puede quedar como un tramite mas.
   */
  async resolverEtapa(userId: string, flujoId: string, etapa: any) {
    const flujo: any = await this.getFlujoPorId(userId, flujoId);
    if (!flujo) throw new Error('El flujo ya no existe.');

    const registro = {
      id: `${Date.now()}-${etapa.orden}`,
      orden: etapa.orden,
      nombre: etapa.nombre,
      aprobador: etapa.aprobador,
      resultado: etapa.resultado,
      observacion: etapa.observacion,
      date: new Date().toISOString()
    };

    const avanza = etapa.resultado === 'aprobada';
    const completadas = (flujo.etapasCompletadas || 0) + (avanza ? 1 : 0);
    const totales = flujo.etapasTotales || 0;
    const estaCompletado = completadas >= totales;

    let status = flujo.status ?? 'active';
    if (etapa.resultado === 'rechazada') status = 'paused';
    else if (estaCompletado)             status = 'completed';
    else                                 status = 'active';

    const docRef = doc(this.firestore, `users/${userId}/flujos/${flujoId}`);
    await setDoc(docRef, this.limpiar({
      etapasCompletadas: completadas,
      estaCompletado,
      status,
      etapas: [...(flujo.etapas || []), registro],
      updatedAt: new Date().toISOString()
    }), { merge: true });
  }

  /**
   * Retira el flujo del seguimiento sin borrarlo del expediente: en un
   * sistema documental nada desaparece, se anula y sigue consultable.
   */
  async anularFlujo(userId: string, flujoId: string, motivo?: string) {
    const docRef = doc(this.firestore, `users/${userId}/flujos/${flujoId}`);
    await setDoc(docRef, this.limpiar({
      status: 'cancelled',
      motivoAnulacion: motivo,
      updatedAt: new Date().toISOString()
    }), { merge: true });
  }

  // ============================================
  // DOCUMENTOS
  // ============================================
  
  // Todos los documentos del usuario
  async getDocumentos(userId: string) {
    const q = query(
      collection(this.firestore, `users/${userId}/documentos`),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Documentos activos
  async getDocumentosActivos(userId: string) {
    const q = query(
      collection(this.firestore, `users/${userId}/documentos`),
      where('activo', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Alta de documento
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
    await setDoc(docRef, this.limpiar(sourceData));
    return sourceData;
  }

  // Actualizacion de documento
  async actualizarDocumento(userId: string, documentoId: string, data: any) {
    const docRef = doc(this.firestore, `users/${userId}/documentos/${documentoId}`);
    await setDoc(docRef, this.limpiar({ ...data, updatedAt: new Date().toISOString() }), { merge: true });
  }

  // Baja logica del documento
  async archivarDocumento(userId: string, documentoId: string) {
    const docRef = doc(this.firestore, `users/${userId}/documentos/${documentoId}`);
    await setDoc(docRef, this.limpiar({ activo: false, updatedAt: new Date().toISOString() }));
  }

  // Deja constancia de la aprobacion
  async registrarVersionDocumento(userId: string, documentoId: string, amount: number, receivedDate: string) {
    const docRef = doc(this.firestore, `users/${userId}/documentos/${documentoId}`);
    await setDoc(docRef, this.limpiar({ 
      actualAmount: amount,
      lastPaymentDate: receivedDate,
      updatedAt: new Date().toISOString()
    }), { merge: true });
  }

  // ============================================
  // BITACORA (registro permanente de movimientos)
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
    await setDoc(docRef, this.limpiar(data), { merge: true });
  }

  // ============================================
  // SOLICITUDES DE REVISION (sistema dual)
  // ============================================

  // Todas las solicitudes del usuario
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

  // Alta de solicitud
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
    await setDoc(docRef, this.limpiar(expenseData));
    return expenseData;
  }

  // Actualizacion de solicitud
  async actualizarSolicitud(userId: string, solicitudId: string, data: any) {
    const docRef = doc(this.firestore, `users/${userId}/solicitudes/${solicitudId}`);
    await setDoc(docRef, this.limpiar({ ...data, updatedAt: new Date().toISOString() }), { merge: true });
  }

  // Marca la solicitud como atendida
  async marcarSolicitudAtendida(userId: string, solicitudId: string, paidAmount: number, fechaAtencion?: string) {
    const docRef = doc(this.firestore, `users/${userId}/solicitudes/${solicitudId}`);
    await setDoc(docRef, this.limpiar({
      actualAmount: paidAmount,
      fechaAtencion: fechaAtencion || new Date().toISOString(),
      status: 'paid',
      updatedAt: new Date().toISOString()
    }), { merge: true });
  }

  // Anula la solicitud
  async anularSolicitud(userId: string, solicitudId: string) {
    const docRef = doc(this.firestore, `users/${userId}/solicitudes/${solicitudId}`);
    await setDoc(docRef, this.limpiar({
      status: 'cancelled',
      isRecurring: false,
      activo: false,
      updatedAt: new Date().toISOString()
    }), { merge: true });
  }

  // ============================================
  // CUOTAS DE ALMACENAMIENTO (por categoria documental)
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
    
    await setDoc(docRef, this.limpiar(budgetData), { merge: true });
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
    return setDoc(docRef, this.limpiar(data), { merge: true });
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
    return setDoc(docRef, this.limpiar(notification), { merge: true });
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
}