import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { formatDateTime } from '../../core/format';
import { Provenance } from '../models/api.models';
import { DialogFrameComponent } from './dialog-frame.component';

@Component({
  selector: 'app-provenance-dialog',
  imports: [DialogFrameComponent],
  template: `
    <app-dialog-frame title="proveniência">
      <dl class="seal__body">
        <dt>fonte</dt><dd>{{ p.sourceName }}</dd>
        <dt>órgão</dt><dd>{{ p.agency }}</dd>
        <dt>url</dt><dd><a [href]="p.url" target="_blank" rel="noreferrer">{{ p.url }}</a></dd>
        <dt>coletado em</dt><dd>{{ accessedAt }}</dd>
        <dt>sha256</dt><dd>{{ p.sha256 }}</dd>
        <dt>parser</dt><dd>{{ p.parserName }} v{{ p.parserVersion }}</dd>
        @if (p.legalBasis) {
          <dt>base legal</dt><dd>{{ p.legalBasis }}</dd>
        }
      </dl>
      <p class="hint mt-4">
        Baixe o arquivo pela URL e confira o SHA-256: se bater, o dado exibido saiu exatamente dele.
      </p>
    </app-dialog-frame>
  `,
})
export class ProvenanceDialogComponent {
  protected readonly p = inject<Provenance>(MAT_DIALOG_DATA);
  protected readonly accessedAt = formatDateTime(this.p.accessedAt);
}
