import { Component, computed, input, output, signal } from '@angular/core';
import { pageList } from '../../core/format';

@Component({
  selector: 'app-pagination',
  styles: `
    .pagination { display: flex; align-items: center; gap: 4px; font-family: var(--font-mono); }
    .pagination__btn {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 32px; height: 32px; padding: 0 6px;
      border-radius: var(--r-sm); border: 1px solid transparent;
      background: transparent; color: var(--muted); font-size: 12px; cursor: pointer;
    }
    .pagination__btn:hover:not(:disabled) { background: var(--hover); color: var(--fg-1); }
    .pagination__btn:disabled { opacity: .35; cursor: not-allowed; }
    .pagination__btn.is-active { background: var(--card-tone); border-color: var(--border-2); color: var(--fg-1); }
    .pagination__ellipsis { min-width: 32px; text-align: center; color: var(--muted-2); }
  `,
  template: `
    @if (totalPages() > 1) {
      <nav class="pagination" aria-label="paginação">
        <button type="button" class="pagination__btn" [disabled]="page() <= 1" (click)="go(page() - 1)" aria-label="página anterior">‹</button>
        @for (p of pages(); track $index) {
          @if (p === 'ellipsis') {
            <span class="pagination__ellipsis">…</span>
          } @else {
            <button type="button" class="pagination__btn" [class.is-active]="p === page()" (click)="go(p)">{{ p }}</button>
          }
        }
        <button type="button" class="pagination__btn" [disabled]="page() >= totalPages()" (click)="go(page() + 1)" aria-label="próxima página">›</button>
      </nav>
    }
  `,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();
  protected readonly pages = computed(() => pageList(this.page(), this.totalPages()));

  protected go(p: number): void {
    if (p >= 1 && p <= this.totalPages() && p !== this.page()) this.pageChange.emit(p);
  }
}

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty-state" [class.empty-state--compact]="compact()">
      <span class="empty-state__icon">{{ icon() }}</span>
      <div class="empty-state__title">{{ title() }}</div>
      @if (hint()) { <div class="empty-state__hint">{{ hint() }}</div> }
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly icon = input('◌');
  readonly compact = input(false);
}

@Component({
  selector: 'app-avatar',
  template: `
    @if (photoUrl() && !failed()) {
      <img class="search-avatar" [src]="photoUrl()" alt="" [style.width.px]="size()" [style.height.px]="size()" (error)="failed.set(true)" />
    } @else if (!hideFallback()) {
      <span class="search-avatar search-avatar--fallback" [style.width.px]="size()" [style.height.px]="size()" aria-hidden="true">{{ initial() }}</span>
    }
  `,
})
export class AvatarComponent {
  readonly photoUrl = input<string | null | undefined>(null);
  readonly name = input('?');
  readonly size = input(28);
  readonly hideFallback = input(false);
  protected readonly failed = signal(false);
  protected readonly initial = computed(() => (this.name() || '?').trim().charAt(0).toUpperCase() || '?');
}

@Component({
  selector: 'app-year-select',
  template: `
    @if (years().length) {
      <select class="select" [value]="value() ?? ''" (change)="changed($event)" aria-label="filtrar por ano">
        <option value="">{{ allLabel() }}</option>
        @for (y of years(); track y) {
          <option [value]="y" [selected]="y === value()">{{ y }}</option>
        }
      </select>
    }
  `,
})
export class YearSelectComponent {
  readonly years = input.required<number[]>();
  readonly value = input<number | null | undefined>(null);
  readonly allLabel = input('todos');
  readonly yearChange = output<number | null>();

  protected changed(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.yearChange.emit(v ? Number(v) : null);
  }
}

@Component({
  selector: 'app-section',
  template: `
    <section class="animate-in py-7" [id]="anchor()">
      <div class="section-title mb-4" [class.text-red]="danger()">{{ title() }}</div>
      <ng-content />
    </section>
  `,
})
export class SectionComponent {
  readonly title = input.required<string>();
  readonly anchor = input<string>('');
  readonly danger = input(false);
}

@Component({
  selector: 'app-search-input',
  template: `
    <div class="input" [style.width.px]="width()">
      <span aria-hidden="true" style="color: var(--muted-2)">⌕</span>
      <input [value]="value() ?? ''" [placeholder]="placeholder()" (input)="onInput($event)" (keydown.enter)="flush($event)" />
    </div>
  `,
})
export class SearchInputComponent {
  readonly value = input<string | null | undefined>('');
  readonly placeholder = input('buscar…');
  readonly width = input(280);
  readonly search = output<string>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected onInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search.emit(v.trim()), 400);
  }

  protected flush(e: Event): void {
    clearTimeout(this.timer);
    this.search.emit((e.target as HTMLInputElement).value.trim());
  }
}
