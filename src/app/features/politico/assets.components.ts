import { Component, computed, inject, input } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { formatBRL, formatInt } from '../../core/format';
import { DialogFrameComponent } from '../../shared/components/dialog-frame.component';
import { SourceZoneDirective } from '../../shared/components/source-zone.directive';
import { DeclaredAsset, DeclaredAssetsYearSummary } from '../../shared/models/api.models';

function compactBRL(cents: number): string {
  const v = cents / 100;
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
}

@Component({
  selector: 'app-assets-chart',
  styles: `
    svg { width: 100%; height: 200px; display: block; overflow: visible; }
    .tick { font-family: var(--font-mono); font-size: 10px; fill: var(--muted-2); }
    rect.bar { fill: var(--accent); }
    g.col:hover rect.bar { fill: var(--accent-hover); }
    g.col:hover rect.hover { fill: var(--hover); }
  `,
  template: `
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" role="img" aria-label="patrimônio por eleição">
      @for (t of chart().ticks; track t.y) {
        <line [attr.x1]="PAD_L" [attr.x2]="W" [attr.y1]="t.y" [attr.y2]="t.y" stroke="var(--border-1)" />
        <text class="tick" [attr.x]="PAD_L - 6" [attr.y]="t.y + 3" text-anchor="end">{{ t.label }}</text>
      }
      @for (b of chart().bars; track b.year) {
        <g class="col">
          <rect class="hover" [attr.x]="b.slotX" y="0" [attr.width]="b.slotW" [attr.height]="H - PAD_B" fill="transparent" />
          <rect class="bar" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="3" />
          <text class="tick" [attr.x]="b.x + b.w / 2" [attr.y]="H - 4" text-anchor="middle">{{ b.year }}</text>
          <title>{{ b.year }}: {{ b.label }}</title>
        </g>
      }
    </svg>
  `,
})
export class AssetsChartComponent {
  readonly data = input.required<DeclaredAssetsYearSummary[]>();
  protected readonly W = 720;
  protected readonly H = 200;
  protected readonly PAD_L = 56;
  protected readonly PAD_B = 20;

  protected readonly chart = computed(() => {
    const sorted = [...this.data()].sort((a, b) => a.year - b.year);
    const max = Math.max(1, ...sorted.map((d) => d.totalCents));
    const plotH = this.H - this.PAD_B - 8;
    const slotW = (this.W - this.PAD_L) / Math.max(1, sorted.length);
    const w = Math.min(56, slotW * 0.6);
    const bars = sorted.map((d, i) => {
      const h = (d.totalCents / max) * plotH;
      const slotX = this.PAD_L + i * slotW;
      return { year: d.year, slotX, slotW, x: slotX + (slotW - w) / 2, w, h, y: 8 + plotH - h, label: formatBRL(d.totalCents) };
    });
    const ticks = [0, 0.5, 1].map((f) => ({ y: 8 + plotH - f * plotH, label: compactBRL(max * f) }));
    return { bars, ticks };
  });
}

interface AssetsDialogData {
  year: number;
  assets: DeclaredAsset[];
}

@Component({
  selector: 'app-assets-dialog',
  imports: [DialogFrameComponent, SourceZoneDirective],
  template: `
    <app-dialog-frame [title]="'bens declarados em ' + data.year">
      <div class="stack gap-3">
        @for (a of data.assets; track a.id) {
          <div class="card" style="padding: 10px 12px" [appSourceZone]="a.provenance">
            <div class="row wrap gap-4" style="justify-content: space-between; align-items: flex-start">
              <div class="flex-1">
                @if (a.assetType) {
                  <div style="font-size: 13px; color: var(--fg-2)">{{ a.assetType }}</div>
                }
                @if (a.description) {
                  <div class="mt-1" style="font-size: 12.5px; color: var(--muted)">{{ a.description }}</div>
                }
              </div>
              <span class="num none" style="font-size: 14px">{{ brl(a.valueCents) }}</span>
            </div>
            @if (a.sourceUpdatedAt) {
              <div class="mono mt-2" style="font-size: 10px; color: var(--muted-2)">atualizado em {{ a.sourceUpdatedAt }}</div>
            }
          </div>
        }
      </div>
    </app-dialog-frame>
  `,
})
export class AssetsDialogComponent {
  protected readonly data = inject<AssetsDialogData>(MAT_DIALOG_DATA);
  protected readonly brl = formatBRL;
}

@Component({
  selector: 'app-assets-year-cards',
  template: `
    <div class="row wrap gap-2">
      @for (y of byYear(); track y.year) {
        <button type="button" class="card" style="padding: 10px 14px; cursor: pointer; text-align: left" (click)="open(y.year)">
          <div class="label">{{ y.year }}</div>
          <div class="num mt-1" style="font-size: 16px">{{ brl(y.totalCents) }}</div>
          <div class="mono" style="font-size: 10px; color: var(--muted-2); margin-top: 2px">
            {{ int(y.count) }} {{ y.count === 1 ? 'bem' : 'bens' }}
          </div>
        </button>
      }
    </div>
  `,
})
export class AssetsYearCardsComponent {
  readonly byYear = input.required<DeclaredAssetsYearSummary[]>();
  readonly assets = input.required<DeclaredAsset[]>();
  private readonly dialog = inject(MatDialog);
  protected readonly brl = formatBRL;
  protected readonly int = formatInt;

  protected open(year: number): void {
    this.dialog.open(AssetsDialogComponent, {
      data: { year, assets: this.assets().filter((a) => a.year === year) },
      width: '640px',
      maxWidth: '95vw',
      maxHeight: '85vh',
      panelClass: 'elosys-dialog',
    });
  }
}
