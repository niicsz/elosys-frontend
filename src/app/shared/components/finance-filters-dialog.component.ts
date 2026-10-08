import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DialogFrameComponent } from './dialog-frame.component';

export interface FinanceFilters {
  q: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  amountMin: string;
  amountMax: string;
  onlyPoliticianOwned: boolean;
}

export interface FinanceFiltersData {
  filters: FinanceFilters;
  counterpartyLabel: string;
  showExpense: boolean;
  allowPoliticianOwned: boolean;
}

@Component({
  selector: 'app-finance-filters-dialog',
  imports: [
    FormsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    DialogFrameComponent,
  ],
  styles: `
    .field { display: flex; flex-direction: column; gap: 6px; }
    .two { display: flex; gap: 12px; }
    .two > * { flex: 1; }
    .footer { display: flex; justify-content: space-between; border-top: 1px solid var(--border-1); padding-top: 16px; }
    mat-form-field { width: 100%; }
  `,
  template: `
    <app-dialog-frame [title]="'filtros — ' + data.counterpartyLabel">
      <div class="stack gap-4">
        <label class="field">
          <span class="mono-label">buscar {{ data.counterpartyLabel }}</span>
          <div class="input">
            <input [(ngModel)]="f.q" [placeholder]="'nome do ' + data.counterpartyLabel + '…'" />
          </div>
        </label>

        <div class="field">
          <span class="mono-label">período</span>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-date-range-input [rangePicker]="picker">
              <input matStartDate [(ngModel)]="f.dateFrom" placeholder="início" />
              <input matEndDate [(ngModel)]="f.dateTo" placeholder="fim" />
            </mat-date-range-input>
            <mat-datepicker-toggle matIconSuffix [for]="picker" />
            <mat-date-range-picker #picker />
          </mat-form-field>
        </div>

        <div class="two">
          <label class="field">
            <span class="mono-label">{{ amountLabel }} — mín. R$</span>
            <div class="input"><input type="number" inputmode="decimal" [(ngModel)]="f.amountMin" placeholder="0" /></div>
          </label>
          <label class="field">
            <span class="mono-label">{{ amountLabel }} — máx. R$</span>
            <div class="input"><input type="number" inputmode="decimal" [(ngModel)]="f.amountMax" placeholder="sem limite" /></div>
          </label>
        </div>
        @if (data.showExpense) {
          <p class="hint">O range acima considera <strong>valor OU pago</strong> — uma despesa entra se qualquer um dos dois cair na faixa.</p>
        }

        @if (data.allowPoliticianOwned) {
          <mat-checkbox [(ngModel)]="f.onlyPoliticianOwned">
            mostrar só <span class="badge badge--flag">⚑ empresa de político</span>
          </mat-checkbox>
        }

        <div class="footer">
          <button type="button" class="mono-label link-btn" (click)="clear()">limpar filtros</button>
          <button type="button" class="btn btn--primary" (click)="apply()">aplicar</button>
        </div>
      </div>
    </app-dialog-frame>
  `,
})
export class FinanceFiltersDialogComponent {
  protected readonly data = inject<FinanceFiltersData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<FinanceFiltersDialogComponent, FinanceFilters>);
  protected f: FinanceFilters = { ...this.data.filters };
  protected readonly amountLabel = `valor${this.data.showExpense ? ' / pago' : ''}`;
  protected readonly touched = signal(false);

  protected clear(): void {
    this.f = { q: '', dateFrom: null, dateTo: null, amountMin: '', amountMax: '', onlyPoliticianOwned: false };
  }

  protected apply(): void {
    this.ref.close(this.f);
  }
}
