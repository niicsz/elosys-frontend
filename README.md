# elosys-frontend

Frontend em **Angular 21** do [EloSys](https://github.com/YuriRDev/elosys), a ficha pública de candidatos brasileiros com a fonte de cada dado à vista. Consome a API do [elosys-backend](https://github.com/niicsz/elosys-backend) (Java 25 + Spring Boot 4).

> **Créditos:** o EloSys foi idealizado e criado por **Yuri Rousseff** ([github.com/YuriRDev/elosys](https://github.com/YuriRDev/elosys)). Telas, textos, design (tokens, cores, componentes) e regras de exibição são portados do frontend original em Next.js. Aqui muda só a tecnologia.

## Stack

- Angular 21: standalone, zoneless, signals, `rxResource`, control flow (`@if`/`@for`)
- Angular Material (diálogos, date range picker, checkbox)
- d3-force para o layout do grafo, desenhado em SVG puro (sem biblioteca de grafo)
- Estado na URL: filtros, ano e página são query params, ligados aos componentes com `withComponentInputBinding()`. Toda tela pode ser compartilhada por link.

## Estrutura

```
src/app/
  core/            ElosysApiService, interceptor de base da API, formatadores, ShellService
                   (cabeçalho, modo fonte, tema, paleta), MetaService, helpers de query params
  layout/          paleta de busca (Ctrl+K)
  shared/
    models/        contratos da API
    components/    tabela de finanças + diálogo de filtros, zona de fonte (proveniência),
                   paginação, avatar, cartões (sinal, ciclo, tweet, rede social)
  features/
    home/          início + empresas que mais faturaram
    politico/      ficha do candidato (candidaturas, bens, emendas, rede de doação, sinais,
                   finanças, redes sociais, discurso)
    entidade/      ficha de CPF/CNPJ (redireciona para /politico se for candidato)
    ranking/       bens declarados e crescimento patrimonial
    emendas/       emendas parlamentares pagas a empresas
    grafo/         grafo de correlações (busca, caminhos, expandir, ciclos destacados)
    sinais/        doação circular, despesa desproporcional, sócio-fornecedor,
                   análise de IA, discurso
    sobre/         créditos e avisos
```

## Rodando

```bash
npm install
npm start          # http://localhost:4200 — /api vai por proxy para http://localhost:8080
npm run build      # dist/elosys-frontend/browser
```

O backend precisa estar rodando (veja o README dele). Em produção a URL da API é definida em tempo de execução por `API_BASE`: o container gera o `env.js` na subida, então a mesma imagem serve qualquer ambiente.

```bash
docker build -t elosys-frontend .
docker run -p 4200:8080 -e API_BASE=http://localhost:8080 elosys-frontend
```

O backend precisa liberar a origem do frontend em `ELOSYS_ALLOWED_ORIGINS`.

## Modo fonte

O botão **◎ fonte** no topo destaca cada dado que tem proveniência. Clicando em um deles, aparecem o arquivo de origem, o órgão, a URL, a data da coleta e o SHA-256 do arquivo.
