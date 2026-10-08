import { Directive, HostListener, computed, inject, input, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ShellService } from '../../core/shell.service';
import { Provenance } from '../models/api.models';
import { ProvenanceDialogComponent } from './provenance-dialog.component';

@Directive({
  selector: '[appSourceZone]',
  host: {
    '[class.source-zone]': 'active()',
    '[class.source-zone--hover]': 'active() && hover()',
  },
})
export class SourceZoneDirective {
  readonly appSourceZone = input<Provenance | null | undefined>(null);

  private readonly shell = inject(ShellService);
  private readonly dialog = inject(MatDialog);
  protected readonly hover = signal(false);
  protected readonly active = computed(() => this.shell.analysisMode() && !!this.appSourceZone());

  @HostListener('mouseenter') onEnter(): void {
    this.hover.set(true);
  }

  @HostListener('mouseleave') onLeave(): void {
    this.hover.set(false);
  }

  @HostListener('click', ['$event']) onClick(event: MouseEvent): void {
    const provenance = this.appSourceZone();
    if (!this.active() || !provenance) return;
    event.preventDefault();
    event.stopPropagation();
    this.dialog.open(ProvenanceDialogComponent, {
      data: provenance,
      width: '520px',
      maxWidth: '95vw',
      panelClass: 'elosys-dialog',
    });
  }
}
