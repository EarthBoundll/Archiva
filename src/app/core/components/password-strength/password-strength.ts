import { Component, Input, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-password-strength',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="strength-container">
      <div class="strength-bar">
        <div 
          class="strength-bar__fill" 
          [style.width.%]="strength().percent"
          [class]="strength().level"
        ></div>
      </div>
      <div class="strength-label">
        <span [class]="strength().level">{{ strength().label }}</span>
      </div>
      <ul class="requirements">
        <li [class.met]="hasMinLength()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            @if (hasMinLength()) {
              <polyline points="20 6 9 17 4 12"/>
            } @else {
              <circle cx="12" cy="12" r="1"/>
            }
          </svg>
          Mínimo 8 caracteres
        </li>
        <li [class.met]="hasNumber()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            @if (hasNumber()) {
              <polyline points="20 6 9 17 4 12"/>
            } @else {
              <circle cx="12" cy="12" r="1"/>
            }
          </svg>
          Al menos un número
        </li>
        <li [class.met]="hasUppercase()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            @if (hasUppercase()) {
              <polyline points="20 6 9 17 4 12"/>
            } @else {
              <circle cx="12" cy="12" r="1"/>
            }
          </svg>
          Una mayúscula
        </li>
      </ul>
    </div>
  `,
  styleUrl: './password-strength.scss'
})
export class PasswordStrengthComponent implements OnInit {
  @Input() password = '';

  private _password = signal('');

  ngOnInit() {
    this._password.set(this.password);
  }

  ngOnChanges() {
    this._password.set(this.password);
  }

  hasMinLength = computed(() => this._password().length >= 8);
  hasNumber = computed(() => /\d/.test(this._password()));
  hasUppercase = computed(() => /[A-Z]/.test(this._password()));

  strength = computed(() => {
    const pwd = this._password();
    if (!pwd) return { percent: 0, level: 'empty', label: '' };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (/\d/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score === 0) return { percent: 0, level: 'empty', label: '' };
    if (score === 1) return { percent: 33, level: 'weak', label: 'Débil' };
    if (score === 2) return { percent: 66, level: 'medium', label: 'Media' };
    if (score === 3) return { percent: 85, level: 'good', label: 'Buena' };
    return { percent: 100, level: 'strong', label: 'Excelente' };
  });
}