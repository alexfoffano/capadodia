# Capa do Dia

Um jogo diário de adivinhar álbuns, no espírito do Wordle e do [pokemon.com.br](https://pokemon.com.br/).
A capa do álbum do dia aparece distorcida; você tem **6 tentativas** e, a cada erro, a imagem
fica um pouco mais nítida e mais completa.

Cada palpite devolve os dados do álbum chutado comparados com os do álbum do dia, em
sete colunas: **Gênero · Subgênero · Artista · Formação · País · Ano · Gravadora**.

| Cor | Significado |
|-----|-------------|
| 🟩 verde | igual ao álbum do dia |
| 🟨 amarelo | perto: gênero vizinho, subgênero da mesma família, mesmo continente, mesmo grupo de gravadoras, ou até 5 anos de diferença |
| 🟥 vermelho | longe |

No **Ano**, a seta indica a direção: `↑` o álbum do dia é mais recente, `↓` é mais antigo.

Gastando as seis tentativas sem acertar, entra no alto do tabuleiro uma linha de
**Resposta** com os valores certos das sete colunas. Nela o verde não é decoração: marca
só as colunas que a pessoa chegou a acertar em algum palpite. O que ficou neutro é
exatamente o que ela não descobriu — que é a informação que interessa depois de perder.

## Rodando

Não tem build obrigatório nem dependências: é HTML, CSS e JavaScript puro.

```bash
npx serve .
```

Abrir `index.html` direto no navegador também funciona (os dados vêm de `data/albums.js`,
carregado por `<script>` justamente para não depender de `fetch` em `file://`). Duas
ressalvas nesse modo: as fontes vêm do Google Fonts, então sem internet o navegador cai
na fonte do sistema; e `CONFIG.smartCrop` não tem efeito, porque ler os pixels da capa
esbarra na política de origem do `file://` — o recorte cai no centro. O jogo em si,
incluindo capas, estatísticas e compartilhamento, funciona igual.

## Estrutura

```
index.html
css/style.css
js/modes.js         as versões do jogo (usado pelo navegador e pelas ferramentas)
js/i18n.js          textos da interface e tradução dos valores das colunas
js/taxonomy.js      regras de proximidade — o que é "amarelo"
js/game.js          motor do jogo, canvas da capa, arquivo de partidas, estatísticas
data/albums.json    a base editável (fonte da verdade)
data/albums.js      gerado a partir do JSON; é o que o navegador carrega
data/calendar.json  a ordem dos dias de cada versão (congelada)
data/calendar.js    gerado a partir do calendar.json
data/extras.json    resumo, artigo e id do Spotify de cada álbum
data/extras.js      gerado a partir do extras.json
assets/covers/      <id>.jpg, uma capa por álbum
tools/build.mjs     os .json  ->  os .js
tools/fetch-covers.mjs  baixa as capas da Cover Art Archive
tools/verify-releases.mjs  confere se as capas são da edição original
tools/fetch-extras.mjs  busca resumo, artigo e Spotify (MusicBrainz + Wikidata)
tools/calendar.mjs  mantém a ordem dos dias sem mexer no passado
tools/cover-candidates.mjs  lista e troca capas alternativas de um álbum
```

## Versões e idiomas

O jogo tem duas versões, escolhidas na **engrenagem** do cabeçalho (o **globo**, ao lado,
troca o idioma):

| Versão | Acervo | |
|---|---|---|
| **Só internacional** | exclui os álbuns brasileiros | padrão |
| **Nacional e internacional** | tudo | |

Quem chega pela primeira vez cai na versão padrão (`CONFIG.defaultMode`, em
`js/game.js`); depois disso vale a última versão escolhida, que fica salva.

Cada versão tem **seu próprio álbum do dia, seu próprio calendário e suas próprias
estatísticas** — a semente de embaralhamento muda junto com o acervo, e o histórico fica
guardado em chaves separadas. Trocar de versão não apaga a partida da outra. Os palpites
também ficam restritos ao acervo da versão: no modo internacional, um disco brasileiro
nem aparece no autocomplete.

Para criar uma versão nova (só nacional, só anos 70, só metal…), acrescente uma entrada
em `js/modes.js`:

```js
nacional: { filter: function (a) { return a.country === 'Brasil'; }, seed: 0x2B3A19 }
```

Depois dê nome a ela em `MODES`, dentro de `js/i18n.js`, e rode `npm run calendar` para
gerar o calendário dessa versão. O menu da engrenagem se monta sozinho a partir da lista,
na ordem em que as versões estão declaradas. Use uma `seed` diferente para cada uma, senão
duas versões de tamanho parecido começam na mesma ordem.

O idioma (português e inglês) sai de `js/i18n.js` e é detectado pelo navegador na primeira
visita. Além dos textos da interface, ele traduz os **valores que aparecem nas células** —
sem isso o jogo em inglês mostraria "Solo masculino" e "Rock progressivo" no meio das
colunas. Nome de álbum, de artista e de gravadora nunca são traduzidos, e o que já é igual
nos dois idiomas (Samba, Bossa nova, Disco, Merseybeat) fica de fora do dicionário e passa
direto.

Dá para chegar direto numa combinação por link: `?v=intl&lang=en`.

## Testando

Parâmetros de URL que ajudam a jogar várias vezes sem esperar o dia virar:

| Link | O que faz |
| --- | --- |
| `?dia=42` | joga o álbum do dia 42 em vez do de hoje |
| `?reset` | apaga a partida do dia aberto, **desta** versão, e começa de novo |
| `?reset=tudo` | apaga o arquivo inteiro das duas versões |

Dá para combinar: `?dia=42&reset` reinicia o dia 42. O `reset` sai da URL depois de
rodar — um F5 não apaga de novo a partida que você acabou de começar.

`?dia=N` acima do dia de hoje continua servindo para conferir uma capa que ainda vai
entrar. Essa partida é **descartável**: não é salva nem entra na estatística, para espiar
o futuro não sujar o arquivo.

## Jogos anteriores

O ícone de **calendário** no cabeçalho abre a grade de dias, do dia 1 até hoje. Cada
quadradinho é um dia, e a cor diz o que houve nele:

| | |
|---|---|
| escuro | dia que ainda não chegou |
| claro | dá para jogar, ainda não jogado |
| amarelo | começado e não terminado |
| verde | acertado |
| vermelho | não acertado |

O dia de hoje tem um anel amarelo; o dia aberto no momento, um anel cinza. Clicar num
quadradinho é o mesmo que abrir `?dia=N`, e aí uma faixa no alto da tela avisa que a
partida não é a de hoje, com o caminho de volta.

Cada dia jogado fica guardado por conta própria, na chave `<versão>.jogos` do
localStorage — abrir um dia antigo não atropela a partida de hoje, e voltar a um dia
fechado mostra o resultado, não um tabuleiro limpo.

**As estatísticas são somadas dessa mesma lista**, a cada vez que o painel abre, em vez
de virem de um contador à parte. É o que faz o número bater com os quadradinhos mesmo
jogando os dias fora de ordem — e é por isso que fechar um buraco do meio de uma sequência
emenda as duas pontas. A sequência atual conta os dias seguidos acertados terminando em
hoje; enquanto a partida de hoje está em aberto ela conta a partir de ontem, porque o dia
que ainda dá para jogar não quebra nada. O dia perdido, sim.

## Editando o acervo

1. Edite `data/albums.json`. Cada álbum precisa de todos estes campos:

```json
{
  "id": "pink-floyd-the-wall",
  "title": "The Wall",
  "artist": "Pink Floyd",
  "artistType": "Banda",
  "country": "Inglaterra",
  "region": "Europa Ocidental",
  "year": 1979,
  "genre": "Rock",
  "subgenre": "Rock progressivo",
  "label": "Harvest",
  "labelGroup": "EMI"
}
```

   `region` e `labelGroup` existem só para calcular o amarelo: países da mesma região
   e gravadoras do mesmo grupo ficam amarelos em vez de vermelhos.

   Campos opcionais:

   | Campo | Para que serve |
   |---|---|
   | `mbid` | id do release-group na MusicBrainz; o script preenche sozinho |
   | `searchTitle` / `searchArtist` | como procurar na MusicBrainz quando o nome usado no jogo é diferente do catalogado — casos como `"Cartola (1974)"` ou Tom Jobim, que lá é *Antonio Carlos Jobim* |
   | `noCover` | `true` tira o álbum do sorteio diário, mas ele continua valendo como palpite. Use quando não existe capa disponível — sem imagem não há o que adivinhar |

   > Depois de mexer no acervo, rode `npm run calendar` antes do `npm run build`:
   > é ele que encaixa o álbum novo em dias futuros sem trocar o disco dos dias
   > que já passaram. Ver "O calendário" abaixo.

   Depois de acrescentar álbuns, rode `npm run verify` — vale sempre. Ver
   "Conferindo se a capa é a certa" abaixo.

2. Rode o build:

```bash
npm run build
```

3. Baixe as capas que faltam:

```bash
npm run covers
```

O script procura o álbum na MusicBrainz e baixa a capa do Cover Art Archive para
`assets/covers/<id>.jpg`, respeitando o limite de 1 requisição por segundo. Ele grava o
`mbid` encontrado de volta no JSON, então a segunda rodada é mais rápida. Antes de usar
em volume, troque o e-mail em `CONTACT` no topo de `tools/fetch-covers.mjs` — a MusicBrainz
exige um User-Agent identificável.

Álbuns sem capa automática aparecem na lista final do script; para esses, salve a imagem
à mão como `assets/covers/<id>.jpg`. Enquanto a capa não existe, o jogo desenha um gradiente
colorido no lugar, para não quebrar.

Hoje os 576 álbuns têm capa, todos no sorteio.

## Conferindo se a capa é a certa

A busca da MusicBrainz costuma devolver reedições e caixas comemorativas antes do disco
original — e aí a capa baixada é a arte do relançamento, não a que a pessoa conhece. Para
checar a base inteira:

```bash
npm run verify
```

Ele compara o ano de lançamento do `mbid` gravado com o ano do álbum no JSON e lista os
suspeitos. Com `node tools/verify-releases.mjs --fix`, procura o release-group do ano certo
que tenha capa, troca o `mbid` e rebaixa a imagem. O ano do JSON é a curadoria do jogo e
nunca é alterado; quem é corrigido é o `mbid`. Diferenças de um ano são toleradas, porque
costumam ser só data de lançamento em outro país.

**O ano batendo não basta.** Um release-group pode ser do ano certo e ainda assim ser o
ao vivo, a coletânea ou o disco de entrevista daquele álbum — aí a capa vem errada e a
conferência por ano passa batido. Foi o que aconteceu com *Tapestry* (um ao vivo de 1971),
*Arise*, *The Lamb Lies Down on Broadway* e o *Blur* de 1997. Por isso os dois scripts
recusam qualquer grupo com tipo secundário (`EXTRAS_FORA`): Live, Compilation, Remix,
Interview e companhia.

### Trocando uma capa específica

Quando a capa é do disco certo mas a imagem é ruim — foto do vinil em cima da mesa, moldura
que não é da arte, 150 pixels de lado:

```bash
node tools/cover-candidates.mjs carpenters-close-to-you
node tools/cover-candidates.mjs --aplicar carpenters-close-to-you 10
```

O Cover Art Archive guarda a capa por **release**, e o release-group aponta para uma delas
— que pode ser a pior. O script baixa a frente de todas as edições do disco em
`.candidatos/<id>/`, com um `contato.jpg` numerado para escolher a olho, e `--aplicar`
copia a escolhida para `assets/covers/`. Precisa do **ffmpeg** no PATH, só para montar a
folha de contato.

> Apague a pasta `.candidatos/` quando terminar: são dezenas de megabytes e, na hora de
> publicar, sobe a pasta inteira do projeto.

## Resumo e links na tela de resultado

Quando o álbum é revelado, a tela mostra um resumo de duas frases e três caminhos para
sair do jogo: ouvir no Spotify, procurar na Amazon e ler o verbete.

```bash
npm run extras
```

A ligação é feita pelo `mbid` que já está no acervo, não por busca de texto: procurar
"Clube da Esquina" pelo nome cai no artigo do coletivo mineiro, não no do disco. São três
tentativas, em ordem:

1. **SPARQL no Wikidata** pela propriedade P436 (id de release-group na MusicBrainz).
   Resolve centenas de álbuns por consulta e já devolve o id do Spotify (P2205) e o
   título exato do artigo nos dois idiomas — o acervo inteiro sai em poucos minutos.
2. **MusicBrainz**, para quem o item do Wikidata não tem o P436: o release-group costuma
   ter o link do Wikidata. Aqui vale 1 requisição por segundo, e o progresso é salvo a
   cada 20 álbuns.
3. **Busca por nome, validada**, para as últimas sobras (o Álbum Branco e *Hotel
   California* caem aqui). A busca devolve de tudo — o artigo da banda, a discografia, o
   ao vivo homônimo, o Vol. 1 quando se quer o Vol. 2 — então o candidato só passa se o
   título do artigo for o do álbum, o resumo citar o artista e disser que é um álbum.

O resultado vai para `data/extras.json`; `npm run build` gera o `data/extras.js` que o
navegador carrega com `defer`. O script completa só o que falta e aceita `--force` e
`--only <id>`. Como é um arquivo separado, o acervo em si continua leve: só a tela de
resultado depende dele, e sem ele o jogo funciona igual.

**O que aparece quando falta dado:** sem id do Spotify, o botão cai na busca do Spotify;
sem artigo, no buscador da Wikipédia; sem resumo em português, mostra o em inglês; sem
resumo nenhum, o texto simplesmente não aparece e entra um terceiro botão com o link do
verbete.

Hoje, dos 576 álbuns: **565** com artigo, **561** com resumo (508 em português, 538 em
inglês) e **406** com link direto no Spotify. Os 11 sem artigo são discos de samba e forró
dos anos 60-70 que a Wikipédia em português não cobre.

O resumo é texto de terceiro, então carrega os erros do verbete: em três casos a data que
a Wikipédia cita difere do ano da coluna (N.W.A, Etta James e Tim Maia Racional Vol. 2 —
a curadoria do jogo está certa nos dois primeiros). O script recusa texto que não seja do
disco: se o título pedido for um redirect para a discografia da banda ou para a biografia
do artista, o resumo é descartado em vez de aparecer errado na tela.

A **loja da Amazon segue o país do navegador**, não o idioma escolhido no jogo — quem joga
em inglês no Brasil ainda vai para a amazon.com.br. O mapa de países está em `LOJAS`, em
`js/game.js`; país sem loja local cai na do idioma e, no fim, na amazon.com. Os links são
de busca, sem código de afiliado.

## Ajustando a dificuldade

- **Quantas tentativas**: `CONFIG.maxGuesses` em `js/game.js`.
- **Quanto a capa revela por erro**: o array `STAGES` em `js/game.js` (`blocks` = tamanho
  do pixel, `blur` = desfoque, `crop` = fração da capa visível).
- **Onde o recorte começa**: por padrão cai em um ponto qualquer da capa (estável por
  álbum) — inclusive numa área toda preta, que também é pista. `CONFIG.smartCrop = true`
  faz o recorte abrir pela região de maior contraste da imagem.
- **O que conta como amarelo**: `js/taxonomy.js` — vizinhança de gêneros, famílias de
  subgênero e a tolerância de anos (`YEAR_NEAR`).
- **Qual álbum cai em cada dia**: sai de `data/calendar.json`, contado a partir de
  `CONFIG.epoch`. Nenhum álbum repete antes de a lista toda passar — mais de um ano sem
  repetição em cada versão. Ver "O calendário".

## O calendário

A ordem dos dias fica **congelada** em `data/calendar.json` — uma lista de ids por versão:

```bash
npm run calendar          # encaixa no calendário o que mudou no acervo
npm run build             # gera o data/calendar.js que o navegador carrega
```

Antes isso era uma conta: o jogo embaralhava o acervo com uma semente fixa a cada
carregamento. Funciona, mas a ordem depende do **tamanho** da lista, então cada álbum
acrescentado trocava o disco de todos os dias — inclusive o de hoje, o que apagava a
partida de quem estivesse jogando naquele instante e fazia o "nº 261" que alguém tinha
compartilhado passar a apontar para outro disco.

Com o arquivo, a regra é uma só: **nunca mexer num dia que já aconteceu**. O
`npm run calendar` olha que dia é hoje e só escreve dali para frente, com três dias de
margem — o dia vira no fuso de cada jogador, e quem está no Japão pode já estar no dia
seguinte ao daqui. Ajuste com `--margem 7`, veja o que aconteceria com `--check`.

| Situação | O que o script faz |
|---|---|
| álbum novo no acervo | entra num dia futuro sorteado |
| álbum removido, dia ainda não chegou | sai do calendário, sem ruído |
| álbum removido, dia já passou | avisa e **mantém o dia**; reescrevê-lo seria mentir sobre o que as pessoas jogaram |

É esse congelamento que sustenta a grade de **jogos anteriores**: se o disco do dia 42
mudasse a cada álbum acrescentado, o quadradinho verde de alguém passaria a se referir a
outra capa. Não é um efeito colateral, é o motivo.

Se `data/calendar.js` não existir, o jogo volta sozinho ao embaralhamento por semente —
continua jogável, só volta a mudar de calendário quando o acervo muda. Para recriar o
arquivo do zero (perdendo a ordem atual): `node tools/calendar.mjs --init`.

As versões ficam em `js/modes.js`, arquivo compartilhado entre o navegador e as
ferramentas, para o calendário e o jogo nunca discordarem sobre quais álbuns entram em
cada uma.

## Compartilhando o resultado

O botão monta um texto sem entregar o álbum — só os quadradinhos, na mesma ordem das
colunas:

```
Capa do Dia nº 3 — Eu acertei por pouco! (6/6)

🟥🟥🟥🟥🟥🟥🟥
🟨🟨🟥🟩🟩🟥🟥
🟥🟥🟥🟩🟩🟨🟥
🟨🟥🟥🟩🟩🟥🟥
🟨🟥🟥🟥🟩🟨🟥
🟩🟩🟩🟩🟩🟩🟩

https://seu-site/
```

A frase muda com o desempenho (de primeira, rápido, quase escapou, por pouco, não
consegui) e está em `shareHead`, em `js/i18n.js`, nos dois idiomas. Tentativa pulada vira
uma linha de ⬛.

O link do fim sai de **`CONFIG.shareUrl`** em `js/game.js`. Deixando vazio, usa o endereço
da página aberta (sem os parâmetros de teste), o que já resolve depois de publicar;
abrindo o `index.html` do disco, a linha não aparece, porque não existe link que sirva
para outra pessoa. Quando a versão não é a padrão, o `?v=` entra junto — o nº 3 de uma
versão é outro álbum na outra, e quem abrir o link precisa cair no mesmo jogo. Pelo mesmo
motivo, o resultado de um dia do arquivo leva o `?dia=` junto: sem ele quem clicasse cairia
no álbum de hoje e a grade de emojis não bateria com nada.

O botão fica no fim da tela de resultado (“Compartilhar resultado”) e, com a partida do
dia encerrada, também no painel de estatísticas — lá ele se chama “Compartilhar resultado
**do dia**”, porque no meio do histórico acumulado precisa ficar claro que o que vai ser
compartilhado é a partida de hoje, não o extrato.

Fechou a tela de resultado e quer de volta? **Clicar na capa** reabre. Terminada a
partida, a moldura ganha `role="button"`, entra na ordem do Tab e responde a Enter e
espaço; enquanto o jogo corre, o clique não faz nada.

Em tela de toque, ele abre o compartilhamento do sistema; no computador, **copia para a
área de transferência**. O `navigator.share` existe também no Chrome do Windows, mas lá
ele abre a janela de escolher aplicativo, que atrapalha mais do que ajuda quando o que se
quer é colar o texto — então só vale quando o ponteiro é grosso (`pointer: coarse`) e há
pontos de toque.

## Publicando

É um site estático: sobe a pasta inteira no GitHub Pages, Netlify, Vercel ou qualquer
hospedagem comum, sem etapa de build.

Antes de publicar, confira que `data/calendar.json` existe e está em dia (`npm run
calendar -- --check`), preencha `CONFIG.shareUrl` em `js/game.js` com o endereço final e
confirme que `CONFIG.contactEmail` é um endereço que você lê de verdade (ver "Sobre as
capas"). Se a estreia for o dia 1 do jogo, ajuste também `CONFIG.epoch` para a data de
lançamento — senão o primeiro álbum público sai com o número do dia de hoje.
Depois de publicado, o acervo continua crescendo à vontade — é só rodar
`npm run calendar && npm run build` junto com a mudança.

## Sobre as capas

As imagens vêm do [Cover Art Archive](https://coverartarchive.org/) e são exibidas de forma
distorcida como parte do jogo. As capas seguem sendo dos seus respectivos detentores de
direitos — e vale saber que **baixar do Cover Art Archive não é o mesmo que ter licença**:
a base de dados da MusicBrainz é aberta, mas as capas não são licenciadas, o acervo as
hospeda sob presunção de uso legítimo, e essa presunção não se transfere para quem baixa.

Os resumos e os links de artigo vêm da **Wikipédia**, que é CC BY-SA — por isso a tela
credita a fonte e linka o verbete, e o texto guardado é curto, de duas frases no máximo.

O aviso aparece em dois lugares: uma linha no rodapé de toda página e a seção **Sobre as
capas** no fim do painel de ajuda, que é o painel que abre sozinho na primeira visita.
Nos dois idiomas, em `aboutText` e `creditLine` (`js/i18n.js`).

O endereço para pedidos de remoção fica em **`CONFIG.contactEmail`**, em `js/game.js`. Não
é enfeite: um aviso de direitos sem canal de contato não serve para nada. A frase não cria
direito nenhum — dizer "sem fim comercial" não transforma uso não autorizado em
autorizado —, mas mostra boa-fé, deixa claro que o jogo não se apresenta como dono nem
como licenciado da arte, e dá a quem reclama um caminho que não passa por advogado. Na
prática é a diferença entre receber um e-mail e receber uma notificação.

Pelo mesmo motivo, evite escrever *fair use* no aviso: é doutrina americana e a lei
brasileira (9.610/98) não tem equivalente genérico — invocá-la errado fica pior do que não
invocar nada.

## Licença

O código, as ferramentas, a seleção dos álbuns e a taxonomia de gêneros são **MIT** — ver
[LICENSE](LICENSE).

O MIT **não cobre as capas** em `assets/covers/`, que são de seus respectivos autores,
artistas e gravadoras e não são licenciadas por este projeto, nem os resumos em
`data/extras.json`, que são trechos da Wikipédia sob CC BY-SA 4.0. Quem clonar o
repositório responde pelo uso que fizer das imagens.

O detalhamento está em [NOTICE.md](NOTICE.md) — é ele que define o que o LICENSE chama de
"o Software".
