# Aviso de licenças

Este repositório reúne material de origens diferentes. **O `LICENSE` (MIT) não
cobre tudo o que está aqui dentro** — ele define "o Software", e é este arquivo
que diz o que é o Software e o que não é.

## O que o MIT cobre

O código e o trabalho editorial feitos para este projeto:

| | |
|---|---|
| `index.html`, `css/`, `js/` | o jogo |
| `tools/` | as ferramentas de acervo, calendário e capas |
| `data/albums.json` | a seleção dos 576 álbuns e a classificação de gênero, subgênero, formação e grupo de gravadora |
| `data/calendar.json` | a ordem dos dias |
| `README.md` | a documentação |

Os dados de identificação de cada álbum — título, artista, ano, gravadora e o
`mbid` — vêm da [MusicBrainz](https://musicbrainz.org/), cujos dados principais
estão em domínio público (CC0). A classificação de gênero e subgênero e a
taxonomia de proximidade em `js/taxonomy.js` são deste projeto.

## O que o MIT **não** cobre

### `assets/covers/` — as capas dos álbuns

São obras de seus respectivos autores, artistas e gravadoras. **Não pertencem a
este projeto e não estão sendo licenciadas por ele.** Estão aqui apenas para
identificar os álbuns, sem fim comercial.

As imagens vieram do [Cover Art Archive](https://coverartarchive.org/), que as
hospeda sob presunção de uso legítimo — e essa presunção **não se transfere para
quem baixa**. A base de dados da MusicBrainz é aberta; as capas não são
licenciadas.

Quem clonar este repositório responde pelo uso que fizer dessas imagens.

Se você detém direitos sobre alguma capa e quer que ela saia, escreva para
**apoiocapadodia@gmail.com** que ela será retirada.

### `data/extras.json` — os resumos

O campo `blurb` de cada álbum é um trecho da **Wikipédia**, sob
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Reusar esse
arquivo exige manter a atribuição à Wikipédia e o link do verbete — que estão no
próprio arquivo, no campo `wiki` de cada entrada — e distribuir o resultado sob
licença compatível. O jogo faz isso na tela de resultado, creditando a fonte e
linkando o artigo.

---

## In English

The MIT license in `LICENSE` covers the **code and the editorial work** of this
project: the game, the tools, the album selection and the genre taxonomy.

It does **not** cover the album cover images in `assets/covers/`. Those are the
work of their respective authors, artists and labels, are not owned by this
project and are not licensed by it. They appear only to identify the albums,
with no commercial purpose, and came from the Cover Art Archive, which hosts
them under an assumption of fair use that does not transfer to downloaders.
Anyone cloning this repository is responsible for their own use of those images.
**Rights holders who want an image removed: apoiocapadodia@gmail.com — it will
be taken down.**

The album summaries in `data/extras.json` are excerpts from Wikipedia, licensed
CC BY-SA 4.0; reuse requires attribution and a compatible license.
