import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { ElosysApiService } from '../core/elosys-api.service';
import { formatCpf } from '../core/format';
import { ShellService } from '../core/shell.service';
import { AvatarComponent } from '../shared/components/ui.components';
import { SearchResult } from '../shared/models/api.models';

@Component({
  selector: 'app-command-palette',
  imports: [AvatarComponent],
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 1000; display: flex; justify-content: center; align-items: flex-start; padding-top: 12vh; }
    .palette { width: min(640px, 94vw); background: var(--surface); border: 1px solid var(--border-2); border-radius: var(--r-lg); box-shadow: var(--shadow-modal); overflow: hidden; }
    .palette .input { border: 0; border-bottom: 1px solid var(--border-1); border-radius: 0; padding: 14px 16px; }
    .palette .input input { font-size: 15px; }
    ul { list-style: none; margin: 0; padding: 6px; max-height: 56vh; overflow-y: auto; }
    li button { width: 100%; display: flex; gap: 12px; align-items: center; text-align: left; padding: 9px 10px; border: 0; border-radius: var(--r-sm); background: transparent; color: var(--fg-1); cursor: pointer; }
    li button.is-active, li button:hover { background: var(--hover); }
    .meta { font-family: var(--font-mono); font-size: 10.5px; color: var(--muted-2); margin-top: 2px; }
    .status { padding: 18px 16px; font-size: 12px; color: var(--muted-2); font-family: var(--font-mono); }
  `,
  template: `
    @if (shell.paletteOpen()) {
      <div class="backdrop" (click)="close()">
        <div class="palette" (click)="$event.stopPropagation()" role="dialog" aria-label="buscar">
          <div class="input">
            <span aria-hidden="true">⌕</span>
            <input #box [value]="query()" (input)="onInput($event)" (keydown)="onKey($event)"
                   placeholder="buscar político ou pessoa por nome ou CPF…" autocomplete="off" />
            <span class="input__kbd">esc</span>
          </div>
          @if (query().trim().length < 3) {
            <div class="status">digite ao menos 3 caracteres</div>
          } @else if (loading()) {
            <div class="status">buscando…</div>
          } @else if (!results().length) {
            <div class="status">nada encontrado</div>
          } @else {
            <ul>
              @for (r of results(); track $index) {
                <li>
                  <button type="button" [class.is-active]="$index === active()" (click)="open(r)" (mouseenter)="active.set($index)">
                    @if (r.kind === 'candidato') {
                      <app-avatar [photoUrl]="r.photoUrl" [name]="r.canonicalName" [size]="32" />
                      <div class="flex-1">
                        <div class="truncate">{{ r.canonicalName }}</div>
                        <div class="meta">
                          {{ r.latestOffice ?? 'candidato' }} · {{ r.latestPartyAbbr ?? '—' }}/{{ r.latestState ?? '—' }} · {{ r.latestYear }}
                          · {{ r.candidacyCount }} {{ r.candidacyCount === 1 ? 'candidatura' : 'candidaturas' }}
                        </div>
                      </div>
                    } @else {
                      <app-avatar [name]="r.canonicalName" [size]="32" />
                      <div class="flex-1">
                        <div class="truncate">{{ r.canonicalName }}</div>
                        <div class="meta">pessoa física · {{ cpf(r.cpf) }}</div>
                      </div>
                    }
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      </div>
    }
  `,
})
export class CommandPaletteComponent {
  protected readonly shell = inject(ShellService);
  private readonly api = inject(ElosysApiService);
  private readonly router = inject(Router);
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');

  protected readonly query = signal('');
  protected readonly results = signal<SearchResult[]>([]);
  protected readonly loading = signal(false);
  protected readonly active = signal(0);
  private readonly input$ = new Subject<string>();
  protected readonly cpf = formatCpf;

  constructor() {
    this.input$
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < 3) return of({ results: [] as SearchResult[] });
          this.loading.set(true);
          return this.api.search(q.trim()).pipe(catchError(() => of({ results: [] as SearchResult[] })));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this.results.set(r.results);
        this.active.set(0);
        this.loading.set(false);
      });

    effect(() => {
      if (this.shell.paletteOpen()) setTimeout(() => this.box()?.nativeElement.focus());
    });
  }

  protected onInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.query.set(v);
    this.input$.next(v);
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.results().length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      this.active.set((this.active() + 1) % n);
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      this.active.set((this.active() - 1 + n) % n);
    } else if (e.key === 'Enter' && n) {
      e.preventDefault();
      this.open(this.results()[this.active()]);
    } else if (e.key === 'Escape') {
      this.close();
    }
  }

  protected open(r: SearchResult): void {
    this.close();
    if (r.kind === 'candidato') this.router.navigate(['/politico', r.personId]);
    else this.router.navigate(['/cpf', r.cpf]);
  }

  protected close(): void {
    this.shell.paletteOpen.set(false);
  }
}
