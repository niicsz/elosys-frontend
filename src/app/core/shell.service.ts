import { Injectable, signal } from '@angular/core';

export interface PageHeaderState {
  group: string;
  current: string;
}

type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ShellService {
  readonly header = signal<PageHeaderState>({ group: 'EloSys', current: '' });
  readonly paletteOpen = signal(false);
  readonly analysisMode = signal(false);
  readonly theme = signal<Theme>(this.initialTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  setHeader(group: string, current: string): void {
    this.header.set({ group, current });
  }

  toggleTheme(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    this.applyTheme(next);
    try {
      localStorage.setItem('elosys-theme', next);
    } catch {
    }
  }

  private initialTheme(): Theme {
    try {
      const saved = localStorage.getItem('elosys-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
    }
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
