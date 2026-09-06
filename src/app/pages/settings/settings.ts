import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth } from '../../core/services/auth';
import { DevSettingsService } from '../../core/services/dev-settings';
import { CompanyService } from '../../core/services/company';
import { IconComponent } from '../../core/components/icon/icon.component';
import { DialogoDirective } from '../../core/directives/dialogo.directive';
import { SELLO_COMPILACION } from '../../core/utils/sello';
import {
  Empresa,
  SectorEmpresa,
  validarEmpresa,
  esPrefijoValido,
  esRucValido
} from '../../core/models/company.model';
import { AreaEmisora } from '../../core/models/document.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, IconComponent, DialogoDirective],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent implements OnInit {
  private auth = inject(Auth);
  company = inject(CompanyService);
  dev = inject(DevSettingsService);

  sello = SELLO_COMPILACION;

  cargando = signal(true);
  guardando = signal(false);
  errorForm = signal('');
  guardado  = signal(false);

  /** true mientras el formulario de empresa está abierto. */
  editando = signal(false);

  empresa = this.company.empresa;

  // Campos del formulario
  fRazon      = signal('');
  fRuc        = signal('');
  fSector     = signal<SectorEmpresa>('otro');
  fArea       = signal<AreaEmisora>('administracion');
  fResponsable = signal('');
  fPrefijo    = signal('');
  fDiasAlerta = signal(30);

  sectores = this.company.getSectores();
  areas    = this.company.getAreas();

  /** Ejemplo vivo del código que se generará con el prefijo escrito. */
  ejemploCodigo = computed(() => {
    const p = this.fPrefijo().trim().toUpperCase();
    return `CON-${esPrefijoValido(p) ? p : '···'}-0001`;
  });

  prefijoValido = computed(() => esPrefijoValido(this.fPrefijo()));
  rucValido     = computed(() => esRucValido(this.fRuc()));

  // Cierre de sesión
  confirmandoSalida = signal(false);
  saliendo = signal(false);

  get userEmail(): string { return this.auth.currentUser()?.email ?? '—'; }
  get userName(): string  { return this.auth.currentUser()?.displayName ?? 'Responsable de archivo'; }

  async ngOnInit() {
    this.cargando.set(true);
    try {
      await this.company.cargar();
      this.rellenar();
    } finally {
      this.cargando.set(false);
    }
  }

  // ------------------------------------------
  // EDICION
  // ------------------------------------------

  private rellenar() {
    const e = this.company.actual();
    this.fRazon.set(e.razonSocial);
    this.fRuc.set(e.ruc);
    this.fSector.set(e.sector);
    this.fArea.set(e.areaArchivo);
    this.fResponsable.set(e.responsableArchivo || this.userName);
    this.fPrefijo.set(e.prefijoCodificacion);
    this.fDiasAlerta.set(e.diasAlertaPorDefecto);
  }

  abrirEdicion() {
    this.rellenar();
    this.errorForm.set('');
    this.editando.set(true);
  }

  cerrarEdicion() {
    if (this.guardando()) return;
    this.editando.set(false);
  }

  /** Al elegir área se propone su prefijo, sin pisar lo ya escrito. */
  cambiarArea(area: AreaEmisora) {
    this.fArea.set(area);
    if (!this.fPrefijo().trim()) {
      this.fPrefijo.set(this.company.sugerirPrefijo(area));
    }
  }

  async guardar() {
    if (this.guardando()) return;

    const datos: Partial<Empresa> = {
      razonSocial: this.fRazon(),
      ruc: this.fRuc(),
      sector: this.fSector(),
      areaArchivo: this.fArea(),
      responsableArchivo: this.fResponsable(),
      prefijoCodificacion: this.fPrefijo(),
      diasAlertaPorDefecto: Number(this.fDiasAlerta())
    };

    const invalido = validarEmpresa({ ...this.company.actual(), ...datos });
    if (invalido) { this.errorForm.set(invalido); return; }

    this.guardando.set(true);
    this.errorForm.set('');
    try {
      await this.company.guardar(datos);
      this.editando.set(false);
      this.guardado.set(true);
      setTimeout(() => this.guardado.set(false), 3000);
    } catch (e: any) {
      this.errorForm.set(e?.message ?? 'No se pudo guardar la configuración.');
    } finally {
      this.guardando.set(false);
    }
  }

  // ------------------------------------------
  // PRESENTACION
  // ------------------------------------------

  etiquetaSector(s: SectorEmpresa): string {
    return this.sectores.find(x => x.value === s)?.label ?? s;
  }

  etiquetaArea(a: AreaEmisora): string {
    return this.areas.find(x => x.value === a)?.label ?? a;
  }

  /** Texto para un campo aún sin rellenar. */
  oVacio(valor: string): string {
    return valor?.trim() || 'Sin definir';
  }

  // ------------------------------------------
  // CIERRE DE SESION
  // ------------------------------------------

  pedirCierre() {
    this.confirmandoSalida.set(true);
  }

  async confirmarCierre() {
    if (this.saliendo()) return;
    this.saliendo.set(true);
    try {
      await this.auth.signOut();
    } finally {
      this.saliendo.set(false);
      this.confirmandoSalida.set(false);
    }
  }
}
