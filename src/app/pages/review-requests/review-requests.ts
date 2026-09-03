import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HistoryService } from '../../core/services/history';
import { ReviewRequestService } from '../../core/services/review-request';
import { Auth } from '../../core/services/auth';
import { IconComponent } from '../../core/components/icon/icon.component';
import { RegistroHistorial } from '../../core/models/history.model';
import { SolicitudRevision, SolicitudRevisionPayload, DETALLES_POR_TIPO, TIPOS_PRIORITARIOS, TIPOS_ORDINARIOS } from '../../core/models/review-request.model';

const CATEGORY_COLORS: Record<string, string> = {
  housing: '#166B46',
  utilities: '#2FA46A',
  transport: '#1a5276',
  health: '#ef4444',
  groceries: '#f59e0b',
  education: '#6366f1',
  debt: '#dc2626',
  dining_out: '#ec4899',
  entertainment: '#8b5cf6',
  streaming: '#3b82f6',
  pets: '#f97316',
  clothing: '#06b6d4',
  travel: '#7c3aed',
  shopping: '#0891b2',
  subscriptions: '#64748b',
  other: '#78716c'
};

const CATEGORY_LABELS: Record<string, string> = {
  housing: 'Vivienda',
  utilities: 'Servicios',
  transport: 'Transporte',
  health: 'Salud',
  groceries: 'Supermercado',
  education: 'Educación',
  debt: 'Deudas',
  dining_out: 'Restaurantes',
  entertainment: 'Entretenimiento',
  streaming: 'Streaming',
  pets: 'Mascotas',
  clothing: 'Ropa',
  travel: 'Viajes',
  shopping: 'Compras',
  subscriptions: 'Suscripciones',
  other: 'Otros'
};

const CATEGORY_ICONS: Record<string, string> = {
  housing: 'house',
  utilities: 'lightbulb',
  transport: 'bus',
  health: 'hospital',
  groceries: 'shopping-cart',
  education: 'graduation-cap',
  debt: 'landmark',
  dining_out: 'utensils',
  entertainment: 'clapperboard',
  streaming: 'tv',
  pets: 'dog',
  clothing: 'shirt',
  travel: 'plane',
  shopping: 'shopping-bag',
  subscriptions: 'repeat',
  other: 'package'
};

const SUBCATEGORY_ICONS: Record<string, string> = {
  // Vivienda
  Alquiler: 'building-2', Hipoteca: 'house', 'Cuota de casa': 'house',
  // Servicios
  Luz: 'lightbulb', Agua: 'droplet', Internet: 'monitor', Gas: 'leaf', Teléfono: 'phone',
  // Transporte
  Pasajes: 'bus', Gasolina: 'car', Peaje: 'car', Taxi: 'car', Mantenimiento: 'wrench',
  // Salud
  EPS: 'hospital', Seguro: 'shield', Medicamentos: 'heart', Consulta: 'hospital', Dentista: 'hospital',
  // Supermercado
  Supermercado: 'shopping-cart', Verdulería: 'shopping-cart', Carnicería: 'beef', Mercado: 'store',
  // Educación
  Colegiatura: 'graduation-cap', Universidad: 'building-2', Curso: 'scroll-text', Libros: 'file-text',
  // Deudas
  'Tarjeta crédito': 'credit-card', Préstamo: 'landmark', Crédito: 'landmark', Cuota: 'coins',
  // Streaming → brand icons
  Netflix: 'brand-netflix', Spotify: 'brand-spotify', 'Amazon Prime': 'brand-amazon',
  'Disney+': 'brand-disney', 'HBO Max': 'brand-hbo', Crunchyroll: 'brand-crunchyroll',
  // Restaurantes
  Restaurantes: 'utensils', Delivery: 'shopping-bag', Café: 'utensils', 'Fast Food': 'utensils',
  // Entretenimiento
  Cine: 'clapperboard', Concierto: 'party-popper', Bar: 'beer', Juego: 'target', Deporte: 'trophy',
  // Mascotas
  Alimento: 'bone', Veterinaria: 'hospital', Accesorios: 'shopping-bag', Peluquería: 'shirt',
  // Ropa
  Ropa: 'shirt', Calzado: 'shirt',
  // Viajes
  'Pasaje aéreo': 'plane', Hotel: 'building-2', Alojamiento: 'building-2', 'Alquiler auto': 'car',
  // Compras
  Compras: 'shopping-bag', Regalos: 'gift', Hogar: 'house', Tecnología: 'laptop',
  // Suscripciones
  Gimnasio: 'trophy', Software: 'laptop', Apps: 'monitor', Membresía: 'credit-card',
  // Otro
  Otro: 'package'
};

export type ExpenseType = 'subscription' | 'variable' | 'fixed' | 'one-time' | 'mixed';
export type FrecuenciaSolicitud = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time';

/**
 * Campo de metadata dinámico para cada subcategoría.
 * Define qué campos extra se muestran en el modal y cómo se almacenan.
 *
 * - `key`: nombre interno (se guarda en expense.metadata[key])
 * - `label`: etiqueta visible en el formulario
 * - `type`: tipo de input (text, select, number, boolean)
 * - `description`: documentación del campo (qué representa, para qué sirve)
 * - `icon`: icono lucide opcional
 * - `placeholder`: texto de placeholder (auto-sugerencia que desaparece al escribir)
 * - `options`: opciones para type=select
 * - `required`: si el campo es obligatorio para guardar
 * - `hint`: texto de ayuda bajo el campo
 */
export interface MetadataField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'boolean';
  /** Documentación: describe qué representa este campo y para qué sirve */
  description: string;
  icon?: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  hint?: string;
}

export interface SubcategoryMeta {
  type: ExpenseType;
  frequency?: FrecuenciaSolicitud;
  hasDueDate: boolean;
  dueDateRequired: boolean;
  typicalDueDay?: number;
  typicalDueDayAlt?: number;
  metadataFields?: MetadataField[];
}

const SUBCATEGORY_META: Record<string, SubcategoryMeta> = {
  // ── Vivienda ──
  Alquiler: {
    type: 'fixed', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 5,
    metadataFields: [
      { key: 'arrendador', label: 'Arrendador', type: 'text', icon: 'user',
        description: 'Nombre del arrendador o propietario del inmueble',
        placeholder: 'Ej: Juan Pérez, Inmobiliaria XYZ' },
      { key: 'contrato', label: 'Nro. contrato', type: 'text', icon: 'file-text',
        description: 'Número de contrato de alquiler si lo tienes' },
      { key: 'incluyeServicios', label: '¿Incluye servicios?', type: 'boolean',
        description: 'Si el alquiler ya incluye luz, agua, internet, etc.' }
    ]
  },
  Hipoteca: {
    type: 'fixed', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 1,
    metadataFields: [
      { key: 'banco', label: 'Banco', type: 'select', icon: 'landmark',
        description: 'Banco donde tienes la hipoteca',
        options: ['BCP', 'Interbank', 'BBVA', 'MiBanco', 'Scotiabank', 'Otro'] },
      { key: 'plazoRestante', label: 'Cuotas restantes', type: 'number', icon: 'calendar',
        description: 'Número de cuotas que faltan por pagar de tu crédito hipotecario',
        placeholder: 'Ej: 120' }
    ]
  },
  'Cuota de casa': {
    type: 'fixed', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 15,
    metadataFields: [
      { key: 'banco', label: 'Banco/Entidad', type: 'text', icon: 'landmark',
        description: 'Banco o entidad financiera que otorgó el crédito',
        placeholder: 'Ej: BCP, Interbank' },
      { key: 'cuotaActual', label: 'Días de atención', type: 'number', icon: 'coins',
        description: 'Cantidad de la cuota mensual actual',
        placeholder: 'Cantidad en soles' }
    ]
  },
  // ── Servicios ──
  Luz: {
    type: 'variable', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 25,
    metadataFields: [
      { key: 'empresa', label: 'Empresa', type: 'select', icon: 'zap',
        description: 'Empresa de distribución eléctrica',
        options: ['Enel', 'Luz del Sur', 'Hidrandina', 'Edelnor', 'Otra'] },
      { key: 'medidor', label: 'Nro. medidor', type: 'text', icon: 'hash',
        description: 'Número de medidor eléctrico (aparece en tu recibo)',
        placeholder: 'Ej: 12345678' },
      { key: 'consumoKwh', label: 'Consumo (kWh)', type: 'number', icon: 'activity',
        description: 'Consumo en kilovatios-hora del período',
        placeholder: 'Ej: 150' },
      { key: 'lecturaAnterior', label: 'Lectura anterior', type: 'number', icon: 'trending-up',
        description: 'Lectura del medidor del mes anterior (para comparar)' }
    ]
  },
  Agua: {
    type: 'variable', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 20,
    metadataFields: [
      { key: 'empresa', label: 'Empresa', type: 'select', icon: 'droplet',
        description: 'Empresa de servicios de agua',
        options: ['Sedapal', 'Sedacosta', 'Sedapar', 'Otra'] },
      { key: 'medidor', label: 'Nro. medidor', type: 'text', icon: 'hash',
        description: 'Número de medidor de agua',
        placeholder: 'Ej: 87654321' },
      { key: 'consumoM3', label: 'Consumo (m³)', type: 'number', icon: 'activity',
        description: 'Consumo en metros cúbicos del período',
        placeholder: 'Ej: 12' }
    ]
  },
  Internet: {
    type: 'subscription', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 1,
    metadataFields: [
      { key: 'proveedor', label: 'Proveedor', type: 'select', icon: 'wifi',
        description: 'Proveedor de servicio de internet',
        options: ['Movistar', 'Claro', 'Bitel', 'Entel', 'Telmacio', 'Otro'] },
      { key: 'plan', label: 'Plan', type: 'text', icon: 'package',
        description: 'Nombre o velocidad del plan contratado',
        placeholder: 'Ej: Fibra 300MB, Plan Familiar' },
      { key: 'velocidad', label: 'Velocidad (Mbps)', type: 'number', icon: 'zap',
        description: 'Velocidad de descarga en megabits por segundo' }
    ]
  },
  Gas: {
    type: 'variable', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 15,
    metadataFields: [
      { key: 'empresa', label: 'Empresa', type: 'select', icon: 'leaf',
        description: 'Empresa distribuidora de gas natural',
        options: ['Calidda', 'Prax', 'Liquigas', 'Otra'] },
      { key: 'medidor', label: 'Nro. medidor', type: 'text', icon: 'hash',
        description: 'Número de medidor de gas',
        placeholder: 'Ej: 11223344' },
      { key: 'consumoM3', label: 'Consumo (m³)', type: 'number', icon: 'activity',
        description: 'Volumen de gas consumido en metros cúbicos' }
    ]
  },
  Teléfono: {
    type: 'variable', frequency: 'monthly', hasDueDate: true, dueDateRequired: false, typicalDueDay: 10,
    metadataFields: [
      { key: 'empresa', label: 'Empresa', type: 'select', icon: 'phone',
        description: 'Operador de telefonía móvil o fija',
        options: ['Movistar', 'Claro', 'Entel', 'Bitel', 'Otro'] },
      { key: 'plan', label: 'Plan', type: 'text', icon: 'package',
        description: 'Plan contratado (prepago, postago, datos)',
        placeholder: 'Ej: Plan 20GB, Prepago' }
    ]
  },
  // ── Transporte ──
  Pasajes: {
    type: 'variable', frequency: 'weekly', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'origen', label: 'Origen', type: 'text', icon: 'map-pin',
        description: 'Punto de partida del viaje',
        placeholder: 'Ej: San Isidro, Av. Javier Prado' },
      { key: 'destino', label: 'Destino', type: 'text', icon: 'map-pin',
        description: 'Punto de llegada del viaje',
        placeholder: 'Ej: Miraflores, Centro de Lima' },
      { key: 'transporte', label: 'Transporte', type: 'select', icon: 'bus',
        description: 'Medio de transporte utilizado',
        options: ['Metropolitano', 'Bus', 'Metro', 'Tren', 'Combi', 'Otro'] },
      { key: 'viajes', label: 'Nro. viajes', type: 'number', icon: 'repeat',
        description: 'Cantidad de viajes ida y vuelta en el período',
        hint: 'Cuenta ida + vuelta como 1 viaje' }
    ]
  },
  Gasolina: {
    type: 'variable', frequency: 'biweekly', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'gasolinera', label: 'Gasolinera', type: 'select', icon: 'zap',
        description: 'Nombre de la gasolinera donde cargaste',
        options: ['Repsol', 'PetroPerú', 'Primax', 'GyM', 'Otra'] },
      { key: 'galones', label: 'Galones', type: 'number', icon: 'droplet',
        description: 'Cantidad de galones cargados',
        placeholder: 'Ej: 25' },
      { key: 'tipoGasolina', label: 'Tipo', type: 'select', icon: 'zap',
        description: 'Tipo de gasolina cargada',
        options: ['Regular 84', 'Regular 90', 'Premium 95', 'Premium 97', 'Diesel'] },
      { key: 'kilometraje', label: 'Kilometraje', type: 'number', icon: 'car',
        description: 'Odómetro actual del vehículo (para calcular km/galón)' }
    ]
  },
  Peaje: {
    type: 'variable', frequency: 'weekly', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'ruta', label: 'Ruta', type: 'text', icon: 'route',
        description: 'Tramo o ruta por donde pasaste',
        placeholder: 'Ej: Via Expresa, Panamericana' },
      { key: 'cantidad', label: 'Nro. peajes', type: 'number', icon: 'hash',
        description: 'Cantidad de peajes pagados en el período' }
    ]
  },
  Taxi: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'plataforma', label: 'Plataforma', type: 'select', icon: 'car',
        description: 'App o servicio de taxi utilizado',
        options: ['Uber', 'Didi', 'Cabify', 'InDrive', 'Taxi directo', 'Otro'] },
      { key: 'origen', label: 'Origen', type: 'text', icon: 'map-pin',
        description: 'Punto de partida del viaje',
        placeholder: 'Ej: Casa, Oficina' },
      { key: 'destino', label: 'Destino', type: 'text', icon: 'map-pin',
        description: 'Punto de llegada del viaje',
        placeholder: 'Ej: Centro Comercial, Aeropuerto' },
      { key: 'distancia', label: 'Distancia (km)', type: 'number', icon: 'ruler',
        description: 'Distancia aproximada del viaje en kilómetros' }
    ]
  },
  Mantenimiento: {
    type: 'one-time', frequency: 'quarterly', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'taller', label: 'Taller', type: 'text', icon: 'wrench',
        description: 'Nombre del taller mecánico',
        placeholder: 'Ej: AutoService, Taller Juan' },
      { key: 'servicio', label: 'Servicio', type: 'select', icon: 'settings',
        description: 'Tipo de mantenimiento realizado',
        options: ['Cambio de aceite', 'Alineación', 'Frenos', 'Revisión general', 'Latonería/Pintura', 'Otro'] },
      { key: 'kilometraje', label: 'Kilometraje', type: 'number', icon: 'car',
        description: 'Kilometraje actual del vehículo al momento del servicio' }
    ]
  },
  // ── Salud ──
  EPS: {
    type: 'subscription', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 1,
    metadataFields: [
      { key: 'eps', label: 'EPS', type: 'select', icon: 'hospital',
        description: 'Empresa Prestadora de Salud a la que perteneces',
        options: ['Rimac', 'Pacífico', 'San Pablo', 'Rímac', 'Clínica Anglo', 'Otra'] },
      { key: 'plan', label: 'Plan', type: 'text', icon: 'package',
        description: 'Nombre del plan de salud contratado',
        placeholder: 'Ej: Plan Esencial, Plan Premium' }
    ]
  },
  Seguro: {
    type: 'subscription', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 5,
    metadataFields: [
      { key: 'aseguradora', label: 'Aseguradora', type: 'select', icon: 'shield',
        description: 'Compañía de seguros',
        options: ['Rimac', 'Pacífico', 'La Positiva', 'Protecta', 'Otra'] },
      { key: 'tipoSeguro', label: 'Tipo de seguro', type: 'select', icon: 'shield',
        description: 'Categoría del seguro',
        options: ['Vehicular', 'Vida', 'Salud', 'Hogar', 'Viaje', 'Otro'] },
      { key: 'poliza', label: 'Nro. póliza', type: 'text', icon: 'file-text',
        description: 'Número de póliza de seguro' }
    ]
  },
  Medicamentos: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'farmacia', label: 'Farmacia', type: 'select', icon: 'heart',
        description: 'Farmacia donde compraste los medicamentos',
        options: ['InkaFarma', 'MiFarma', 'Boticas Yza', 'Otra'] },
      { key: 'medicamentos', label: 'Medicamentos', type: 'text', icon: 'pill',
        description: 'Nombres de los medicamentos comprados',
        placeholder: 'Ej: Paracetamol, Ibuprofeno' },
      { key: 'conReceta', label: '¿Con receta?', type: 'boolean',
        description: 'Si el medicamento requirió receta médica' }
    ]
  },
  Consulta: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'medico', label: 'Médico', type: 'text', icon: 'user',
        description: 'Nombre del médico o especialista',
        placeholder: 'Ej: Dr. Carlos López' },
      { key: 'especialidad', label: 'Especialidad', type: 'select', icon: 'stethoscope',
        description: 'Especialidad médica consultada',
        options: ['General', 'Cardiología', 'Dermatología', 'Ginecología', 'Pediatría', 'Otra'] },
      { key: 'clinica', label: 'Clínica', type: 'text', icon: 'hospital',
        description: 'Nombre de la clínica o centro médico',
        placeholder: 'Ej: Clínica Ricardo Palma' }
    ]
  },
  Dentista: {
    type: 'one-time', frequency: 'quarterly', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'dentista', label: 'Dentista', type: 'text', icon: 'user',
        description: 'Nombre del odontólogo',
        placeholder: 'Ej: Dra. María García' },
      { key: 'servicio', label: 'Servicio', type: 'select', icon: 'sparkles',
        description: 'Tipo de tratamiento dental',
        options: ['Limpieza', 'Obturación', 'Extracción', 'Ortodoncia', 'Blanqueamiento', 'Otro'] },
      { key: 'clinica', label: 'Clínica dental', type: 'text', icon: 'hospital',
        description: 'Nombre del consultorio o clínica dental' }
    ]
  },
  // ── Supermercado ──
  Supermercado: {
    type: 'variable', frequency: 'weekly', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'lugar', label: 'Supermercado', type: 'select', icon: 'shopping-cart',
        description: 'Supermercado donde compraste',
        options: ['Metro', 'Wong', 'Vivanda', 'PlazaVea', 'Tottus', 'Otro'] },
      { key: 'tipoCompra', label: 'Tipo de compra', type: 'select', icon: 'list',
        description: 'Si es una compra rutinaria o especial',
        options: ['Semanal', 'Quincenal', 'Reabastecimiento', 'Especial'] },
      { key: 'tieneFactura', label: '¿Tiene factura?', type: 'boolean',
        description: 'Si obtuviste factura o boleta de compra' }
    ]
  },
  Verdulería: {
    type: 'variable', frequency: 'weekly', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'lugar', label: 'Lugar', type: 'text', icon: 'store',
        description: 'Nombre del mercado o local de verduras',
        placeholder: 'Ej: Mercado n° 2, Verdulería La Huerta' },
      { key: 'compra', label: 'Compra principal', type: 'text', icon: 'shopping-cart',
        description: 'Qué verduras o frutas compraste principalmente',
        placeholder: 'Ej: Papa, tomate, lechuga, manzana' }
    ]
  },
  Carnicería: {
    type: 'variable', frequency: 'weekly', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'lugar', label: 'Lugar', type: 'text', icon: 'store',
        description: 'Nombre de la carnicería',
        placeholder: 'Ej: Carnicería Don Carlos' },
      { key: 'productos', label: 'Productos', type: 'text', icon: 'beef',
        description: 'Carnes o embutidos comprados',
        placeholder: 'Ej: Pollo, carne molida, chorizo' },
      { key: 'kilos', label: 'Kilos aprox.', type: 'number', icon: 'scale',
        description: 'Peso aproximado en kilogramos' }
    ]
  },
  Mercado: {
    type: 'variable', frequency: 'weekly', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'lugar', label: 'Mercado', type: 'text', icon: 'store',
        description: 'Nombre del mercado',
        placeholder: 'Ej: Mercado Central, Surquillo' },
      { key: 'productos', label: 'Productos', type: 'text', icon: 'shopping-cart',
        description: 'Qué compraste en el mercado',
        placeholder: 'Ej: Frutas, verduras, huevo, pollo' }
    ]
  },
  // ── Educación ──
  Colegiatura: {
    type: 'fixed', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 5,
    metadataFields: [
      { key: 'colegio', label: 'Colegio', type: 'text', icon: 'graduation-cap',
        description: 'Nombre del colegio o institución educativa',
        placeholder: 'Ej: San Silvestre, Roosevelt' },
      { key: 'alumno', label: 'Alumno/a', type: 'text', icon: 'user',
        description: 'Nombre del estudiante',
        placeholder: 'Ej: Carlos Pérez' },
      { key: 'grado', label: 'Grado/Nivel', type: 'text', icon: 'book-open',
        description: 'Grado o nivel escolar',
        placeholder: 'Ej: 5to primaria, 3ero secundaria' }
    ]
  },
  Universidad: {
    type: 'fixed', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 10,
    metadataFields: [
      { key: 'universidad', label: 'Universidad', type: 'text', icon: 'building-2',
        description: 'Nombre de la universidad',
        placeholder: 'Ej: UTEC, UPC, San Martín' },
      { key: 'carrera', label: 'Carrera', type: 'text', icon: 'book-open',
        description: 'Carrera o programa que estás estudiando',
        placeholder: 'Ej: Ingeniería de Sistemas' },
      { key: 'ciclo', label: 'Ciclo', type: 'text', icon: 'hash',
        description: 'Ciclo o semestre actual',
        placeholder: 'Ej: 6to ciclo, 3er semestre' }
    ]
  },
  Curso: {
    type: 'one-time', frequency: 'monthly', hasDueDate: true, dueDateRequired: false, typicalDueDay: 1,
    metadataFields: [
      { key: 'institucion', label: 'Institución', type: 'text', icon: 'building-2',
        description: 'Nombre de la plataforma o institución que ofrece el curso',
        placeholder: 'Ej: Udemy, Coursera, Platzi' },
      { key: 'curso', label: 'Nombre del curso', type: 'text', icon: 'scroll-text',
        description: 'Nombre del curso o programa',
        placeholder: 'Ej: Angular Avanzado, Excel Básico' },
      { key: 'duracion', label: 'Duración (horas)', type: 'number', icon: 'clock',
        description: 'Duración total del curso en horas' }
    ]
  },
  Libros: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'libreria', label: 'Librería', type: 'text', icon: 'book-open',
        description: 'Nombre de la librería o plataforma',
        placeholder: 'Ej: El Virrey, Amazon, Google Books' },
      { key: 'titulo', label: 'Título', type: 'text', icon: 'file-text',
        description: 'Nombre del libro comprado',
        placeholder: 'Ej: El Arte de Programar' },
      { key: 'autor', label: 'Autor', type: 'text', icon: 'user',
        description: 'Nombre del autor del libro' }
    ]
  },
  // ── Deudas ──
  'Tarjeta crédito': {
    type: 'fixed', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 15,
    metadataFields: [
      { key: 'banco', label: 'Banco', type: 'select', icon: 'credit-card',
        description: 'Banco emisor de la tarjeta de crédito',
        options: ['BCP', 'Interbank', 'BBVA', 'Scotiabank', 'MiBanco', 'Ripley', 'Otro'] },
      { key: 'cantidadTotal', label: 'Documentos afectados', type: 'number', icon: 'coins',
        description: 'Cantidad total adeudado en la tarjeta',
        placeholder: 'Saldo total de la tarjeta' },
      { key: 'cuotaMinima', label: 'Días mínimos', type: 'number', icon: 'coins',
        description: 'Cuota mínima a pagar este mes' }
    ]
  },
  Préstamo: {
    type: 'fixed', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 1,
    metadataFields: [
      { key: 'banco', label: 'Banco/Entidad', type: 'text', icon: 'landmark',
        description: 'Banco o entidad financiera que otorgó el préstamo',
        placeholder: 'Ej: BCP, Credinka' },
      { key: 'cantidadOriginal', label: 'Días estimados', type: 'number', icon: 'coins',
        description: 'Cantidad total del préstamo al momento de solicitarlo' },
      { key: 'cuotasRestantes', label: 'Cuotas restantes', type: 'number', icon: 'calendar',
        description: 'Número de cuotas pendientes de pago' }
    ]
  },
  Crédito: {
    type: 'fixed', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 10,
    metadataFields: [
      { key: 'banco', label: 'Banco', type: 'select', icon: 'landmark',
        description: 'Banco que otorgó el crédito',
        options: ['BCP', 'Interbank', 'BBVA', 'MiBanco', 'Scotiabank', 'Otro'] },
      { key: 'tipo', label: 'Tipo de crédito', type: 'select', icon: 'banknote',
        description: 'Categoría del crédito',
        options: ['Personal', 'Vehicular', 'Hipotecario', 'Empresarial', 'Otro'] },
      { key: 'tasaInteres', label: 'Tasa de interés (%)', type: 'number', icon: 'percent',
        description: 'Tasa de interés mensual del crédito' }
    ]
  },
  Cuota: {
    type: 'fixed', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 5,
    metadataFields: [
      { key: 'descripcion', label: 'Descripción', type: 'text', icon: 'file-text',
        description: 'Descripción de la cuota que estás pagando',
        placeholder: 'Ej: Cuota de auto, cuota de muebles' },
      { key: 'entidad', label: 'Entidad', type: 'text', icon: 'landmark',
        description: 'Banco o entidad financiera' }
    ]
  },
  // ── Streaming ──
  Netflix: {
    type: 'subscription', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 15,
    metadataFields: [
      { key: 'plan', label: 'Plan', type: 'select', icon: 'tv',
        description: 'Plan de Netflix contratado',
        options: ['Básico con anuncios', 'Estándar', 'Premium'] },
      { key: 'perfil', label: 'Perfil', type: 'text', icon: 'user',
        description: 'Nombre del perfil que usas en Netflix',
        placeholder: 'Ej: Familiar, Personal' }
    ]
  },
  Spotify: {
    type: 'subscription', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 20,
    metadataFields: [
      { key: 'plan', label: 'Plan', type: 'select', icon: 'music',
        description: 'Plan de Spotify contratado',
        options: ['Free', 'Premium Individual', 'Premium Duo', 'Premium Familiar', 'Premium Student'] }
    ]
  },
  'Amazon Prime': {
    type: 'subscription', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 28,
    metadataFields: [
      { key: 'plan', label: 'Plan', type: 'select', icon: 'package',
        description: 'Plan de Amazon Prime',
        options: ['Mensual', 'Anual'] }
    ]
  },
  'Disney+': {
    type: 'subscription', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 1,
    metadataFields: [
      { key: 'plan', label: 'Plan', type: 'select', icon: 'tv',
        description: 'Plan de Disney+ contratado',
        options: ['Estándar con anuncios', 'Estándar', 'Premium'] }
    ]
  },
  'HBO Max': {
    type: 'subscription', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 10,
    metadataFields: [
      { key: 'plan', label: 'Plan', type: 'select', icon: 'tv',
        description: 'Plan de HBO Max contratado',
        options: ['Básico con anuncios', 'Estándar', 'Premium'] }
    ]
  },
  Crunchyroll: {
    type: 'subscription', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 5,
    metadataFields: [
      { key: 'plan', label: 'Plan', type: 'select', icon: 'tv',
        description: 'Plan de Crunchyroll contratado',
        options: ['Fan', 'Mega Fan', 'Ultimate Fan'] }
    ]
  },
  // ── Restaurantes ──
  Restaurantes: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'lugar', label: 'Restaurante', type: 'text', icon: 'utensils',
        description: 'Nombre del restaurante o local donde comiste',
        placeholder: 'Ej: La Mar, Panchita, Maido' },
      { key: 'tipo', label: 'Tipo de comida', type: 'select', icon: 'utensils',
        description: 'Categoría de la comida que consumiste',
        options: ['Desayuno', 'Almuerzo', 'Cena', 'Antojo', 'Café', 'Otros'] },
      { key: 'personas', label: 'Personas', type: 'number', icon: 'users',
        description: 'Cantidad total de personas que comieron (incluido tú)',
        hint: 'Inclúyete a ti mismo' },
      { key: 'ocasion', label: 'Ocasión', type: 'text', icon: 'party-popper',
        description: 'Si fue una ocasión especial, anótala aquí',
        placeholder: 'Ej: Cumpleaños, reunión trabajo, cita' }
    ]
  },
  Delivery: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'lugar', label: 'Restaurante', type: 'text', icon: 'utensils',
        description: 'Nombre del restaurante o local que pediste',
        placeholder: 'Ej: McDonald\'s, Pizza Hut' },
      { key: 'plataforma', label: 'Plataforma', type: 'select', icon: 'shopping-bag',
        description: 'App o plataforma de delivery utilizada',
        options: ['Rappi', 'PedidosYa', 'Didi Food', 'Uber Eats', 'Directo (restaurante)', 'Otra'] },
      { key: 'tipo', label: 'Tipo de comida', type: 'select', icon: 'utensils',
        description: 'Categoría de la comida',
        options: ['Desayuno', 'Almuerzo', 'Cena', 'Antojo', 'Snack'] }
    ]
  },
  Café: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'lugar', label: 'Cafetería', type: 'text', icon: 'coffee',
        description: 'Nombre de la cafetería o local',
        placeholder: 'Ej: Starbucks, Coffee Bean, Café del Barrio' },
      { key: 'paraLlevar', label: '¿Para llevar?', type: 'boolean',
        description: 'Si pediste para llevar (take away) o consumiste en el local' },
      { key: 'bebida', label: 'Bebida', type: 'text', icon: 'cup-soda',
        description: 'Qué bebida pediste',
        placeholder: 'Ej: Capuchino, Té verde, Frappé' }
    ]
  },
  'Fast Food': {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'lugar', label: 'Restaurante', type: 'text', icon: 'utensils',
        description: 'Nombre del restaurante de comida rápida',
        placeholder: 'Ej: McDonald\'s, KFC, Burger King' },
      { key: 'cadena', label: 'Cadena', type: 'select', icon: 'store',
        description: 'Cadena de comida rápida',
        options: ["McDonald's", 'Burger King', "Wendy's", 'KFC', 'Pizza Hut', 'Subway', 'Otra'] }
    ]
  },
  // ── Entretenimiento ──
  Cine: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'pelicula', label: 'Película', type: 'text', icon: 'clapperboard',
        description: 'Nombre de la película que viste',
        placeholder: 'Ej: Oppenheimer, Barbie' },
      { key: 'cine', label: 'Cine', type: 'select', icon: 'film',
        description: 'Sala de cine donde fuiste',
        options: ['Cinemark', 'Cineplanet', 'Cinerama', 'Movies', 'Otro'] },
      { key: 'acompanantes', label: 'Acompañantes', type: 'number', icon: 'users',
        description: 'Personas que fueron contigo (sin contarte)',
        hint: '0 si fuiste solo' },
      { key: 'formato', label: 'Formato', type: 'select', icon: 'tv',
        description: 'Formato de proyección',
        options: ['2D', '3D', '4DX', 'IMAX', 'XD', 'Dolby'] }
    ]
  },
  Concierto: {
    type: 'one-time', hasDueDate: true, dueDateRequired: false, typicalDueDay: 1,
    metadataFields: [
      { key: 'artista', label: 'Artista/Banda', type: 'text', icon: 'music',
        description: 'Nombre del artista o banda que toca',
        placeholder: 'Ej: Coldplay, Metallica, Karol G' },
      { key: 'lugarEvento', label: 'Lugar', type: 'text', icon: 'map-pin',
        description: 'Estadio, arena o venue del concierto',
        placeholder: 'Ej: Estadio Nacional, Arena Lima' },
      { key: 'tipoEntrada', label: 'Tipo de entrada', type: 'select', icon: 'ticket',
        description: 'Categoría de tu entrada',
        options: ['General', 'Preferente', 'VIP', 'Platinum', 'Palco'] }
    ]
  },
  Bar: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'lugar', label: 'Bar/Lugar', type: 'text', icon: 'beer',
        description: 'Nombre del bar, discoteca o local nocturno',
        placeholder: 'Ej: Bizarro, La Noche, Boulevard' },
      { key: 'acompanantes', label: 'Acompañantes', type: 'number', icon: 'users',
        description: 'Personas que fueron contigo',
        hint: '0 si fuiste solo' },
      { key: 'tipoBebida', label: 'Tipo de bebida', type: 'select', icon: 'wine',
        description: 'Tipo principal de bebida consumida',
        options: ['Cerveza', 'Coctel', 'Vino', 'Shot', 'Vodka', 'Otro'] }
    ]
  },
  Juego: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'juego', label: 'Videojuego', type: 'text', icon: 'gamepad-2',
        description: 'Nombre del videojuego comprado',
        placeholder: 'Ej: GTA VI, Zelda, FIFA 25' },
      { key: 'plataforma', label: 'Plataforma', type: 'select', icon: 'monitor',
        description: 'Plataforma o consola',
        options: ['Steam', 'PlayStation', 'Xbox', 'Nintendo', 'Epic Games', 'Mobile', 'Otra'] },
      { key: 'tipo', label: 'Tipo', type: 'select', icon: 'package',
        description: 'Si es juego base, DLC o suscripción',
        options: ['Juego base', 'DLC', 'Pase de temporada', 'Suscripción online', 'Moneda virtual'] }
    ]
  },
  Deporte: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'actividad', label: 'Actividad', type: 'text', icon: 'trophy',
        description: 'Nombre de la actividad deportiva',
        placeholder: 'Ej: Fútbol, Gym, Natación,瑜伽' },
      { key: 'lugar', label: 'Lugar', type: 'text', icon: 'map-pin',
        description: 'Gimnasio, cancha o centro deportivo',
        placeholder: 'Ej: Smart Fit, Club Regatas' },
      { key: 'sesiones', label: 'Sesiones', type: 'number', icon: 'repeat',
        description: 'Número de sesiones o clases que incluye este pago' }
    ]
  },
  // ── Mascotas ──
  Alimento: {
    type: 'variable', frequency: 'monthly', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'tienda', label: 'Tienda', type: 'text', icon: 'store',
        description: 'Pet shop o tienda donde compraste',
        placeholder: 'Ej: PetMarket, Tienda de Mascotas' },
      { key: 'marca', label: 'Marca', type: 'text', icon: 'tag',
        description: 'Marca del alimento',
        placeholder: 'Ej: Dog Chow, Whiskas, Excellent' },
      { key: 'tipoMascota', label: 'Mascota', type: 'select', icon: 'dog',
        description: 'Para qué mascota es el alimento',
        options: ['Perro', 'Gato', 'Ave', 'Pez', 'Otro'] },
      { key: 'peso', label: 'Peso (kg)', type: 'number', icon: 'scale',
        description: 'Peso del empaque en kilogramos' }
    ]
  },
  Veterinaria: {
    type: 'one-time', frequency: 'quarterly', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'veterinaria', label: 'Veterinaria', type: 'text', icon: 'hospital',
        description: 'Nombre de la veterinaria o clínica animal',
        placeholder: 'Ej: VetAnimal, Dr. Patitas' },
      { key: 'mascota', label: 'Mascota', type: 'text', icon: 'dog',
        description: 'Nombre de la mascota atendida',
        placeholder: 'Ej: Max, Luna, Michi' },
      { key: 'servicio', label: 'Servicio', type: 'select', icon: 'stethoscope',
        description: 'Tipo de servicio veterinario',
        options: ['Consulta general', 'Vacuna', 'Cirugía', 'Desparasitación', 'Análisis', 'Otro'] }
    ]
  },
  Accesorios: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'tienda', label: 'Tienda', type: 'text', icon: 'store',
        description: 'Tienda o pet shop',
        placeholder: 'Ej: PetMarket, Amazon' },
      { key: 'articulo', label: 'Artículo', type: 'text', icon: 'shopping-bag',
        description: 'Qué accesorio compraste para tu mascota',
        placeholder: 'Ej: Correa, cama, juguete, collar' },
      { key: 'mascota', label: 'Mascota', type: 'text', icon: 'dog',
        description: 'Nombre de la mascota para la que es' }
    ]
  },
  Peluquería: {
    type: 'one-time', frequency: 'monthly', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'lugar', label: 'Lugar', type: 'text', icon: 'scissors',
        description: 'Nombre de la peluquería canina/felina',
        placeholder: 'Ej: Pet Grooming, DogSpa' },
      { key: 'mascota', label: 'Mascota', type: 'text', icon: 'dog',
        description: 'Nombre de la mascota',
        placeholder: 'Ej: Max, Luna' },
      { key: 'servicio', label: 'Servicio', type: 'select', icon: 'sparkles',
        description: 'Tipo de servicio de peluquería',
        options: ['Corte', 'Baño', 'Corte y baño', 'Deslanado', 'Uñas', 'Otro'] }
    ]
  },
  // ── Ropa ──
  Ropa: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'tienda', label: 'Tienda', type: 'text', icon: 'shopping-bag',
        description: 'Nombre de la tienda o marca',
        placeholder: 'Ej: Zara, H&M, Uniqlo' },
      { key: 'articulo', label: 'Artículo', type: 'text', icon: 'shirt',
        description: 'Qué prenda de ropa compraste',
        placeholder: 'Ej: Camisa, jeans, chaqueta' },
      { key: 'talla', label: 'Talla', type: 'text', icon: 'hash',
        description: 'Talla de la prenda',
        placeholder: 'Ej: M, 38, 42' },
      { key: 'tieneFactura', label: '¿Tiene factura?', type: 'boolean',
        description: 'Si obtuviste factura o boleta de compra' }
    ]
  },
  Calzado: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'tienda', label: 'Tienda', type: 'text', icon: 'shopping-bag',
        description: 'Nombre de la tienda de calzado',
        placeholder: 'Ej: Nike, Adidas, Ripley' },
      { key: 'articulo', label: 'Artículo', type: 'text', icon: 'footprints',
        description: 'Qué calzado compraste',
        placeholder: 'Ej: Zapatillas Nike Air Max, Botas de lluvia' },
      { key: 'talla', label: 'Talla', type: 'text', icon: 'hash',
        description: 'Talla del calzado',
        placeholder: 'Ej: 42, 9.5, 27cm' }
    ]
  },
  // ── Viajes ──
  'Pasaje aéreo': {
    type: 'one-time', hasDueDate: true, dueDateRequired: false, typicalDueDay: 1,
    metadataFields: [
      { key: 'aerolinea', label: 'Aerolínea', type: 'select', icon: 'plane',
        description: 'Aerolínea con la que viajas',
        options: ['LATAM', 'Avianca', 'Sky Airline', 'Viva Air', 'JetSmart', 'Star Perú', 'Otra'] },
      { key: 'ruta', label: 'Ruta', type: 'text', icon: 'map-pin',
        description: 'Origen y destino del vuelo',
        placeholder: 'Ej: Lima - Cusco, Lima - Arequipa' },
      { key: 'idaVuelta', label: '¿Ida y vuelta?', type: 'boolean',
        description: 'Si el pasaje incluye viaje de regreso' },
      { key: 'fechaViaje', label: 'Fecha de viaje', type: 'text', icon: 'calendar',
        description: 'Fecha del vuelo',
        placeholder: 'Ej: 15/06/2026' }
    ]
  },
  Hotel: {
    type: 'one-time', hasDueDate: true, dueDateRequired: false, typicalDueDay: 1,
    metadataFields: [
      { key: 'nombre', label: 'Hotel', type: 'text', icon: 'building-2',
        description: 'Nombre del hotel',
        placeholder: 'Ej: Marriott, Hilton, Airbnb' },
      { key: 'ubicacion', label: 'Ubicación', type: 'text', icon: 'map-pin',
        description: 'Ciudad o zona del hotel',
        placeholder: 'Ej: Miraflores, Cusco Centro' },
      { key: 'noches', label: 'Noches', type: 'number', icon: 'moon',
        description: 'Cantidad de noches de estadía' },
      { key: 'tipoHabitacion', label: 'Tipo habitación', type: 'select', icon: 'bed',
        description: 'Categoría de la habitación',
        options: ['Estándar', 'Doble', 'Suite', 'Familiar', 'Otro'] }
    ]
  },
  Alojamiento: {
    type: 'one-time', hasDueDate: true, dueDateRequired: false, typicalDueDay: 1,
    metadataFields: [
      { key: 'nombre', label: 'Lugar', type: 'text', icon: 'building-2',
        description: 'Nombre del alojamiento',
        placeholder: 'Ej: Hostal, Airbnb, Casa de playa' },
      { key: 'ubicacion', label: 'Ubicación', type: 'text', icon: 'map-pin',
        description: 'Ciudad o zona' },
      { key: 'noches', label: 'Noches', type: 'number', icon: 'moon',
        description: 'Cantidad de noches' }
    ]
  },
  'Alquiler auto': {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'empresa', label: 'Empresa', type: 'text', icon: 'car',
        description: 'Empresa de alquiler de vehículos',
        placeholder: 'Ej: Alamo, Hertz, Localiza' },
      { key: 'dias', label: 'Días', type: 'number', icon: 'calendar',
        description: 'Número de días que alquilaste el vehículo' },
      { key: 'incluyeSeguro', label: '¿Incluye seguro?', type: 'boolean',
        description: 'Si el alquiler incluye seguro de protección' }
    ]
  },
  // ── Compras ──
  Compras: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'tienda', label: 'Tienda', type: 'text', icon: 'store',
        description: 'Nombre de la tienda o comercio',
        placeholder: 'Ej: Falabella, Ripley, Oechsle' },
      { key: 'articulo', label: 'Artículo', type: 'text', icon: 'shopping-bag',
        description: 'Qué compraste',
        placeholder: 'Ej: Audífonos, cargador, lámpara' },
      { key: 'tieneFactura', label: '¿Tiene factura?', type: 'boolean',
        description: 'Si obtuviste factura o boleta' }
    ]
  },
  Regalos: {
    type: 'one-time', hasDueDate: true, dueDateRequired: false, typicalDueDay: 25,
    metadataFields: [
      { key: 'persona', label: 'Para quién', type: 'text', icon: 'user',
        description: 'Nombre de la persona que recibió el regalo',
        placeholder: 'Ej: Mamá, Pedro, Ana' },
      { key: 'ocasion', label: 'Ocasión', type: 'select', icon: 'party-popper',
        description: 'Para qué ocasión era el regalo',
        options: ['Cumpleaños', 'Navidad', 'Día de la Madre', 'Día del Padre', 'Aniversario', 'Sin ocasión', 'Otro'] },
      { key: 'tienda', label: 'Tienda', type: 'text', icon: 'store',
        description: 'Dónde compraste el regalo',
        placeholder: 'Ej: Falabella, Librería San Marcos' }
    ]
  },
  Hogar: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'tienda', label: 'Tienda', type: 'text', icon: 'store',
        description: 'Tienda de mejoras del hogar',
        placeholder: 'Ej: Sodimac, IKEA, Maestro' },
      { key: 'articulo', label: 'Artículo', type: 'text', icon: 'package',
        description: 'Qué compraste para el hogar',
        placeholder: 'Ej: Lámpara, cortinas, herramientas' },
      { key: 'categoria', label: 'Categoría', type: 'select', icon: 'home',
        description: 'Tipo de artículo para el hogar',
        options: ['Muebles', 'Electrodomésticos', 'Decoración', 'Herramientas', 'Iluminación', 'Otro'] }
    ]
  },
  Tecnología: {
    type: 'one-time', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'tienda', label: 'Tienda', type: 'text', icon: 'store',
        description: 'Tienda de tecnología',
        placeholder: 'Ej: Falabella, Ripley, Oechsle' },
      { key: 'articulo', label: 'Artículo', type: 'text', icon: 'laptop',
        description: 'Qué artículo tecnológico compraste',
        placeholder: 'Ej: iPhone 15, Audífonos Sony, Tablet' },
      { key: 'marca', label: 'Marca', type: 'text', icon: 'tag',
        description: 'Marca del producto',
        placeholder: 'Ej: Apple, Samsung, Sony' },
      { key: 'garantia', label: '¿Tiene garantía?', type: 'boolean',
        description: 'Si el producto viene con garantía del fabricante o tienda' }
    ]
  },
  // ── Suscripciones ──
  Gimnasio: {
    type: 'subscription', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 1,
    metadataFields: [
      { key: 'gimnasio', label: 'Gimnasio', type: 'text', icon: 'trophy',
        description: 'Nombre del gimnasio o centro fitness',
        placeholder: 'Ej: Smart Fit, Sport Fitness' },
      { key: 'plan', label: 'Plan', type: 'select', icon: 'package',
        description: 'Tipo de membresía contratada',
        options: ['Básico', 'Estándar', 'Premium', 'VIP', 'Otro'] },
      { key: 'clases', label: 'Clases incluidas', type: 'text', icon: 'users',
        description: 'Qué clases o servicios incluye tu membresía',
        placeholder: 'Ej: Peso libre, spinning, natación' }
    ]
  },
  Software: {
    type: 'subscription', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 15,
    metadataFields: [
      { key: 'aplicacion', label: 'Aplicación', type: 'text', icon: 'laptop',
        description: 'Nombre del software o aplicación',
        placeholder: 'Ej: Adobe CC, Microsoft 365, Spotify' },
      { key: 'plan', label: 'Plan', type: 'text', icon: 'package',
        description: 'Plan o versión contratada',
        placeholder: 'Ej: Creative Cloud, Family, Student' }
    ]
  },
  Apps: {
    type: 'subscription', frequency: 'monthly', hasDueDate: true, dueDateRequired: false, typicalDueDay: 10,
    metadataFields: [
      { key: 'aplicacion', label: 'App', type: 'text', icon: 'smartphone',
        description: 'Nombre de la aplicación móvil',
        placeholder: 'Ej: Duolingo, Headspace, Notion' },
      { key: 'plataforma', label: 'Plataforma', type: 'select', icon: 'smartphone',
        description: 'Tienda de la app',
        options: ['App Store (iOS)', 'Google Play', 'Web', 'Otra'] }
    ]
  },
  Membresía: {
    type: 'subscription', frequency: 'monthly', hasDueDate: true, dueDateRequired: true, typicalDueDay: 1,
    metadataFields: [
      { key: 'lugar', label: 'Lugar', type: 'text', icon: 'credit-card',
        description: 'Nombre del club, centro o institución',
        placeholder: 'Ej: Club Regatas, Country Club' },
      { key: 'tipo', label: 'Tipo', type: 'select', icon: 'crown',
        description: 'Categoría de membresía',
        options: ['Individual', 'Pareja', 'Familiar', 'Premium', 'Otro'] }
    ]
  },
  // ── Otro ──
  Otro: {
    type: 'mixed', frequency: 'monthly', hasDueDate: false, dueDateRequired: false,
    metadataFields: [
      { key: 'descripcion', label: 'Descripción', type: 'text', icon: 'file-text',
        description: 'Describe brevemente de qué es este solicitud',
        placeholder: 'Ej: Reembolso, préstamo a amigo, otro solicitud' },
      { key: 'lugar', label: 'Lugar', type: 'text', icon: 'map-pin',
        description: 'Lugar o comercio (opcional)',
        placeholder: 'Ej: Bancolombia, Mercado' }
    ]
  }
};

const PROVIDER_BY_SUBCATEGORY: Record<string, string> = {
  // Servicios
  Luz: 'Enel', Agua: 'Sedapal', Gas: 'Calidda',
  Internet: 'Movistar', Teléfono: 'Entel',
  // Streaming
  Netflix: 'Netflix', Spotify: 'Spotify', 'Amazon Prime': 'Amazon',
  'Disney+': 'Disney+', 'HBO Max': 'HBO Max', Crunchyroll: 'Crunchyroll',
  // Salud
  EPS: 'Rimac', Seguro: 'Pacifico', Medicamentos: 'InkaFarma',
  Consulta: 'Clínica', Dentista: 'Dental',
  // Suscripciones
  Gimnasio: 'Smart Fit', Software: 'Adobe', Apps: 'Google Play', Membresía: 'Membresía',
  // Transporte
  Pasajes: 'Metropolitano', Gasolina: 'Repsol', Peaje: 'Concesionaria', Taxi: 'Uber',
  Mantenimiento: 'Taller',
  // Supermercado
  Supermercado: 'Metro', Verdulería: 'Mercado', Carnicería: 'Carnicería', Mercado: 'Mercado',
  // Educación
  Colegiatura: 'Colegio', Universidad: 'Universidad', Curso: 'Curso', Libros: 'Librería',
  // Deudas
  'Tarjeta crédito': 'BCP', Préstamo: 'Banco', Crédito: 'Interbank', Cuota: 'Banco',
  // Restaurantes
  Restaurantes: 'Restaurante', Delivery: 'Rappi', Café: 'Café', 'Fast Food': 'Restaurante',
  // Entretenimiento
  Cine: 'Cinemark', Concierto: 'Evento', Bar: 'Bar', Juego: 'Steam', Deporte: 'Club',
  // Mascotas
  Alimento: 'PetShop', Veterinaria: 'Veterinaria', Accesorios: 'PetShop', Peluquería: 'PetShop',
  // Ropa
  Ropa: 'Tienda', Calzado: 'Tienda',
  // Viajes
  'Pasaje aéreo': 'LATAM', Hotel: 'Booking', Alojamiento: 'Booking', 'Alquiler auto': 'Alamo',
  // Compras
  Compras: 'Tienda', Regalos: 'Tienda', Hogar: 'Sodimac', Tecnología: 'Falabella',
  // Vivienda
  Alquiler: 'Arrendador', Hipoteca: 'Banco', 'Cuota de casa': 'Banco',
  // Otro
  Otro: ''
};

const SUGGESTED_AMOUNTS: Record<string, number> = {
  Alquiler: 1500, Hipoteca: 1200, 'Cuota de casa': 800,
  Luz: 200, Agua: 80, Gas: 50, Internet: 120, Teléfono: 50,
  Pasajes: 150, Gasolina: 300, Peaje: 100, Taxi: 80, Mantenimiento: 200,
  EPS: 200, Seguro: 150, Medicamentos: 100, Consulta: 150, Dentista: 180,
  Supermercado: 800, Verdulería: 300, Carnicería: 250, Mercado: 400,
  Colegiatura: 600, Universidad: 500, Curso: 300, Libros: 80,
  'Tarjeta crédito': 500, Préstamo: 400, Crédito: 500, Cuota: 300,
  Netflix: 35, Spotify: 25, 'Amazon Prime': 60, 'Disney+': 40, 'HBO Max': 40, Crunchyroll: 25,
  Restaurantes: 120, Delivery: 60, Café: 20, 'Fast Food': 40,
  Cine: 35, Concierto: 80, Bar: 60, Juego: 50, Deporte: 80,
  Alimento: 100, Veterinaria: 150, Accesorios: 80, Peluquería: 50,
  Ropa: 200, Calzado: 250,
  'Pasaje aéreo': 500, Hotel: 300, Alojamiento: 250, 'Alquiler auto': 200,
  Compras: 150, Regalos: 100, Hogar: 200, Tecnología: 300,
  Gimnasio: 99, Software: 50, Apps: 30, Membresía: 100
};

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, IconComponent],
  templateUrl: './review-requests.html',
  styleUrl: './review-requests.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReviewRequestsComponent implements OnInit {
  private historyService = inject(HistoryService);
  private reviewRequestService = inject(ReviewRequestService);
  private authService = inject(Auth);

  // Loading / Processing
  isLoading = signal(true);
  processing = signal(false);

  // Data signals
  allExpenses = signal<SolicitudRevision[]>([]);
  allExpensesIncludingInactive = signal<SolicitudRevision[]>([]);
  dailyTransactions = signal<RegistroHistorial[]>([]);

  // Tab & Filter state
  activeTab = signal<'primordial' | 'nonPrimordial'>('primordial');
  selectedCategory = signal('');

  // Computed
  primordialExpenses = computed(() =>
    this.allExpenses().filter(e => e.esPrioritaria)
  );

  nonPrimordialExpenses = computed(() =>
    this.allExpenses().filter(e => !e.esPrioritaria)
  );

  activeSources = computed(() => {
    const cat = this.selectedCategory();
    const pool = this.activeTab() === 'primordial'
      ? this.primordialExpenses()
      : this.nonPrimordialExpenses();
    if (!cat) return pool;
    return pool.filter(e => e.category === cat);
  });

  groupedWithSubcategories = computed(() => {
    const catGroups: Record<string, {
      category: string;
      total: number;
      subcategories: { subcategory: string; expenses: SolicitudRevision[]; total: number }[]
    }> = {};

    for (const exp of this.activeSources()) {
      if (!catGroups[exp.category]) {
        catGroups[exp.category] = { category: exp.category, total: 0, subcategories: [] };
      }
      const group = catGroups[exp.category];
      group.total += exp.budgetedAmount;
    }

    return Object.values(catGroups)
      .sort((a, b) => b.total - a.total)
      .map(g => {
        const subs = this.groupSubcategories(g.category);
        const count = subs.reduce((sum, s) => sum + s.expenses.length, 0);
        return { ...g, count, subcategories: subs };
      });
  });

  private groupSubcategories(category: string) {
    const items = this.activeSources().filter(e => e.category === category);
    const subs: Record<string, { subcategory: string; expenses: SolicitudRevision[]; total: number }> = {};
    for (const exp of items) {
      const key = exp.subcategory || '__none__';
      if (!subs[key]) {
        subs[key] = { subcategory: exp.subcategory || '', expenses: [], total: 0 };
      }
      subs[key].expenses.push(exp);
      subs[key].total += exp.budgetedAmount;
    }
    return Object.values(subs).sort((a, b) => b.total - a.total);
  }

  collapsedCategories = signal<Set<string>>(new Set());

  toggleCategory(cat: string) {
    this.collapsedCategories.update(s => {
      const ns = new Set(s);
      if (ns.has(cat)) ns.delete(cat); else ns.add(cat);
      return ns;
    });
  }

  categoryList = computed(() => {
    const pool = this.activeTab() === 'primordial'
      ? this.primordialExpenses()
      : this.nonPrimordialExpenses();
    const cats = new Set<string>();
    pool.forEach(e => cats.add(e.category));
    return Array.from(cats);
  });

  upcomingPayments = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentDay = today.getDate();
    return this.allExpenses()
      .filter(e => (e.fechaLimite || e.diaLimiteMes) && e.status !== 'paid' && e.status !== 'cancelled')
      .map(e => {
        let dueDay: number;
        let isOverdue: boolean;
        if (e.fechaLimite) {
          const d = new Date(e.fechaLimite + 'T12:00:00');
          dueDay = d.getDate();
          d.setHours(0, 0, 0, 0);
          isOverdue = today > d;
        } else {
          dueDay = e.diaLimiteMes!;
          isOverdue = currentDay > dueDay;
        }
        return {
          solicitudId: e.id,
          name: e.name,
          amount: e.budgetedAmount,
          fechaLimite: dueDay,
          isOverdue,
          category: e.category
        };
      })
      .sort((a, b) => a.fechaLimite - b.fechaLimite)
      .slice(0, 5);
  });

  // Stats
  totalPaid = signal(0);
  primordialPaid = signal(0);
  primordialBudgeted = signal(0);
  nonPrimordialPaid = signal(0);
  nonPrimordialBudgeted = signal(0);
  categoryBreakdown = signal<{ category: string; total: number; pct: number }[]>([]);

  // Pending expenses (not paid, not cancelled)
  pendingExpenses = computed(() =>
    this.allExpenses().filter(e => e.status !== 'paid' && e.status !== 'cancelled')
  );

  pendingBudgeted = computed(() =>
    this.pendingExpenses().reduce((sum, e) => sum + e.budgetedAmount, 0)
  );

  // Paid history grouped by category
  paidHistory = computed(() => {
    const paid = this.allExpensesIncludingInactive().filter(e => e.status === 'paid');

    const groups: Record<string, { category: string; expenses: SolicitudRevision[]; total: number }> = {};
    for (const exp of paid) {
      if (!groups[exp.category]) groups[exp.category] = { category: exp.category, expenses: [], total: 0 };
      groups[exp.category].expenses.push(exp);
      groups[exp.category].total += exp.actualAmount || exp.budgetedAmount;
    }
    return Object.values(groups).sort((a, b) => b.total - a.total);
  });

  // Modal state
  showModal = signal(false);
  editingExpense = signal<SolicitudRevision | null>(null);

  // Confirm modals
  showConfirmPaid = signal(false);
  confirmTarget = signal<SolicitudRevision | null>(null);
  confirmActualAmount = signal<number | null>(null);
  showDeleteAlert = signal(false);
  deleteTarget = signal<SolicitudRevision | null>(null);
  showEditWarning = signal(false);
  editWarningTarget = signal<SolicitudRevision | null>(null);
  showPaidHistory = signal(false);

  // Toast
  showToast = signal(false);
  toastMessage = signal('');
  toastType = signal<'success' | 'error' | 'warning'>('success');

  // Form fields
  formName = '';
  formAmount: number | null = null;
  formAvailableDate = signal('');
  formDueDate = signal('');
  formIsPrimordial = signal(true);
  formCategory = 'utilities';
  formSubcategory = '';
  formIsSubscription = false;
  formIsVariable = false;
  formDangerThreshold: number | null = null;
  formProvider = '';
  formNotes = '';

  // Smart fields
  formType = signal<ExpenseType>('mixed');
  formFirstPaymentDay = signal<number | null>(null);
  formHasDueDate = signal(true);

  // Metadata dinámico por subcategoría
  formMetadata = signal<Record<string, any>>({});
  metadataErrors = signal<Record<string, string>>({});

  // Computed: meta actual de la subcategoría seleccionada
  currentMeta = computed(() => SUBCATEGORY_META[this.formSubcategory] || null);

  // Computed: cantidad sugerido para la subcategoría actual
  suggestedAmount = computed(() => {
    const sub = this.formSubcategory;
    return sub ? (SUGGESTED_AMOUNTS[sub] ?? null) : null;
  });

  amountError = signal('');
  subcategoryError = signal('');
  dateError = signal('');
  firstPaymentDayError = signal('');

  // Computed: detected info text for badge
  detectedInfo = computed(() => {
    const meta = SUBCATEGORY_META[this.formSubcategory];
    if (!meta) return null;
    const parts: string[] = [];
    const typeLabels: Record<ExpenseType, string> = {
      'subscription': 'Suscripción',
      'variable': 'Cantidad variable',
      'fixed': 'Fijo mensual',
      'one-time': 'Solicitud único',
      'mixed': 'Flexible'
    };
    parts.push(typeLabels[meta.type]);
    const fpd = this.formFirstPaymentDay();
    if (fpd) {
      parts.push(`Día ${fpd}`);
    } else if (meta.typicalDueDay) {
      parts.push(`Típico día ${meta.typicalDueDay}`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  });

  private toDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Category helpers
  primordialCategoryKeys = Object.keys(TIPOS_PRIORITARIOS);
  nonPrimordialCategoryKeys = Object.keys(TIPOS_ORDINARIOS);
  categoryKeys = computed(() =>
    this.formIsPrimordial() ? this.primordialCategoryKeys : this.nonPrimordialCategoryKeys
  );

  categoryTotals = computed(() => {
    const totals: Record<string, number> = {};
    const pool = this.activeTab() === 'primordial'
      ? this.primordialExpenses()
      : this.nonPrimordialExpenses();
    for (const exp of pool) {
      totals[exp.category] = (totals[exp.category] || 0) + exp.budgetedAmount;
    }
    return totals;
  });

  now = signal(new Date());
  currentMonth = computed(() => this.now().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }));

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.now.set(new Date());
    this.isLoading.set(true);
    try {
      const activeExpenses = await this.reviewRequestService.getActive();
      this.allExpenses.set(activeExpenses);

      const allExpensesIncludingInactive = await this.reviewRequestService.getAll();
      this.allExpensesIncludingInactive.set(allExpensesIncludingInactive);

      const recurringExpenses = allExpensesIncludingInactive.filter(e => e.isRecurring && e.frequency === 'monthly');
      if (recurringExpenses.length > 0) {
        await this.reviewRequestService.renovarSolicitudesPeriodicas(recurringExpenses);
        const refreshed = await this.reviewRequestService.getActive();
        this.allExpenses.set(refreshed);
      }

      this.calculatePrimordialBreakdown();

      const currentMonthExpenses = await this.historyService.getPorPeriodo(
        this.now().getFullYear(),
        this.now().getMonth() + 1
      );

      const expensesOnly = currentMonthExpenses.filter(t => t.type === 'expense');
      this.dailyTransactions.set(expensesOnly);

      this.calculateCategoryBreakdown(expensesOnly);
    } finally {
      this.isLoading.set(false);
    }
  }

  calculatePrimordialBreakdown() {
    let pPaid = 0;
    let pBudgeted = 0;
    let npPaid = 0;
    let npBudgeted = 0;

    this.allExpensesIncludingInactive().forEach(expense => {
      const amount = expense.actualAmount || expense.budgetedAmount;
      if (expense.esPrioritaria) {
        pBudgeted += expense.budgetedAmount;
        if (expense.status === 'paid') pPaid += amount;
      } else {
        npBudgeted += expense.budgetedAmount;
        if (expense.status === 'paid') npPaid += amount;
      }
    });

    this.primordialPaid.set(pPaid);
    this.primordialBudgeted.set(pBudgeted);
    this.nonPrimordialPaid.set(npPaid);
    this.nonPrimordialBudgeted.set(npBudgeted);
    this.totalPaid.set(pPaid + npPaid);
  }

  calculateCategoryBreakdown(expenses: RegistroHistorial[]) {
    const catTotals: Record<string, number> = {};

    expenses.forEach(expense => {
      const catId = expense.categoryId || 'other';
      catTotals[catId] = (catTotals[catId] || 0) + Math.abs(expense.amount);
    });

    this.categoryBreakdown.set(Object.entries(catTotals)
      .map(([category, total]) => ({
        category,
        total,
        pct: this.totalPaid() > 0 ? (total / this.totalPaid()) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total)
    );
  }

  formatSol(n: number): string {
    return `${(n || 0).toFixed(2)}`;
  }

  absAmount(n: number): number {
    return Math.abs(n);
  }

  onAmountInput(val: any) {
    this.amountError.set('');
    if (val === '' || val === null || val === undefined) {
      this.formAmount = null;
      return;
    }
    const str = String(val);
    if (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(str)) {
      this.formAmount = null;
      this.amountError.set('No es un cantidad válido');
      return;
    }
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num >= 0) {
      this.formAmount = num;
    } else {
      this.formAmount = null;
      this.amountError.set('No es un cantidad válido');
    }
  }

  getCategoryIcon(category: string): string {
    return CATEGORY_ICONS[category] || 'package';
  }

  getEtiquetaCategoria(category: string): string {
    return CATEGORY_LABELS[category] || category;
  }

  getCategoryColor(cat: string): string {
    return CATEGORY_COLORS[cat] || '#64748b';
  }

  getAvailableSubcategories(): string[] {
    return DETALLES_POR_TIPO[this.formCategory] || [];
  }

  getSubcategoryIcon(sub: string): string {
    return SUBCATEGORY_ICONS[sub] || 'package';
  }

  canDeleteExpense(exp: SolicitudRevision): boolean {
    if (exp.status === 'paid') return false;
    if (exp.status === 'cancelled') return false;
    const meta = SUBCATEGORY_META[exp.subcategory || ''];
    if (meta?.type === 'one-time') return false;
    return true;
  }

  onSubcategorySelect(sub: string) {
    this.formSubcategory = sub;
    this.subcategoryError.set('');
    this.formMetadata.set({});
    this.metadataErrors.set({});
    if (!this.editingExpense()) {
      this.formName = sub;
      const meta = SUBCATEGORY_META[sub];
      if (meta) {
        this.formIsSubscription = meta.type === 'subscription';
        this.formIsVariable = meta.type === 'variable';
        this.formType.set(meta.type);
        this.formHasDueDate.set(meta.hasDueDate);
        this.formFirstPaymentDay.set(meta.typicalDueDay || null);
        if (meta.hasDueDate && meta.typicalDueDay) {
          const today = new Date();
          const avail = new Date(today.getFullYear(), today.getMonth(), meta.typicalDueDay);
          if (avail < today) avail.setMonth(avail.getMonth() + 1);
          this.formAvailableDate.set(this.toDateString(avail));
          const due = new Date(avail);
          due.setDate(Math.min(meta.typicalDueDay + 15, 28));
          this.formDueDate.set(this.toDateString(due));
        }
      } else {
        this.formIsSubscription = false;
        this.formIsVariable = false;
        this.formType.set('mixed');
        this.formHasDueDate.set(false);
        this.formFirstPaymentDay.set(null);
      }
      const provider = PROVIDER_BY_SUBCATEGORY[sub];
      if (provider) this.formProvider = provider;
      else this.formProvider = '';
      const suggested = SUGGESTED_AMOUNTS[sub];
      if (suggested) this.formAmount = suggested;
      else this.formAmount = null;
    }
  }

  onTypeChange(type: ExpenseType) {
    this.formType.set(type);
    this.formIsSubscription = type === 'subscription';
    this.formIsVariable = type === 'variable';
  }

  onFirstPaymentDayChange(val: any) {
    this.firstPaymentDayError.set('');
    if (val === '' || val === null || val === undefined) {
      this.formFirstPaymentDay.set(null);
      return;
    }
    const num = parseInt(String(val), 10);
    if (isNaN(num) || num < 1 || num > 31) {
      this.firstPaymentDayError.set('Día inválido (1-31)');
      this.formFirstPaymentDay.set(null);
    } else {
      this.formFirstPaymentDay.set(num);
    }
  }

  onHasDueDateToggle(has: boolean) {
    this.formHasDueDate.set(has);
    this.dateError.set('');
  }

  // ── Metadata helpers ──

  onMetadataChange(key: string, value: any) {
    this.formMetadata.update(m => ({ ...m, [key]: value }));
    const errs = { ...this.metadataErrors() };
    delete errs[key];
    this.metadataErrors.set(errs);
  }

  getMetadataTags(exp: SolicitudRevision): string[] {
    const meta = exp.metadata;
    if (!meta) return [];
    const fields = SUBCATEGORY_META[exp.subcategory || '']?.metadataFields;
    if (!fields) return [];
    return fields
      .filter(f => meta[f.key] && f.type !== 'boolean')
      .map(f => String(meta[f.key]))
      .slice(0, 3);
  }

  metadataCount(key: string, value: string): number {
    return this.allExpenses()
      .filter(e => e.metadata?.[key] === value).length;
  }

  validateMetadata(): boolean {
    const meta = this.currentMeta();
    if (!meta?.metadataFields) return true;
    const errors: Record<string, string> = {};
    for (const field of meta.metadataFields) {
      if (field.required) {
        const val = this.formMetadata()[field.key];
        if (!val || val === '') {
          errors[field.key] = `${field.label} es obligatorio`;
        }
      }
    }
    this.metadataErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  getEtiquetaTipo(type: ExpenseType): string {
    const labels: Record<ExpenseType, string> = {
      'subscription': 'Suscripción',
      'variable': 'Variable',
      'fixed': 'Fijo',
      'one-time': 'Único',
      'mixed': 'Flexible'
    };
    return labels[type] || type;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'paid': 'Pagado',
      'pending': 'Falta pagar',
      'partial': 'Parcial',
      'overdue': 'Vencido',
      'cancelled': 'Cancelado'
    };
    return labels[status] || status;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'paid': return '#2FA46A';
      case 'pending': return '#f59e0b';
      case 'overdue': return '#ef4444';
      case 'cancelled': return '#64748b';
      default: return '#64748b';
    }
  }

  // ── Confirm Paid ──
  openConfirmPaid(expense: SolicitudRevision) {
    this.confirmTarget.set(expense);
    this.confirmActualAmount.set(expense.budgetedAmount);
    this.showConfirmPaid.set(true);
  }

  closeConfirmPaid() {
    this.showConfirmPaid.set(false);
    this.confirmTarget.set(null);
    this.confirmActualAmount.set(null);
  }

  isVariableExpense(): boolean {
    const exp = this.confirmTarget();
    return !!exp?.isVariable;
  }

  onConfirmAmountInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    const num = parseFloat(val);
    this.confirmActualAmount.set(isNaN(num) ? null : num);
  }

  async confirmMarkPaid() {
    if (this.processing()) return;
    this.processing.set(true);
    const expense = this.confirmTarget();
    if (!expense) { this.processing.set(false); return; }
    try {
      const amount = this.confirmActualAmount() ?? expense.budgetedAmount;
      await this.reviewRequestService.marcarAtendida(expense.id, amount);

      // Variable spike alert
      if (expense.isVariable && expense.umbralAlerta && expense.budgetedAmount) {
        const limit = expense.budgetedAmount * (1 + expense.umbralAlerta / 100);
        if (amount > limit) {
          this.showWarningToast(`⚠️ ${expense.name}: ${amount} supera umbral de ${limit.toFixed(2)} (${expense.umbralAlerta}%)`);
        }
      }

      // Crear registro negativa para que aparezca en dashboard
      const today = this.toDateString(new Date());
      const tx = await this.historyService.create({
        amount: -Math.abs(amount),
        description: expense.name,
        date: today,
        type: 'expense',
        categoryId: expense.category || null
      });

      // Guardar registroId en el expense
      if (tx?.id) {
        await this.reviewRequestService.update(expense.id, { registroId: tx.id } as any);
      }

      this.closeConfirmPaid();
      await this.loadData();
    } catch (e) {
      console.error('Error marking as paid:', e);
    } finally {
      this.processing.set(false);
    }
  }

  // ── Delete Alert ──
  openDeleteAlert(expense: SolicitudRevision) {
    this.deleteTarget.set(expense);
    this.showDeleteAlert.set(true);
  }

  closeDeleteAlert() {
    this.showDeleteAlert.set(false);
    this.deleteTarget.set(null);
  }

  async confirmDelete() {
    if (this.processing()) return;
    this.processing.set(true);
    const expense = this.deleteTarget();
    if (!expense) { this.processing.set(false); return; }
    try {
      // Si el solicitud tenía una registro asociada, eliminarla
      if (expense.registroId) {
        await this.historyService.delete(expense.registroId).catch(() => {});
      }
      await this.reviewRequestService.cancel(expense.id);
      this.closeDeleteAlert();
      await this.loadData();
    } catch (e) {
      console.error('Error deleting expense:', e);
    } finally {
      this.processing.set(false);
    }
  }

  // ── Edit Warning ──
  openEditExpense(expense: SolicitudRevision) {
    if (expense.status === 'paid') {
      this.editWarningTarget.set(expense);
      this.showEditWarning.set(true);
    } else {
      this.openEditModal(expense);
    }
  }

  closeEditWarning() {
    this.showEditWarning.set(false);
    this.editWarningTarget.set(null);
  }

  proceedEdit() {
    const target = this.editWarningTarget();
    this.closeEditWarning();
    if (target) this.openEditModal(target);
  }

  openPaidHistory() {
    this.showPaidHistory.set(true);
  }

  closePaidHistory() {
    this.showPaidHistory.set(false);
  }

  async updateExpenseNote(expense: SolicitudRevision, event: Event) {
    const input = event.target as HTMLInputElement;
    const newNotes = input.value.trim();
    if (newNotes === (expense.notes || '')) return;
    try {
      await this.reviewRequestService.update(expense.id, { notes: newNotes || undefined });
      await this.loadData();
    } catch (e) {
      console.error('Error updating note:', e);
    }
  }

  // ── Modal ──
  openAddModal() {
    const today = this.toDateString(new Date());
    this.editingExpense.set(null);
    this.formName = '';
    this.formAmount = null;
    this.formAvailableDate.set(today);
    this.formDueDate.set(today);
    this.formIsPrimordial.set(true);
    this.formCategory = 'utilities';
    this.formSubcategory = '';
    this.formIsSubscription = false;
    this.formIsVariable = false;
    this.formProvider = '';
    this.formNotes = '';
    this.formType.set('mixed');
    this.formFirstPaymentDay.set(null);
    this.formHasDueDate.set(false);
    this.formMetadata.set({});
    this.metadataErrors.set({});
    this.amountError.set('');
    this.subcategoryError.set('');
    this.dateError.set('');
    this.firstPaymentDayError.set('');
    this.showModal.set(true);
  }

  onPrimordialToggle(esPrioritaria: boolean) {
    this.formIsPrimordial.set(esPrioritaria);
    const keys = esPrioritaria ? this.primordialCategoryKeys : this.nonPrimordialCategoryKeys;
    if (!keys.includes(this.formCategory)) {
      this.formCategory = keys[0];
      this.onCategoryChange(this.formCategory);
    }
  }

  onCategoryChange(cat: string) {
    this.formCategory = cat;
    this.formSubcategory = '';
    this.subcategoryError.set('');
  }

  openEditModal(expense: SolicitudRevision) {
    const today = this.toDateString(new Date());
    this.editingExpense.set(expense);
    this.formName = expense.name;
    this.formAmount = expense.budgetedAmount;
    if (expense.fechaDisponible) {
      this.formAvailableDate.set(expense.fechaDisponible);
    } else if (expense.diaLimiteMes) {
      const d = new Date();
      d.setDate(expense.diaLimiteMes);
      this.formAvailableDate.set(this.toDateString(d));
    } else {
      this.formAvailableDate.set(today);
    }
    if (expense.fechaLimite) {
      this.formDueDate.set(expense.fechaLimite);
    } else if (expense.diaLimiteMes) {
      const d = new Date();
      d.setDate(expense.diaLimiteMes);
      this.formDueDate.set(this.toDateString(d));
    } else {
      this.formDueDate.set(today);
    }
    this.formIsPrimordial.set(expense.esPrioritaria);
    this.formCategory = expense.category;
    this.formSubcategory = expense.subcategory || '';
    this.formIsSubscription = expense.esReincidente || false;
    this.formIsVariable = expense.isVariable || false;
    this.formDangerThreshold = expense.umbralAlerta || null;
    this.formProvider = expense.provider || '';
    this.formNotes = expense.notes || '';
    // Smart fields
    const meta = SUBCATEGORY_META[expense.subcategory || ''];
    this.formType.set(meta?.type || (expense.esReincidente ? 'subscription' : expense.isVariable ? 'variable' : 'mixed'));
    this.formFirstPaymentDay.set(expense.diaLimiteMes || meta?.typicalDueDay || null);
    this.formHasDueDate.set(meta?.hasDueDate ?? !!(expense.fechaLimite || expense.diaLimiteMes));
    // Metadata
    this.formMetadata.set(expense.metadata ? { ...expense.metadata } : {});
    this.metadataErrors.set({});
    this.amountError.set('');
    this.subcategoryError.set('');
    this.dateError.set('');
    this.firstPaymentDayError.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingExpense.set(null);
  }

  async saveExpense() {
    if (this.processing()) return;
    if (!this.formName || this.formAmount == null) return;
    if (!this.formSubcategory) {
      this.subcategoryError.set('Selecciona una subcategoría');
      return;
    }
    // Validar metadata requerida
    if (!this.validateMetadata()) return;
    const hasDueDate = this.formHasDueDate();
    const fpd = this.formFirstPaymentDay();
    if (hasDueDate && !fpd) {
      this.firstPaymentDayError.set('Ingresa el día del primer pago');
      return;
    }
    if (fpd && (fpd < 1 || fpd > 31)) {
      this.firstPaymentDayError.set('Día inválido (1-31)');
      return;
    }
    const fechaDisponible = hasDueDate ? this.formAvailableDate() : '';
    const fechaLimite = hasDueDate ? this.formDueDate() : '';
    if (hasDueDate && (!fechaDisponible || !fechaLimite)) {
      this.dateError.set('Selecciona ambas fechas');
      return;
    }
    if (hasDueDate && fechaDisponible > fechaLimite) {
      this.dateError.set('La fecha de vencimiento debe ser igual o posterior a la fecha de inicio');
      return;
    }
    this.dateError.set('');
    this.firstPaymentDayError.set('');
    const amount = this.formAmount;
    const dueDay = fpd || null;

    // Sync esReincidente/isVariable from formType
    const type = this.formType();
    this.formIsSubscription = type === 'subscription';
    this.formIsVariable = type === 'variable';

    const umbralAlerta = this.formIsVariable && this.formDangerThreshold ? this.formDangerThreshold : undefined;

    // Auto-paid para solicitudes one-time o sin fecha
    const isInstant = type === 'one-time' || !hasDueDate;
    const today = this.toDateString(new Date());

    // Metadata: solo si tiene campos
    const metaKeys = Object.keys(this.formMetadata());
    const metadata = metaKeys.length > 0 ? { ...this.formMetadata() } : undefined;

    try {
      const editing = this.editingExpense();

      if (editing) {
        const updateData: Partial<SolicitudRevisionPayload> = {
          name: this.formName,
          budgetedAmount: amount,
          diaLimiteMes: dueDay,
          esReincidente: this.formIsSubscription,
          isVariable: this.formIsVariable,
          subcategory: this.formSubcategory || '',
          provider: this.formProvider,
          notes: this.formNotes,
          metadata
        };
        if (fechaDisponible) updateData.fechaDisponible = fechaDisponible;
        if (fechaLimite) updateData.fechaLimite = fechaLimite;
        if (umbralAlerta != null) updateData.umbralAlerta = umbralAlerta;
        await this.reviewRequestService.update(editing.id, updateData);
      } else {
        const createData: SolicitudRevisionPayload = {
          name: this.formName,
          budgetedAmount: amount,
          diaLimiteMes: dueDay,
          esPrioritaria: this.formIsPrimordial(),
          category: this.formCategory as any,
          subcategory: this.formSubcategory || '',
          esReincidente: this.formIsSubscription,
          isVariable: this.formIsVariable,
          isRecurring: true,
          frequency: 'monthly',
          provider: this.formProvider,
          notes: this.formNotes
        };
        if (fechaDisponible) createData.fechaDisponible = fechaDisponible;
        if (fechaLimite) createData.fechaLimite = fechaLimite;
        if (umbralAlerta != null) createData.umbralAlerta = umbralAlerta;

        const result = await this.reviewRequestService.create(createData);

        // Auto-paid instant expense
        if (isInstant && result?.id) {
          await this.reviewRequestService.marcarAtendida(result.id, amount);

          // Crear registro negativa para dashboard
          const tx = await this.historyService.create({
            amount: -Math.abs(amount),
            description: this.formName,
            date: today,
            type: 'expense',
            categoryId: this.formCategory || null
          });
          if (tx?.id) {
            await this.reviewRequestService.update(result.id, { registroId: tx.id } as any);
          }

          // Guardar metadata después de marcar como pagado
          if (metadata) {
            await this.reviewRequestService.update(result.id, { metadata } as any);
          }
        } else if (metadata && result?.id) {
          await this.reviewRequestService.update(result.id, { metadata } as any);
        }
      }

      this.closeModal();
      await this.loadData();
    } catch (e) {
      console.error('Error saving expense:', e);
    }
  }

  // ── Toast ──
  showSuccessToast(message: string) {
    this.toastMessage.set(message);
    this.toastType.set('success');
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 3500);
  }

  showWarningToast(message: string) {
    this.toastMessage.set(message);
    this.toastType.set('warning');
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 4500);
  }

  showErrorToast(message: string) {
    this.toastMessage.set(message);
    this.toastType.set('error');
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 4500);
  }

  closeToast() {
    this.showToast.set(false);
  }
}
