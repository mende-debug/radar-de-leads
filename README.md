# Radar CRM

CRM de captação de leads, feito para vender **placas NFC** (avaliação do Google, Pix, Instagram) e **criação de sites**. Produtos, etapas e moeda são configuráveis para qualquer negócio e país.

**App:** https://mende-debug.github.io/radar-de-leads/

## O que tem

| Área | Recursos |
|---|---|
| **Painel** | Pipeline aberto e ponderado, ganhos do mês com meta, novos leads (30 dias) com variação, taxa de conversão, leads por semana, funil por etapa, origens, tarefas do dia, leads mais quentes, atividade recente |
| **Funil** | Kanban com arrastar e soltar (mouse ou toque longo), avanço rápido de etapa, valor por coluna, filtros |
| **Leads** | Tabela com ordenação, visões salvas (quentes, sem contato, atrasados, ganhos), filtros, ações em lote (etapa, responsável, tag, excluir, exportar), importação e exportação CSV |
| **Lead** | Painel lateral com histórico de atividades (nota, ligação, WhatsApp, e-mail, reunião), tarefas, detalhes, score automático 0–100 |
| **Tarefas** | Atrasadas, hoje, próximos 7 dias, depois, com adiamento rápido |
| **Prospectar** | Busca automática de empresas por segmento × cidade em 58 países (Google Places API ou OpenStreetMap grátis), qualificação automática e envio em lote ao funil sem duplicar |
| **Mensagens** | Modelos editáveis com campos ({contato}, {empresa}, {valor}…), envio por WhatsApp ou e-mail e registro automático no histórico |
| **Captação** | Página pública `captar.html` por produto, com link e QR code; o contato chega no seu WhatsApp e é importado com um clique |
| **Configurações** | Empresa, idioma (PT/EN/ES), moeda, país, meta, tema claro/escuro, etapas e probabilidades, produtos e preços, equipe, integrações, backup |

Também tem paleta de comandos (`Ctrl/⌘ K`), atalhos (`N` novo lead, `1–8` navegação) e instalação como app no celular (PWA, funciona offline).

## Sincronização entre aparelhos

Os dados ficam num **Gist secreto** da sua conta do GitHub. Em cada aparelho: *Configurações → Integrações*, crie um token com escopo `gist` e conecte. O app sincroniza ao salvar, ao voltar para a aba e a cada minuto. Os dados da versão anterior são migrados automaticamente.

## Estrutura

Sem build: HTML, CSS e módulos ES servidos direto pelo GitHub Pages.

```
index.html          app
captar.html         página pública de captação
css/app.css         sistema de design (tokens claro/escuro)
js/app.js           layout, rotas, paleta de comandos, atalhos
js/store.js         modelo de dados, regras (score, etapas), migração
js/sync.js          sincronização via Gist
js/i18n.js          textos PT/EN/ES e modelos de mensagem
js/components.js    formulário e painel do lead
js/views/*.js       telas
js/vendor/qrcode.js gerador de QR (MIT, Kazuhiko Arase)
sw.js               cache offline
```
