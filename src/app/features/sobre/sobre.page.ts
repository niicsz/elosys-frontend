import { Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShellService } from '../../core/shell.service';

@Component({
  selector: 'app-sobre-page',
  imports: [RouterLink],
  styles: `
    .page { max-width: 760px; }
    h2 { margin: 0 0 12px; font-size: 16px; font-weight: 500; }
    p, li { font-size: 13.5px; line-height: 1.7; color: var(--muted); }
    ul { padding-left: 18px; margin: 0; }
    a.ext { color: var(--link-primary); }
    a.ext:hover { text-decoration: underline; }
  `,
  template: `
    <div class="page stack gap-8">
      <section>
        <h1 class="page-title" style="margin: 0">Sobre o EloSys</h1>
        <p class="lead">
          Ficha pública de candidatos brasileiros montada só com dados abertos por lei — registro de candidatura e prestação
          de contas do TSE, cadastro de empresas da Receita Federal, sanções e emendas do Portal da Transparência — com a
          proveniência (fonte, URL, data da coleta e SHA-256) exposta em cada dado.
        </p>
      </section>

      <section class="card">
        <h2>Créditos</h2>
        <p style="margin: 0">
          O EloSys foi idealizado e criado por <strong>Yuri Rousseff</strong> —
          <a class="ext" href="https://github.com/YuriRDev/elosys" target="_blank" rel="noreferrer">github.com/YuriRDev/elosys</a>.
          A ideia, as regras de detecção, o léxico de discurso, os textos e o desenho da interface são do projeto original.
          Esta versão é uma reescrita da arquitetura: backend em Java 25 + Spring Boot 4 (hexagonal, Postgres + Redis,
          Resilience4j, revisão por IA com Claude Haiku) e frontend em Angular.
        </p>
      </section>

      <section>
        <h2>Indício não é prova</h2>
        <ul>
          <li>Um <strong>sinal</strong> é um padrão nos dados que merece atenção — não uma acusação.</li>
          <li>Vínculos por nome (autor de emenda, sócio com CPF mascarado) são cruzamentos prováveis, não identidades confirmadas.</li>
          <li>A classificação por IA pode errar; o texto original e o link para a fonte ficam sempre visíveis.</li>
        </ul>
      </section>

      <section>
        <h2>Como conferir um dado</h2>
        <p style="margin: 0">
          Ligue o modo <strong>◎ fonte</strong> no topo da página e clique em qualquer dado destacado: aparece de qual arquivo
          ele saiu, quando foi baixado e o hash do arquivo. Baixe o arquivo pela URL e compare o SHA-256.
        </p>
      </section>

      <p class="hint"><a routerLink="/" class="hover-underline">← voltar ao início</a></p>
    </div>
  `,
})
export class SobrePage {
  constructor() {
    const shell = inject(ShellService);
    effect(() => shell.setHeader('EloSys', 'Sobre'));
  }
}
