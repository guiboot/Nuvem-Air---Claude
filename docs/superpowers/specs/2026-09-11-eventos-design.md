# Seção de Eventos — design

**Data:** 2026-09-11
**Escopo:** apenas a página de locação (`index.html`, raiz de `nuvemair.com.br`). A landing de venda (`/comprar`) e a loja (`/loja`) não são tocadas.

## Problema

A Nuvem Air tem 16 trabalhos entregues documentados em foto e vídeo (15 eventos em
`Marketing/Eventos/`, 1 locação mensal em `Marketing/Mensal/`), e nada disso existe no
site. São 1,8 GB de mídia crua de iPhone (`.MOV`, `.HEIC`) parada fora do repositório.

Duas perdas:

1. **Prova social.** Quem chega na home vê fotos de catálogo dos equipamentos, não vê
   equipamento instalado em casamento, em galpão, em hospital.
2. **SEO.** A home tenta ranquear sozinha para tudo — casamento, galpão, feira agro,
   escola, indústria. Uma página por case ataca a cauda longa
   ("aluguel de climatizador para casamento em Loanda") com conteúdo próprio, e cada
   uma delas devolve link interno para a home.

## Decisões tomadas antes do design

| Pergunta | Decisão |
|---|---|
| Rotas | Uma aba só: `/eventos` lista tudo, com selo "Evento" ou "Locação mensal". Cada case em `/eventos/<slug>`. |
| Nomes de clientes | Nomes reais, inclusive o casamento. O usuário confirmou ter autorização. |
| Conteúdo | Rascunho gerado a partir da mídia, com campos não verificáveis marcados `REVISAR:` para o usuário corrigir antes de publicar. |
| Mídia | Curadoria de 3–5 arquivos por case, convertidos para web. Não converter os 95 arquivos. |

## Arquitetura

Espelha o padrão que a loja já usa e que está em produção: dados em JSON, gerador em
Node, HTML estático pronto para o Googlebot.

```
eventos.json                     dados — a única fonte de verdade, revisável a mão
tools/eventos-dados.js           lê + valida o JSON; importado por DOIS consumidores
tools/gerar-eventos.js           escreve eventos/index.html e eventos/<slug>/index.html
tools/preparar-midia-eventos.js  MOV/HEIC -> mp4/webp; roda sob demanda, fora do build
assets/css/eventos.css           CSS exclusivo da seção
assets/eventos/<slug>/           mídia convertida, commitada no repo
```

### Por que `tools/eventos-dados.js` existe

Quem escreve `sitemap.xml` é o `tools/gerar-loja.js`, não o gerador de eventos. Se cada
um mantivesse sua própria lista de URLs, uma página nova entraria no site sem entrar no
sitemap — o erro clássico. Os dois importam o mesmo módulo, então a lista de cases é
calculada uma vez só. É a mesma razão pela qual `gerar-loja.js` importa
`loja/assets/js/loja-core.js` em vez de reimplementar o cálculo de preço.

Interface do módulo:

- `carregar()` → `{ cases: [...], publicar: boolean }`
- `urlsSitemap(site)` → `[{ loc, prioridade }]` para o `gerar-loja.js` concatenar
- `validar(dados)` → lança em dado inválido (slug não-ASCII, slug duplicado, mídia
  ausente em disco, `REVISAR:` remanescente com `publicar: true`)

### Fluxo de build

`npm run build` passa a rodar os dois geradores. `gerar-eventos.js` roda **antes** de
`gerar-loja.js` apenas por clareza de log; não há dependência de ordem, porque a lista
de URLs vem do módulo de dados e não de arquivos em disco.

## Formato do `eventos.json`

```json
{
  "publicar": false,
  "cases": [
    {
      "slug": "casamento-em-loanda",
      "tipo": "evento",
      "categoria": "casamento",
      "cliente": "Casamento em Loanda",
      "cidade": "Loanda",
      "uf": "PR",
      "data": "REVISAR: 2025-11",
      "equipamento": ["Climatizador Industrial Compacto"],
      "quantidade": "REVISAR: 4",
      "area": "REVISAR: 300 m²",
      "desafio": "...",
      "solucao": "...",
      "resultado": "...",
      "midia": [
        { "tipo": "video", "arquivo": "casamento-loanda-1.mp4", "poster": "casamento-loanda-1.webp", "alt": "..." },
        { "tipo": "imagem", "arquivo": "casamento-loanda-2.webp", "alt": "..." }
      ],
      "seo": {
        "titulo": "Aluguel de climatizador para casamento em Loanda · Case Nuvem Air",
        "descricao": "...",
        "h1": "..."
      }
    }
  ]
}
```

`publicar: false` (o padrão inicial) faz **a listagem e todas as páginas de case**
saírem com `robots: noindex, follow` e **ficarem fora do sitemap**. As páginas existem, são
navegáveis e podem ser revisadas em produção sem sujar o Search Console. Virar
`true` é o único gesto necessário para publicar de verdade — e aí a validação passa a
recusar qualquer `REVISAR:` que tenha sobrado.

## Os 16 cases

Slugs em ASCII puro. Nome de arquivo ou rota com acento funciona no Mac e dá 404 na
Vercel — é regra conhecida deste projeto. Os erros de digitação das pastas de origem
("Compahia", "Confraterzinaçao", "Sicreed", "Mouroes") são corrigidos aqui; o mapa
pasta → slug mora no `preparar-midia-eventos.js`.

| Pasta de origem | Slug | Tipo | Ângulo de busca |
|---|---|---|---|
| `Eventos/Motor Classic` | `motor-classic` | evento | climatizador para exposição de carros |
| `Eventos/Evento Compahia de Melhoramentos ` | `companhia-de-melhoramentos` | evento | climatização de evento corporativo |
| `Eventos/Rotary Sicreed` | `rotary-sicredi` | evento | climatizador para jantar beneficente |
| `Eventos/Evento Rotary Acema` | `rotary-acema` | evento | evento de entidade / clube de serviço |
| `Eventos/Hospital Universitario` | `hospital-universitario` | evento | climatizador para hospital |
| `Eventos/Evento Weld Vision 03` | `weld-vision` | evento | climatizador industrial para solda |
| `Eventos/Evento Agro Semente` | `agro-semente` | evento | climatizador para feira agro |
| `Eventos/Havam` | `havam` | evento | climatização de galpão |
| `Eventos/Ecospeed` | `ecospeed` | evento | climatizador para empresa |
| `Eventos/Ciacollor` | `ciacollor` | evento | climatizador para indústria |
| `Eventos/Colegio Adventista` | `colegio-adventista` | evento | climatizador para escola / formatura |
| `Eventos/Quinta dos Mouroes` | `quinta-dos-mouroes` | evento | climatizador para espaço de eventos |
| `Eventos/Evento Chacara Jandaia` | `chacara-jandaia` | evento | climatizador para chácara / festa |
| `Eventos/Confraterzinaçao Empresa Jandaia` | `confraternizacao-empresa-jandaia` | evento | climatizador para confraternização |
| `Eventos/Casamento Loanda` | `casamento-em-loanda` | evento | aluguel de climatizador para casamento |
| `Mensal/Soft Dream Tecelagem` | `soft-dream-tecelagem` | mensal | climatizador para tecelagem / locação mensal |

### Vocabulário de `categoria`

Fechado, porque os links do mega-menu apontam para esses valores — categoria inventada
em um case vira filtro que não devolve nada. `validar()` recusa valor fora desta lista:

| `categoria` | Cases |
|---|---|
| `casamento` | `casamento-em-loanda`, `quinta-dos-mouroes`, `chacara-jandaia` |
| `corporativo` | `companhia-de-melhoramentos`, `rotary-sicredi`, `rotary-acema`, `confraternizacao-empresa-jandaia`, `motor-classic` |
| `industria` | `weld-vision`, `ciacollor`, `ecospeed`, `soft-dream-tecelagem` |
| `galpao` | `havam`, `agro-semente` |
| `institucional` | `hospital-universitario`, `colegio-adventista` |

A distribuição acima é a hipótese inicial e faz parte do que o usuário revisa: mudar a
`categoria` de um case é editar um campo do JSON.

## SEO

### Página de case (`/eventos/<slug>`)

- `<title>` e `<meta description>` próprios, vindos de `seo.titulo` / `seo.descricao`.
- `<h1>` único por página, diferente do `<title>` — o `<title>` carrega a palavra-chave,
  o `<h1>` fala com quem leu.
- `<link rel="canonical">` absoluto.
- OG e Twitter usando o **poster do próprio case**, não a logo. Cada link compartilhado
  no WhatsApp mostra o equipamento instalado naquele lugar.
- JSON-LD: `Article` + `BreadcrumbList`.
  **Não usar `Event`.** O schema `Event` descreve evento *futuro*, com data e ingresso;
  aplicá-lo a um trabalho já entregue produz rich result errado e é passível de ação
  manual no Search Console. Um case é conteúdo editorial: `Article`.
- Link interno: 2 cases irmãos (mesma categoria quando houver, senão os seguintes na
  lista) + CTA para `/#contato`.

### Listagem (`/eventos`)

- JSON-LD `CollectionPage` + `ItemList` com os 16 cases na ordem exibida.
- Filtro por tipo via querystring (`?tipo=evento`, `?tipo=mensal`) e por categoria,
  aplicado no cliente sobre markup já renderizado — os 16 cards vêm no HTML, o filtro só
  esconde. Nada de conteúdo que só existe depois do JS.

### Sitemap

`tools/eventos-dados.js` devolve `/eventos` (prioridade `0.8`) e cada case
(prioridade `0.7`); `gerar-loja.js` concatena em `PAGINAS_FIXAS`. Com
`publicar: false`, devolve lista vazia — mesma disciplina que a loja fora do ar já
segue hoje: nada que não deva ser indexado entra no sitemap.

## A aba no nav

Em `index.html`, um `<a class="nav__link nav__link--plain" href="/eventos">Eventos</a>`
entre **Totem de LED** e **Mercados**. A classe já existe e já é usada pelo link de FAQ —
zero CSS novo, zero risco de quebrar o layout do pill.

Além disso, os três cards do painel **Mercados** apontam hoje todos para a mesma âncora
`#solucao`. Passam a apontar para a listagem filtrada:

| Card | href atual | href novo |
|---|---|---|
| Galpões & Produção | `#solucao` | `/eventos?categoria=industria` |
| Eventos & Casamentos | `#solucao` | `/eventos?categoria=casamento` |
| CDs & Armazéns | `#solucao` | `/eventos?categoria=galpao` |

O mega-menu deixa de ser decorativo e vira caminho real para os cases.

## Mídia

### Preset

Copiado do que já está em produção na home, para os cases não destoarem:

- **Vídeo:** H.264, 720×1280 (retrato), 30 fps, ~1000 kb/s, **sem faixa de áudio**,
  `-movflags +faststart`. Corte de até 8 s a partir do trecho mais estável.
  Alvo: ~1 MB por arquivo.
- **Poster:** WebP, 420 px de largura, extraído de um frame do próprio vídeo.
- **Foto:** `.HEIC` → WebP 1200 px de largura, qualidade 80.

### Fluxo

`tools/preparar-midia-eventos.js` lê um mapa `pasta de origem → slug → arquivos
escolhidos`, executa `ffmpeg` (e `sips` para decodificar HEIC) e grava em
`assets/eventos/<slug>/`. **Não entra no `npm run build`**: a mídia de origem vive fora
do repositório e não estará presente na máquina de build da Vercel. O que a Vercel vê é
o resultado já convertido e commitado.

Estimativa de peso adicionado ao repositório: 55–70 MB, contra 1,8 GB de origem.

### Carregamento na página

Reaproveita `video.lazy-video` + `data-src` do `assets/js/app.js`, que já faz
IntersectionObserver com `rootMargin: 300px` e fallback para navegador sem suporte.
Nenhum JS novo para vídeo.

## Roteamento na Vercel

O projeto está com `cleanUrls: false`, então a Vercel serve `eventos/index.html` em
`/eventos` pela regra padrão de índice de diretório — é exatamente como `/comprar`
funciona hoje. Nenhum rewrite novo é necessário.

Duas entradas novas em `redirects` no `vercel.json`, espelhando a que já existe para
`/comprar/index.html`, para o mesmo conteúdo não viver em duas URLs:

- `/eventos/index.html` → `/eventos` (301)
- `/eventos/:slug/index.html` → `/eventos/:slug` (301)

### Cache

`assets/eventos/**` já é coberto pela regra genérica de `(.*)\.(mp4|png|jpg|jpeg|webp)`
no `vercel.json` (30 dias). Como a ordem importa — a última regra que casa é a que vale —
e essa é a primeira da lista, não há conflito a resolver.

## Testes

`tests/eventos.test.js`, no mesmo estilo dos testes existentes (`node --test`):

1. Todo slug é ASCII puro, minúsculo, sem espaço.
2. Slugs são únicos.
3. Todo case tem ao menos um item de mídia, e cada arquivo referenciado existe em disco.
4. Todo case tem `seo.titulo` e `seo.descricao` não vazios, e títulos são únicos entre si.
5. Com `publicar: true`, nenhum campo contém `REVISAR:` — a validação lança.
6. `urlsSitemap()` devolve exatamente 1 + nº de cases URLs quando `publicar: true`, e 0
   quando `false`.

## Fora de escopo

- Qualquer alteração em `/comprar` ou `/loja`.
- Reescrever seções existentes da home além dos links de nav descritos acima.
- CMS, admin ou upload de mídia pelo navegador. O `eventos.json` é editado a mão.
- Converter os 95 arquivos de origem. Só os curados.
- Página por cidade ou por categoria (`/eventos/casamentos`). Se os cases performarem,
  vira um segundo projeto.
