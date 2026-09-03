import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LUCIDE_ICONS, BRAND_ICONS } from '../../utils/lucide-icons';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      [attr.fill]="isBrand ? 'none' : 'none'"
      [attr.stroke]="isBrand ? 'none' : 'currentColor'"
      [attr.stroke-width]="isBrand ? '0' : '2'"
      stroke-linecap="round"
      stroke-linejoin="round"
      [innerHTML]="svgContent"
    ></svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 0;
    }
    svg {
      display: block;
    }
  `]
})
export class IconComponent {
  private sanitizer = inject(DomSanitizer);

  @Input() name = '';
  @Input() size: number | string = 16;

  get isBrand(): boolean {
    return this.name.startsWith('brand-');
  }

  get svgContent(): SafeHtml {
    const raw = this.isBrand ? BRAND_ICONS[this.name] : LUCIDE_ICONS[this.name];
    if (!raw) return '';
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  }
}
