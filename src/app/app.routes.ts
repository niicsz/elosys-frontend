import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage), title: 'EloSys' },
  { path: 'politico/:id', loadComponent: () => import('./features/politico/politico.page').then((m) => m.PoliticoPage) },
  { path: 'cpf/:doc', loadComponent: () => import('./features/entidade/entidade.page').then((m) => m.EntidadePage) },
  { path: 'cnpj/:doc', loadComponent: () => import('./features/entidade/entidade.page').then((m) => m.EntidadePage) },
  { path: 'ranking', loadComponent: () => import('./features/ranking/ranking.page').then((m) => m.RankingPage), title: 'Ranking · EloSys' },
  { path: 'emendas', loadComponent: () => import('./features/emendas/emendas.page').then((m) => m.EmendasPage), title: 'Emendas · EloSys' },
  { path: 'grafo', loadComponent: () => import('./features/grafo/grafo.page').then((m) => m.GrafoPage), title: 'Grafo · EloSys' },
  {
    path: 'sinais',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'doacao-circular' },
      {
        path: 'doacao-circular',
        loadComponent: () => import('./features/sinais/doacao-circular.page').then((m) => m.DoacaoCircularPage),
        title: 'Doação circular · EloSys',
      },
      {
        path: 'despesa-desproporcional',
        loadComponent: () => import('./features/sinais/despesa-desproporcional.page').then((m) => m.DespesaDesproporcionalPage),
        title: 'Despesa desproporcional · EloSys',
      },
      {
        path: 'socio-fornecedor',
        loadComponent: () => import('./features/sinais/socio-fornecedor.page').then((m) => m.SocioFornecedorPage),
        title: 'Sócio fornecedor · EloSys',
      },
      {
        path: 'analise-ia',
        loadComponent: () => import('./features/sinais/analise-ia.page').then((m) => m.AnaliseIaPage),
        title: 'Análise de IA · EloSys',
      },
      {
        path: 'discurso',
        loadComponent: () => import('./features/sinais/discurso.page').then((m) => m.DiscursoPage),
        title: 'Discurso · EloSys',
      },
    ],
  },
  { path: 'sobre', loadComponent: () => import('./features/sobre/sobre.page').then((m) => m.SobrePage), title: 'Sobre · EloSys' },
  { path: '**', redirectTo: '' },
];
