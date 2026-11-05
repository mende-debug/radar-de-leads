# Radar de Leads

CRM de bolso para captação de leads de dois projetos: **placas NFC** (avaliação do Google, Pix, Instagram) e **criação de sites**.

- **Funil:** etapas, conversão, faturamento e retornos do dia
- **Leads:** cadastro, filtros e anotações
- **Prospectar:** busca pronta no Google Maps e qualificação (NFC × Site)
- **Mensagens:** modelos de WhatsApp por etapa, com envio direto

## Sincronização entre aparelhos

Os leads ficam num **Gist secreto** da sua conta do GitHub. Em cada aparelho:

1. Crie um token em https://github.com/settings/tokens/new?scopes=gist (escopo **gist**, sem expiração)
2. No app, na aba **Funil**, cole o token em *Sincronizar celular e computador* e toque em **Conectar**

O app sincroniza sozinho ao salvar, ao voltar para a aba e a cada minuto. Também tem **Baixar backup** / **Restaurar backup** (JSON).

Página única (`index.html`), sem build. Publicado via GitHub Pages.
