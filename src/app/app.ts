import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { formatInt } from './core/format';
import { MetaService } from './core/meta.service';
import { ShellService } from './core/shell.service';
import { CommandPaletteComponent } from './layout/command-palette.component';

interface NavItem {
  path: string;
  label: string;
  count?: () => number | null;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommandPaletteComponent],
  host: { '(document:keydown)': 'onKey($event)' },
  styles: `
    :host { display: grid; grid-template-columns: 232px 1fr; min-height: 100vh; background: var(--bg); color: var(--fg-1); }
    aside { position: sticky; top: 0; height: 100vh; overflow-y: auto; border-right: 1px solid var(--border-1); padding: 20px 12px; display: flex; flex-direction: column; gap: 22px; background: var(--surface); }
    .brand { font-family: var(--font-mono); font-size: 17px; font-weight: 600; padding: 0 8px; letter-spacing: -.01em; }
    .brand span { color: var(--accent-2); }
    .group-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted-2); padding: 0 8px 6px; }
    nav a { display: flex; justify-content: space-between; align-items: center; padding: 7px 8px; border-radius: var(--r-sm); font-size: 13px; color: var(--muted); }
    nav a:hover { background: var(--hover); color: var(--fg-1); }
    nav a.is-active { background: var(--active, var(--hover)); color: var(--fg-1); }
    .count { font-family: var(--font-mono); font-size: 10.5px; color: var(--muted-2); }
    .aside-foot { margin-top: auto; font-size: 11px; color: var(--muted-2); line-height: 1.5; padding: 0 8px; }
    .aside-foot a { color: var(--link-primary); }
    main { min-width: 0; display: flex; flex-direction: column; }
    .topbar { position: sticky; top: 0; z-index: 50; height: var(--navbar-h, 56px); display: flex; align-items: center; gap: 12px; padding: 0 24px; border-bottom: 1px solid var(--border-1); background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px); }
    .crumb { font-family: var(--font-mono); font-size: 12px; color: var(--muted-2); }
    .crumb strong { color: var(--fg-1); font-weight: 500; }
    .search-btn { min-width: 260px; justify-content: space-between; color: var(--muted-2); }
    .menu-btn { display: none; }
    footer { margin-top: auto; border-top: 1px solid var(--border-1); padding: 20px 24px; font-size: 11.5px; color: var(--muted-2); line-height: 1.6; }
    footer a { color: var(--link-primary); }
    @media (max-width: 900px) {
      :host { grid-template-columns: 1fr; }
      aside { position: fixed; z-index: 200; width: 260px; transform: translateX(-100%); transition: transform .2s; }
      aside.open { transform: none; box-shadow: var(--shadow-modal); }
      .menu-btn { display: inline-flex; }
      .topbar { padding: 0 16px; }
      .search-btn { min-width: 0; }
      .search-btn .input__kbd { display: none; }
    }
  `,
  template: `
    <aside [class.open]="menuOpen()">
      <a routerLink="/" class="brand">elo<span>sys</span></a>
      @for (g of groups; track g.label) {
        <div>
          <div class="group-label">{{ g.label }}</div>
          <nav>
            @for (item of g.items; track item.path) {
              <a [routerLink]="item.path" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: item.path === '/' }">
                <span>{{ item.label }}</span>
                @if (item.count?.(); as c) {
                  <span class="count">{{ fmt(c) }}</span>
                }
              </a>
            }
          </nav>
        </div>
      }
      <div class="aside-foot">
        Projeto original por <a href="https://github.com/YuriRDev/elosys" target="_blank" rel="noreferrer">Yuri Rousseff</a>.
        <a routerLink="/sobre">sobre</a>
      </div>
    </aside>

    <main>
      <header class="topbar">
        <button type="button" class="btn btn--icon menu-btn" (click)="menuOpen.set(!menuOpen())" aria-label="menu">☰</button>
        <div class="crumb flex-1 truncate">
          {{ shell.header().group }}
          @if (shell.header().current) {
            / <strong>{{ shell.header().current }}</strong>
          }
        </div>
        <button type="button" class="btn search-btn" (click)="shell.paletteOpen.set(true)">
          <span>⌕ buscar</span><span class="input__kbd">Ctrl K</span>
        </button>
        <button type="button" class="btn" [class.btn--fonte-active]="shell.analysisMode()"
                (click)="shell.analysisMode.set(!shell.analysisMode())"
                title="Modo fonte: clique num dado para ver de onde ele veio">◎ fonte</button>
        <button type="button" class="btn btn--icon" (click)="shell.toggleTheme()" [attr.aria-label]="'tema ' + shell.theme()">
          {{ shell.theme() === 'dark' ? '☾' : '☀' }}
        </button>
      </header>

      <router-outlet />

      <footer>
        Dados públicos (TSE, Receita Federal, Portal da Transparência). Um sinal é um padrão nos dados que merece
        atenção — <strong>não</strong> é acusação. Baseado no
        <a href="https://github.com/YuriRDev/elosys" target="_blank" rel="noreferrer">EloSys</a> de Yuri Rousseff.
      </footer>
    </main>

    <app-command-palette />
  `,
})
export class App {
  protected readonly shell = inject(ShellService);
  private readonly meta = inject(MetaService).meta;
  protected readonly menuOpen = signal(false);
  protected readonly fmt = formatInt;

  private readonly counts = computed(() => this.meta()?.sidebarCounts ?? null);

  protected readonly groups: { label: string; items: NavItem[] }[] = [
    {
      label: 'explorar',
      items: [
        { path: '/', label: 'Início' },
        { path: '/grafo', label: 'Grafo' },
        { path: '/ranking', label: 'Ranking de bens' },
        { path: '/emendas', label: 'Emendas' },
      ],
    },
    {
      label: 'sinais',
      items: [
        { path: '/sinais/doacao-circular', label: 'Doação circular', count: () => this.counts()?.circularDonations ?? null },
        { path: '/sinais/despesa-desproporcional', label: 'Despesa desproporcional', count: () => this.counts()?.disproportionateExpense ?? null },
        { path: '/sinais/socio-fornecedor', label: 'Sócio fornecedor', count: () => this.counts()?.supplierPartner ?? null },
        { path: '/sinais/analise-ia', label: 'Análise de IA', count: () => this.counts()?.aiReview ?? null },
        { path: '/sinais/discurso', label: 'Discurso', count: () => this.counts()?.discourse ?? null },
      ],
    },
  ];

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected onKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.shell.paletteOpen.set(!this.shell.paletteOpen());
    }
  }
}
