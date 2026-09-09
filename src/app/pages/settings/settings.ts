import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth } from '../../core/services/auth';
import { DevSettingsService } from '../../core/services/dev-settings';
import { BrandingService } from '../../core/services/branding';
import { TenantService } from '../../core/services/tenant';
import { Permiso } from '../../core/models/rbac.model';
import {
  seLeeTalCual, ajusteAplicado, esColorValido
} from '../../core/models/brand.model';
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
  marca = inject(BrandingService);
  private tenant = inject(TenantService);

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
  // ---- Marca ----
  editandoMarca = signal(false);
  guardandoMarca = signal(false);
  errorMarca = signal('');
  subiendoLogo = signal(false);

  mPrimario   = signal('');
  mSecundario = signal('');

  /** Solo quien administra cambia lo que ven los demas. */
  puedeEditarMarca = computed(() => this.tenant.puede(Permiso.EMPRESA_EDITAR));

  /**
   * Si el color elegido se lee tal cual en cada tema.
   *
   * Se ensena mientras se elige, no despues: descubrir que tu marca se
   * ha aclarado un treinta por ciento al verla puesta es peor que
   * saberlo al elegirla.
   */
  avisoClaro = computed(() => this.avisoDe('claro'));
  avisoOscuro = computed(() => this.avisoDe('oscuro'));

  private avisoDe(tema: 'claro' | 'oscuro'): string | null {
    const c = this.mPrimario();
    if (!c || !esColorValido(c)) return null;
    if (seLeeTalCual(c, tema)) return null;

    const ajuste = ajusteAplicado(c, tema);
    return `En tema ${tema} se aclara un ${ajuste}% para que se lea.`;
  }

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
  // MARCA
  // ------------------------------------------

  abrirMarca() {
    const m = this.marca.marca();
    this.mPrimario.set(m.colorPrimario ?? '');
    this.mSecundario.set(m.colorSecundario ?? '');
    this.errorMarca.set('');
    this.editandoMarca.set(true);
  }

  cerrarMarca() {
    if (this.guardandoMarca()) return;
    // Deshace la previsualizacion: lo que no se guarda, no se queda.
    this.marca.cancelarPrevisualizacion();
    this.editandoMarca.set(false);
  }

  /**
   * Pinta el color sobre la aplicacion real segun se escribe.
   *
   * Sobre la aplicacion y no sobre una muestra: un color se juzga
   * viendolo en los botones, los enlaces y los bordes que va a tenir,
   * no en una pastilla de dos centimetros.
   */
  previsualizar() {
    const primario = this.mPrimario().trim();
    if (!primario || !esColorValido(primario)) return;

    this.marca.previsualizar({
      ...this.marca.marca(),
      colorPrimario: primario,
      colorSecundario: this.mSecundario().trim() || undefined
    });
  }

  async guardarMarca() {
    if (this.guardandoMarca()) return;

    this.guardandoMarca.set(true);
    this.errorMarca.set('');
    try {
      await this.marca.guardar({
        colorPrimario: this.mPrimario().trim() || undefined,
        colorSecundario: this.mSecundario().trim() || undefined
      });
      this.editandoMarca.set(false);
    } catch (e: any) {
      this.errorMarca.set(e?.message ?? 'No se pudo guardar la marca.');
    } finally {
      this.guardandoMarca.set(false);
    }
  }

  async onLogo(e: Event) {
    const input = e.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    this.subiendoLogo.set(true);
    this.errorMarca.set('');
    try {
      await this.marca.guardarLogo(archivo);
    } catch (err: any) {
      this.errorMarca.set(err?.message ?? 'No se pudo guardar el logo.');
    } finally {
      this.subiendoLogo.set(false);
      // Permite volver a elegir el mismo archivo tras corregirlo.
      input.value = '';
    }
  }

  async quitarLogo() {
    this.errorMarca.set('');
    try {
      await this.marca.quitarLogo();
    } catch (e: any) {
      this.errorMarca.set(e?.message ?? 'No se pudo quitar el logo.');
    }
  }

  async restablecerMarca() {
    this.errorMarca.set('');
    try {
      await this.marca.guardar({ colorPrimario: undefined, colorSecundario: undefined });
      this.mPrimario.set('');
      this.mSecundario.set('');
    } catch (e: any) {
      this.errorMarca.set(e?.message ?? 'No se pudo restablecer.');
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
