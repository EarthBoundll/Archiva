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
  // ============================================
  // PERFIL GLOBAL DEL USUARIO
  // ============================================
  //
  // Vive fuera de la empresa: es el documento que dice a que empresa
  // pertenece quien inicia sesion, y hay que poder leerlo antes de saber
  // cual es esa empresa.

  async getPerfilGlobal(uid: string) {
    const snap = await getDoc(doc(this.firestore, `usuarios/${uid}`));
    return snap.exists() ? snap.data() : null;
  }

  async guardarPerfilGlobal(uid: string, data: any) {
    return setDoc(doc(this.firestore, `usuarios/${uid}`), this.limpiar(data), { merge: true });
  }

  // ============================================
  // USER PROFILE (NEW - Onboarding)
  // ============================================
  // ============================================
  // EMPRESA
  // ============================================

  async getEmpresa(empresaId: string): Promise<any | null> {
    const snap = await getDoc(doc(this.firestore, `empresas/${empresaId}`));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async guardarEmpresa(empresaId: string, data: any) {
    return setDoc(doc(this.firestore, `empresas/${empresaId}`), this.limpiar(data), { merge: true });
  }

  async crearEmpresa(data: any): Promise<string> {
    const ref = doc(collection(this.firestore, 'empresas'));
    await setDoc(ref, this.limpiar({ ...data, id: ref.id }));
    return ref.id;
  }

  /** Compatibilidad con el nombre anterior del perfil de empresa. */
  async getUserProfileComplete(empresaId: string): Promise<any | null> {
    return this.getEmpresa(empresaId);
  }

  async saveUserProfile(empresaId: string, data: any) {
    return this.guardarEmpresa(empresaId, data);
  }

  // ============================================
  // MIEMBROS
  // ============================================

  async getMiembro(empresaId: string, uid: string): Promise<any | null> {
    const snap = await getDoc(doc(this.firestore, `empresas/${empresaId}/miembros/${uid}`));
    return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
  }

  async getMiembros(empresaId: string): Promise<any[]> {
    const snap = await getDocs(collection(this.firestore, `empresas/${empresaId}/miembros`));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  }

  async guardarMiembro(empresaId: string, uid: string, data: any) {
    return setDoc(
      doc(this.firestore, `empresas/${empresaId}/miembros/${uid}`),
      this.limpiar({ ...data, uid, empresaId }),
      { merge: true }
    );
  }

  /** Deja constancia del ultimo acceso, sin bloquear el arranque. */
  async marcarAcceso(empresaId: string, uid: string) {
    return setDoc(
      doc(this.firestore, `empresas/${empresaId}/miembros/${uid}`),
      this.limpiar({ ultimoAcceso: new Date().toISOString() }),
      { merge: true }
    );
  }

  // ============================================
  // INVITACIONES
  // ============================================
  //
  // El indice por testigo vive fuera de la empresa: quien acepta una
  // invitacion todavia no pertenece a ninguna, asi que no podria leer nada
  // que colgara de ella.

  async crearInvitacion(empresaId: string, data: any): Promise<string> {
    const ref = doc(collection(this.firestore, `empresas/${empresaId}/invitaciones`));
    await setDoc(ref, this.limpiar({ ...data, id: ref.id, empresaId }));

    await setDoc(doc(this.firestore, `invitaciones/${data.token}`), this.limpiar({
      token: data.token,
      empresaId,
      invitacionId: ref.id,
      email: data.email,
      estado: 'pendiente',
      fechaExpira: data.fechaExpira
    }));

    return ref.id;
  }

  async getInvitaciones(empresaId: string): Promise<any[]> {
    const snap = await getDocs(collection(this.firestore, `empresas/${empresaId}/invitaciones`));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.fechaEnvio ?? '').localeCompare(a.fechaEnvio ?? ''));
  }

  /** Busca por testigo, sin conocer la empresa. */
  async getInvitacionPorToken(token: string): Promise<any | null> {
    const indice = await getDoc(doc(this.firestore, `invitaciones/${token}`));
    if (!indice.exists()) return null;

    const datos = indice.data() as any;
    const snap = await getDoc(
      doc(this.firestore, `empresas/${datos.empresaId}/invitaciones/${datos.invitacionId}`)
    );
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async actualizarInvitacion(empresaId: string, invitacionId: string, token: string, data: any) {
    await setDoc(
      doc(this.firestore, `empresas/${empresaId}/invitaciones/${invitacionId}`),
      this.limpiar(data), { merge: true }
    );
    if (data.estado) {
      await setDoc(doc(this.firestore, `invitaciones/${token}`),
        this.limpiar({ estado: data.estado }), { merge: true });
    }
  }

  // ============================================
  // TAREAS DE APROBACION
  // ============================================

  async crearTarea(empresaId: string, data: any): Promise<any> {
    const ref = doc(collection(this.firestore, `empresas/${empresaId}/tareas`));
    const tarea = { ...data, id: ref.id, empresaId };
    await setDoc(ref, this.limpiar(tarea));
    return tarea;
  }

  async getTareas(empresaId: string): Promise<any[]> {
    const snap = await getDocs(collection(this.firestore, `empresas/${empresaId}/tareas`));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  /** Bandeja de una persona: lo asignado a ella. */
  async getTareasDe(empresaId: string, uid: string): Promise<any[]> {
    const q = query(
      collection(this.firestore, `empresas/${empresaId}/tareas`),
      where('asignadoUid', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async getTareasDeFlujo(empresaId: string, flujoId: string): Promise<any[]> {
    const q = query(
      collection(this.firestore, `empresas/${empresaId}/tareas`),
      where('flujoId', '==', flujoId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async actualizarTarea(empresaId: string, tareaId: string, data: any) {
    return setDoc(
      doc(this.firestore, `empresas/${empresaId}/tareas/${tareaId}`),
      this.limpiar(data), { merge: true }
    );
  }

  // ============================================
  // AUDITORIA
  // ============================================
  //
  // Solo se anade. No hay metodo de edicion ni de borrado a proposito: es
  // la evidencia que se presenta ante una auditoria.

  async registrarAuditoria(empresaId: string, asiento: any): Promise<void> {
    const ref = doc(collection(this.firestore, `empresas/${empresaId}/auditoria`));
    await setDoc(ref, this.limpiar({ ...asiento, id: ref.id, empresaId }));
  }

  async getAuditoria(empresaId: string, limite = 300): Promise<any[]> {
    const q = query(
      collection(this.firestore, `empresas/${empresaId}/auditoria`),
      orderBy('timestamp', 'desc'),
      limit(limite)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  async getHistorialPorPeriodo(empresaId: string, year: number, month: number) {
    const prefijo = `${year}-${String(month).padStart(2, '0')}`;
    const todos = await this.getBitacora(empresaId);
    return todos.filter((r: any) => String(r.date ?? '').startsWith(prefijo));
  }

  /** Alta de asiento. Se conserva el nombre por compatibilidad. */
  async crearRegistro(empresaId: string, data: any): Promise<any> {
    const id = await this.agregarBitacora(empresaId, {
      ...data,
      createdAt: data.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return { ...data, id };
  }

  async actualizarRegistro(empresaId: string, registroId: string, data: any): Promise<void> {
    await this.actualizarBitacora(empresaId, registroId, data);
  }

  /**
   * La bitacora es evidencia ante una auditoria: no se borra, se marca.
   * Un asiento retirado deja de contar en los agregados pero sigue ahi.
   */
  async eliminarRegistro(empresaId: string, registroId: string): Promise<void> {
    await this.actualizarBitacora(empresaId, registroId, {
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
  async migrarHistorialAntiguo(empresaId: string): Promise<number> {
    const perfil = await this.getUserProfileComplete(empresaId);
    if (perfil?.['bitacoraUnificada']) return 0;

    const periodos = await getDocs(collection(this.firestore, `empresas/${empresaId}/periodos`));
    const yaEnBitacora = new Set(
      (await this.getBitacora(empresaId)).map((r: any) => this.huella(r))
    );

    let movidos = 0;
    for (const periodo of periodos.docs) {
      const asientos = await getDocs(
        collection(this.firestore, `empresas/${empresaId}/periodos/${periodo.id}/historial`)
      );

      for (const asiento of asientos.docs) {
        const datos = asiento.data() as any;
        // Los registros del producto anterior llevaban importe y no accion.
        if (!datos['accion']) continue;
        if (yaEnBitacora.has(this.huella(datos))) continue;

        await this.agregarBitacora(empresaId, { ...datos, migradoDe: periodo.id });
        yaEnBitacora.add(this.huella(datos));
        movidos++;
      }
    }

    await this.saveUserProfile(empresaId, {
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
  async getFlujos(empresaId: string) {
    const q = query(
      collection(this.firestore, `empresas/${empresaId}/flujos`),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Get all goals including completed/paused/cancelled
  async getTodosLosFlujos(empresaId: string) {
    const q = query(
      collection(this.firestore, `empresas/${empresaId}/flujos`)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Get single goal
  async getFlujoPorId(empresaId: string, flujoId: string): Promise<any> {
    const docRef = doc(this.firestore, `empresas/${empresaId}/flujos/${flujoId}`);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  // Create goal
  async crearFlujo(empresaId: string, data: any): Promise<any> {
    const docRef = doc(collection(this.firestore, `empresas/${empresaId}/flujos`));
    const now = new Date().toISOString();
    const goalData = {
      ...data,
      id: docRef.id,
      empresaId,
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
  async actualizarFlujo(empresaId: string, flujoId: string, data: any) {
    const docRef = doc(this.firestore, `empresas/${empresaId}/flujos/${flujoId}`);
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
  async resolverEtapa(empresaId: string, flujoId: string, etapa: any) {
    const flujo: any = await this.getFlujoPorId(empresaId, flujoId);
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

    const docRef = doc(this.firestore, `empresas/${empresaId}/flujos/${flujoId}`);
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
  async anularFlujo(empresaId: string, flujoId: string, motivo?: string) {
    const docRef = doc(this.firestore, `empresas/${empresaId}/flujos/${flujoId}`);
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
  async getDocumentos(empresaId: string) {
    const q = query(
      collection(this.firestore, `empresas/${empresaId}/documentos`),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Documentos activos
  async getDocumentosActivos(empresaId: string) {
    const q = query(
      collection(this.firestore, `empresas/${empresaId}/documentos`),
      where('activo', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Alta de documento
  async crearDocumento(empresaId: string, data: any): Promise<any> {
    const docRef = doc(collection(this.firestore, `empresas/${empresaId}/documentos`));
    const now = new Date().toISOString();
    const sourceData = {
      ...data,
      id: docRef.id,
      empresaId,
      activo: true,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, this.limpiar(sourceData));
    return sourceData;
  }

  // Actualizacion de documento
  async actualizarDocumento(empresaId: string, documentoId: string, data: any) {
    const docRef = doc(this.firestore, `empresas/${empresaId}/documentos/${documentoId}`);
    await setDoc(docRef, this.limpiar({ ...data, updatedAt: new Date().toISOString() }), { merge: true });
  }

  // Baja logica del documento
  async archivarDocumento(empresaId: string, documentoId: string) {
    const docRef = doc(this.firestore, `empresas/${empresaId}/documentos/${documentoId}`);
    await setDoc(docRef, this.limpiar({ activo: false, updatedAt: new Date().toISOString() }));
  }

  // Deja constancia de la aprobacion
  async registrarVersionDocumento(empresaId: string, documentoId: string, amount: number, receivedDate: string) {
    const docRef = doc(this.firestore, `empresas/${empresaId}/documentos/${documentoId}`);
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
  async guardarArchivo(empresaId: string, documentoId: string, archivo: any): Promise<string> {
    const ref = doc(collection(this.firestore, `empresas/${empresaId}/documentos/${documentoId}/archivos`));
    await setDoc(ref, this.limpiar({ ...archivo, id: ref.id }));
    return ref.id;
  }

  /** Metadatos de los adjuntos, sin el contenido: listar no debe descargar megas. */
  async getArchivosMeta(empresaId: string, documentoId: string): Promise<any[]> {
    const snap = await getDocs(collection(this.firestore, `empresas/${empresaId}/documentos/${documentoId}/archivos`));
    return snap.docs.map(d => {
      const { contenido, ...meta } = d.data() as any;
      return { ...meta, id: d.id };
    });
  }

  /** Contenido completo de un adjunto, solo cuando se va a descargar. */
  async getArchivo(empresaId: string, documentoId: string, archivoId: string): Promise<any | null> {
    const snap = await getDoc(doc(this.firestore, `empresas/${empresaId}/documentos/${documentoId}/archivos/${archivoId}`));
    return snap.exists() ? snap.data() : null;
  }

  async eliminarArchivo(empresaId: string, documentoId: string, archivoId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `empresas/${empresaId}/documentos/${documentoId}/archivos/${archivoId}`));
  }

  async agregarBitacora(empresaId: string, entry: any): Promise<string> {
    const docRef = doc(collection(this.firestore, `empresas/${empresaId}/bitacora`));
    await setDoc(docRef, this.limpiar({ ...entry, id: docRef.id }));
    return docRef.id;
  }

  async getBitacora(empresaId: string): Promise<any[]> {
    const snapshot = await getDocs(collection(this.firestore, `empresas/${empresaId}/bitacora`));
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Ordenar por fecha y hora descendente en el cliente
    return entries.sort((a: any, b: any) => {
      const dateCompare = (b.date || '').localeCompare(a.date || '');
      if (dateCompare !== 0) return dateCompare;
      return (b.time || '').localeCompare(a.time || '');
    });
  }

  async actualizarBitacora(empresaId: string, entryId: string, data: any): Promise<void> {
    const docRef = doc(this.firestore, `empresas/${empresaId}/bitacora/${entryId}`);
    await setDoc(docRef, this.limpiar(data), { merge: true });
  }

  // ============================================
  // SOLICITUDES DE REVISION (sistema dual)
  // ============================================

  // Todas las solicitudes del usuario
  async getSolicitudes(empresaId: string): Promise<any[]> {
    const q = query(
      collection(this.firestore, `empresas/${empresaId}/solicitudes`),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Get active expenses
  async getSolicitudesActivas(empresaId: string): Promise<any[]> {
    const q = query(
      collection(this.firestore, `empresas/${empresaId}/solicitudes`),
      where('activo', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Get expenses by month
  async getSolicitudesPorPeriodo(empresaId: string, year: number, month: number): Promise<any[]> {
    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    const q = query(
      collection(this.firestore, `empresas/${empresaId}/periodos/${periodoId}/solicitudes`),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Alta de solicitud
  async crearSolicitud(empresaId: string, data: any): Promise<any> {
    const docRef = doc(collection(this.firestore, `empresas/${empresaId}/solicitudes`));
    const now = new Date().toISOString();
    const expenseData = {
      ...data,
      id: docRef.id,
      empresaId,
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
  async actualizarSolicitud(empresaId: string, solicitudId: string, data: any) {
    const docRef = doc(this.firestore, `empresas/${empresaId}/solicitudes/${solicitudId}`);
    await setDoc(docRef, this.limpiar({ ...data, updatedAt: new Date().toISOString() }), { merge: true });
  }

  // Marca la solicitud como atendida
  async marcarSolicitudAtendida(empresaId: string, solicitudId: string, paidAmount: number, fechaAtencion?: string) {
    const docRef = doc(this.firestore, `empresas/${empresaId}/solicitudes/${solicitudId}`);
    await setDoc(docRef, this.limpiar({
      actualAmount: paidAmount,
      fechaAtencion: fechaAtencion || new Date().toISOString(),
      status: 'paid',
      updatedAt: new Date().toISOString()
    }), { merge: true });
  }

  // Anula la solicitud
  async anularSolicitud(empresaId: string, solicitudId: string) {
    const docRef = doc(this.firestore, `empresas/${empresaId}/solicitudes/${solicitudId}`);
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
  async getCuotasPorPeriodo(empresaId: string, year: number, month: number): Promise<any[]> {
    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    const q = query(
      collection(this.firestore, `empresas/${empresaId}/periodos/${periodoId}/almacenamiento`),
      orderBy('esPrioritaria'),
      orderBy('budgetedAmount', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Create or update budget for a category
  async definirCuota(empresaId: string, data: any): Promise<any> {
    const periodoId = data.periodoId;
    const docRef = doc(this.firestore, `empresas/${empresaId}/periodos/${periodoId}/almacenamiento/${data.category}`);
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
  async actualizarConsumoCuota(empresaId: string, category: string, periodoId: string, actualAmount: number) {
    const docRef = doc(this.firestore, `empresas/${empresaId}/periodos/${periodoId}/almacenamiento/${category}`);
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
  async calcularResumenAlmacenamiento(empresaId: string, year: number, month: number): Promise<any> {
    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    
    // Get budgets for the month
    let budgets = await this.getCuotasPorPeriodo(empresaId, year, month);
    
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
    const transactions = await this.getHistorialPorPeriodo(empresaId, year, month);
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
  async guardarRegistroCuota(empresaId: string, id: string, data: any) {
    const docRef = doc(this.firestore, `empresas/${empresaId}/cuotas/${id}`);
    return setDoc(docRef, this.limpiar(data), { merge: true });
  }

  async getRegistroCuota(empresaId: string, id: string): Promise<any> {
    const docRef = doc(this.firestore, `empresas/${empresaId}/cuotas/${id}`);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }

  async getSurplusHistory(empresaId: string): Promise<any[]> {
    const colRef = collection(this.firestore, `empresas/${empresaId}/cuotas`);
    const q = query(colRef, orderBy('calculatedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async saveNotification(empresaId: string, notification: any) {
    const id = `${notification.year}-${String(notification.month).padStart(2, '0')}-${Date.now()}`;
    const docRef = doc(this.firestore, `empresas/${empresaId}/notifications/${id}`);
    return setDoc(docRef, this.limpiar(notification), { merge: true });
  }

  async getNotifications(empresaId: string, unreadOnly: boolean = false): Promise<any[]> {
    const colRef = collection(this.firestore, `empresas/${empresaId}/notifications`);
    let q = query(colRef, orderBy('createdAt', 'desc'), limit(20));
    
    if (unreadOnly) {
      q = query(colRef, where('isRead', '==', false), orderBy('createdAt', 'desc'), limit(20));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async markNotificationAsRead(empresaId: string, notificationId: string) {
    const docRef = doc(this.firestore, `empresas/${empresaId}/notifications/${notificationId}`);
    return setDoc(docRef, this.limpiar({ isRead: true }), { merge: true });
  }
}