import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MigrationService } from '../../core/services/migration.service';

@Component({
  selector: 'app-data-migration',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="migration-page">
      <h2>Migración de Datos</h2>
      
      @if (isChecking()) {
        <div class="loading">Verificando datos antiguos...</div>
      } @else {
        
        @if (alreadyMigrated) {
          <div class="success-box">
            <h3>Migración Completada</h3>
            <p>Tus datos ya fueron migrados exitosamente.</p>
          </div>
        } @else {
          
          <div class="status-box">
            <h3>Datos Encontrados</h3>
            
            @if (legacyStatus.hasLegacyTransactions) {
              <div class="item">
                <span class="icon">TX</span>
                <span>{{ legacyStatus.legacyTransactionCount }} registros antiguas</span>
              </div>
            }
            
            @if (legacyStatus.hasLegacyGoals) {
              <div class="item">
                <span class="icon">Meta</span>
                <span>{{ legacyStatus.legacyGoalCount }} meta(s) antigua(s)</span>
              </div>
            }
            
            @if (legacyStatus.hasLegacyCategories) {
              <div class="item">
                <span class="icon">Cat</span>
                <span>Categorías antiguas encontradas</span>
              </div>
            }
            
            @if (!legacyStatus.hasLegacyTransactions && !legacyStatus.hasLegacyGoals && !legacyStatus.hasLegacyCategories) {
              <p>No se encontraron datos antiguos. Todo está actualizado.</p>
            }
          </div>
          
          @if (legacyStatus.hasLegacyTransactions || legacyStatus.hasLegacyGoals) {
            <button 
              class="btn-migrate" 
              (click)="runMigration()" 
              [disabled]="isMigrating()"
            >
              @if (isMigrating()) {
                <span>Migrando... {{ progress }}</span>
              } @else {
                <span>Iniciar Migración</span>
              }
            </button>
          }
        }
        
        @if (result) {
          <div class="result-box">
            <h3>Resultado</h3>
            
            @if (result.transactions.migrated > 0) {
              <p>{{ result.transactions.migrated }} registros migradas</p>
            }
            
            @if (result.goals.migrated > 0) {
              <p>{{ result.goals.migrated }} meta(s) migrada(s)</p>
            }
            
            @if (result.transactions.errors.length > 0 || result.goals.errors.length > 0) {
              <div class="errors">
                <h4>Errores:</h4>
                @for (error of result.transactions.errors; track error) {
                  <p class="error">{{ error }}</p>
                }
                @for (error of result.goals.errors; track error) {
                  <p class="error">{{ error }}</p>
                }
              </div>
            }
            
            @if (result.completed) {
              <p class="success">¡Migración completada!</p>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .migration-page {
      padding: 2rem;
      max-width: 600px;
      margin: 0 auto;
    }
    
    h2 {
      color: var(--color-text);
      margin-bottom: 2rem;
    }
    
    .loading {
      text-align: center;
      padding: 2rem;
      color: var(--color-text-muted);
    }
    
    .status-box, .result-box, .success-box {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border: 1px solid var(--color-border);
    }
    
    .item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--color-border);
    }
    
    .item:last-child {
      border-bottom: none;
    }
    
    .icon {
      font-size: 1.5rem;
    }
    
    .btn-migrate {
      width: 100%;
      padding: 1rem;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: var(--radius-md);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 150ms;
    }
    
    .btn-migrate:hover:not(:disabled) {
      background: var(--color-accent);
    }
    
    .btn-migrate:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .success {
      color: var(--color-accent);
      font-weight: 600;
      margin-top: 1rem;
    }
    
    .errors {
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(239, 68, 68, 0.1);
      border-radius: var(--radius-md);
    }
    
    .error {
      color: #ef4444;
      font-size: 0.875rem;
      margin: 0.25rem 0;
    }
  `]
})
export class DataMigrationComponent implements OnInit {
  private migrationService = inject(MigrationService);
  
  isChecking = signal(true);
  isMigrating = signal(false);
  alreadyMigrated = false;
  progress = '';
  
  legacyStatus = {
    hasLegacyTransactions: false,
    hasLegacyGoals: false,
    hasLegacyCategories: false,
    legacyTransactionCount: 0,
    legacyGoalCount: 0
  };
  
  result: any = null;
  
  async ngOnInit() {
    await this.checkStatus();
  }
  
  async checkStatus() {
    this.isChecking.set(true);
    try {
      this.alreadyMigrated = await this.migrationService.isAlreadyMigrated();
      this.legacyStatus = await this.migrationService.checkLegacyData();
    } finally {
      this.isChecking.set(false);
    }
  }
  
  async runMigration() {
    this.isMigrating.set(true);
    this.result = null;
    
    try {
      this.progress = 'Migrando registros...';
      const txResult = await this.migrationService.migrateTransactions();
      
      this.progress = 'Migrando metas...';
      const goalResult = await this.migrationService.migrateGoals();
      
      this.result = {
        transactions: txResult,
        goals: goalResult,
        completed: true
      };
      
      this.alreadyMigrated = true;
    } catch (e: any) {
      this.result = {
        transactions: { migrated: 0, errors: [e.message] },
        goals: { migrated: 0, errors: [] },
        completed: false
      };
    } finally {
      this.isMigrating.set(false);
      this.progress = '';
    }
  }
}
