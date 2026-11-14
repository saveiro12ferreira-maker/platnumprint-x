# platnumprint-x

Motor de grade: lê o encaixe de um tamanho pronto e refaz a modelagem completa nos outros tamanhos, com a estampa no lugar certo, já encaixada no rolo.

## Como abrir

Dê dois cliques em `index.html`. Abre no Edge ou no Chrome. Não precisa instalar nada, mas precisa de internet na primeira vez, porque os leitores de TIFF e de PDF vêm da internet.

## Passo a passo

1. **Arquivo**: com "Gerar a grade completa logo depois de ler" marcado, um clique em Ler já entrega todos os tamanhos prontos na aba Gerar. Exporte o encaixe do Corel em TIFF (como o `Azul Petróleo Ryan.tif`), com o contorno das peças e o fundo do papel branco ou transparente. Informe de que tamanho ele é e quais tamanhos fazem parte da grade.
2. **Peças**: na prévia aparece o nome e o tamanho de cada peça (amarelo). **Arraste** para onde quiser (ex.: no finalzinho do vestido): fica verde e vale para todos os tamanhos. "Escrever na peça" (na tabela) desmarcado = a peça sai sem nada escrito; os botões em cima tiram ou põem em todas, e ↺ volta para o lugar automático.
   O motor numera cada peça e diz o tipo e a regra da estampa. A conferência no topo refaz o tamanho base e compara com o original: precisa dar perto de 100%. Se alguma peça estiver errada, corrija o tipo ou a regra ali mesmo.
3. **Estampa**: mostra a cor de fundo e o contorno de corte que o motor leu.
4. **Grade**:
   - *Padrão de mercado (automático, já vem marcado)*: o motor gradua sozinho pela tabela de medidas usada no mercado (busto para a largura, estatura para o comprimento), a partir do tamanho do arquivo. Ex.: arquivo no 12 → todos os outros tamanhos saem na proporção certa. Os números da tabela podem ser corrigidos.
   - *Percentual por tamanho*: um percentual por tamanho para cada tipo de peça.
   - *Grade da modelista (PDF)*: envie o PDF com a tabela de medidas. O motor lê a tabela, você confere os números e escolhe qual medida comanda cada peça.
   - Qualquer medida pode ser corrigida na mão na tabela final.
5. **Gerar**: monta todos os tamanhos e baixa um TIFF por tamanho, em 200 dpi, pronto para o RIP.
   - **Sem avisos de grade**: quando parte da estampa ficaria fora do molde novo, o motor resolve sozinho (a estampa acompanha a graduação da peça).
   - **A grade só é gerada quando você clicar em "Gerar grade"**. Mudou alguma opção, aparece o aviso para gerar de novo. Se quiser que refaça sozinho, marque "Refazer a grade sozinho quando eu mudar algo". "Permitir girar peças 180°" vem desmarcado: desmarcado, nenhuma peça gira.
   - **Encaixe apertado**: as peças ficam a 5 mm uma da outra (o "Espaço entre peças") e o motor testa várias ordens de encaixe para gastar a menor altura de rolo. Com "Permitir girar 180°" marcado ele aperta ainda mais.
   - **Tamanho e nome em cada pedaço**: bem pequeno (4 mm, dá para mudar), dentro da peça, perto da barra, ex.: "12 FRENTE", "G COSTAS". O tamanho sai como foi digitado (número fica número, letra fica letra). O nome vem sozinho (peito com decote fundo = FRENTE, decote raso = COSTAS; SAIA, VIÉS…) e pode ser trocado na aba Peças, coluna "Nome no pedaço". Se o nome não couber no pedaço, sai só o tamanho.
   - **✏️ Corel editável**: um SVG por tamanho. No CorelDRAW use Arquivo → Importar: cada pedaço vem num grupo separado, com a estampa, a linha de corte em vetor e o número do tamanho como texto.
   - **Encaixe automático da grade completa**: junta todos os tamanhos (com a quantidade de cada um) num rolo só, na largura do tecido, diz quantos metros vai dar e baixa o TIFF do encaixe (LZW, abre no Corel, Photoshop e RIP).

## Provador (aba 6)

O Provador é independente da grade: fica liberado sempre e trabalha com o arquivo que você escolher nele.

0. **Arquivo da estampa**: escolha qualquer encaixe em TIFF ou PNG, com o contorno das peças. Se for o mesmo arquivo da grade, use "Usar o arquivo da grade". O ✕ remove o arquivo do Provador sem mexer na grade.
1. **Modelo**: a modelo padrão já vem carregada nas três poses (frente, costas e lado). Dá para enviar outras modelos e remover as que você enviou.
2. **Manequim**: as três fotos são obrigatórias — frente, lateral e costas —, com o manequim vestido com a roupa impressa a partir do arquivo lido na aba Arquivo. Tire as três da mesma distância. O ✕ remove a foto.
3. **Ler manequim**: o motor procura cada peça do arquivo nas fotos. Primeiro mede a escala da foto pelas medidas reais das peças (frente e costas; a lateral usa a mesma escala), depois acha o lugar exato de cada peça e mostra a confiança. Se o Provador estiver sem arquivo de estampa, a leitura usa sozinha o arquivo da grade. Todas as peças com estampa vão para a modelo: as que não aparecerem em nenhuma foto são colocadas automaticamente (no lado espelhado da peça igual a ela, quando houver) e ficam marcadas na tabela para você conferir.
4. **Modelo vestida**: cada peça entra como o fundo dela mais os elementos da estampa (cada flor ou motivo solto). Em "Mover elemento", clique numa flor para mexer só nela; em "Mover peça inteira", o fundo e os elementos se movem juntos. Arraste para mover, puxe o quadradinho do canto para mudar o tamanho e a bolinha de cima para girar. Os botões centralizam, espelham e mudam a ordem.
5. **Baixar prévia (PNG)**: salva a vista atual.

A prévia coloca a estampa do arquivo na posição certa por cima da roupa da modelo. A foto realista, com caimento de tecido, precisa de um serviço de IA de imagem, que ainda não está ligado.

## Regras da estampa

- **Segue a barra**: flores presas na borda (barra da saia). Elas acompanham a curva nova e mantêm a altura; a largura acompanha a peça, e o aviso diz quanto.
- **Estampa fixa**: a estampa não muda de tamanho, fica no mesmo lado da peça, e o fundo cresce em volta.
- **Estica com a peça**: a estampa aumenta ou diminui junto com a peça.
- **Só fundo**: só a cor de fundo (viés).

## Limites

- O PDF precisa ter texto (uma tabela de medidas). PDF que é só desenho do molde ou imagem escaneada não é lido: nesse caso, digite as medidas na tabela.
- Tamanhos com número (36, 38…) não são reconhecidos sozinhos no PDF. Digite-os no campo de tamanhos e preencha as medidas.
- A grade automática aumenta a peça por proporção. Ela não substitui a graduação da modelista em peças que mudam de formato entre os tamanhos.

## v10 (11/11)
- **Borda de corte ajustável**: aba Gerar → "Borda de corte" (padrão 3 mm). Vale para TIFF, Corel e encaixe.
- **Nome de cada pedaço**: dois cliques no texto amarelo da peça (ou na coluna Nome da tabela) e escreva (ex.: MANGA ESQ). Arraste o texto para onde ele deve ficar. "Escrever na peça" desmarcado = peça sem nome.
- **Tamanhos iguais aos da modelista**: aba Grade → "Pela modelista: outro tamanho pronto (arquivo)". Escolha o tamanho (ex.: 6) e abra o arquivo que a modelista já fez nesse tamanho. O motor mede cada peça e passa a graduar pela diferença real entre o tamanho base e esse arquivo (os outros tamanhos seguem a mesma proporção). Sem esse arquivo, o motor usa a tabela de mercado — por isso o 6 do motor saía diferente do 6 da modelista.

## v11 (11/11) — o motor aprende com cada trabalho
- **Moldes da modelista (PDFs por tamanho)**: aba Grade. Mande os PDFs só com o contorno (um por tamanho, tamanho no fim do nome: `Vestido_Antonella_6.pdf`). O motor mede cada peça em cada PDF (medida real do PDF, sem erro de escala), casa com as peças do arquivo da estampa e gradua por eles. Tamanho sem PDF segue a mesma regra entre os que têm. Dá para trocar o molde de cada peça na lista. Avisa se algum tamanho ficar fora do esperado.
- **Salvar esta grade como padrão**: fim da aba Grade. Guarda as medidas de todas as peças em todos os tamanhos + configurações do Gerar (borda, espaço, rolo, nome na peça…).
- **Grade salva (padrão da casa)**: escolha o modelo e o motor usa a graduação e as configurações dele. Ao abrir um arquivo parecido com um modelo salvo, aparece a faixa verde "💡 Esse arquivo parece o modelo…" com o botão Usar.
- As grades ficam salvas no navegador do computador. "Exportar grades" / "Importar grades" leva para outro computador.

## v12 (11/11) — girar o nome da peça
- Cada nome tem uma **bolinha azul ⟳**: clique = gira 15°; segure e arraste = gira com o mouse (de 5 em 5°; com Shift, livre); dois cliques na bolinha = volta reto.
- **Rodinha do mouse** em cima do nome também gira (5° por vez).
- Na aba Peças, coluna "Escrever na peça": campo ⟳ em graus (0 reto, 90 em pé, 180 de cabeça para baixo). O ↺ volta lugar e giro para o automático.
- Vale para todos os tamanhos, no TIFF, no encaixe e no Corel (texto continua editável, girado).

## v13 (11/11) — letra e separar número/nome
- Passe o mouse em cima do nome: aparecem 3 bolinhas. **⟳ azul** gira · **⤡ roxa** muda o tamanho da letra (arraste para fora = maior, para dentro = menor; clique = +0,5 mm; dois cliques = volta ao padrão) · **✂ laranja** separa número e nome (cada um com lugar, giro e letra próprios; 🔗 junta de novo).
- **Ctrl + rodinha** em cima do nome muda a letra; rodinha sozinha gira.
- Aba Peças: campos "letra … mm" e "separar nº e nome" em cada peça.
- No Corel o número sai como `Tamanho_N` e o nome como `Nome_N`, os dois editáveis.

## v14 (11/11) — conferência de dpi pelo molde
- Com os PDFs da modelista incluindo o do tamanho base, o motor compara cada peça do arquivo da estampa com o molde base. Se todas estão maiores ou menores na mesma proporção, aparece o aviso vermelho com o dpi certo e o botão "Corrigir para … dpi" (causa de "a grade saiu toda pequena").

## v15 (11/11) — a grade sai EM CIMA dos PDFs da modelista
- No modo "Moldes da modelista", cada tamanho que tem PDF sai com o **contorno exato do molde daquele tamanho** (desenhado do PDF no dpi do arquivo, até o meio da linha do molde) e a **medida real** dele — não é mais a peça base esticada. A estampa é recolocada dentro do molde novo pela regra de cada peça (barra, fixa, esticar).
- O motor acha sozinho se o molde está em pé/deitado, virado ou espelhado no PDF, e separa peças do mesmo tamanho pelo formato (ex.: frente e costas).
- Tamanhos sem PDF continuam pela regra entre os que têm.
- Nome e número podem ficar bem pequenos: a partir de 0,3 mm (rodinha/bolinha vão de 0,1 em 0,1 mm abaixo de 2 mm).

## v16 (11/11) — o caminho é: estampa + PDFs
- Aba Arquivo: **1️⃣ arquivo com a estampa (tamanho base)** e **2️⃣ PDFs da grade da modelista (todos de uma vez)**. Os tamanhos da grade saem dos nomes dos PDFs. Pode escolher os PDFs antes de ler; são lidos junto.
- Aba Grade: "Moldes da modelista" é o padrão. A opção de percentual saiu da tela. Mercado / tabela / outro tamanho ficaram em "Outros jeitos (só quando não tiver os PDFs)".

## v17 (11/11) — nome do molde vai para a estampa
- Ao ler os PDFs, o motor lê o nome escrito dentro de cada molde (ex.: "FRENTE E COSTA 2X - 6 - 6", "2 MANGA 2X - 6 - 6") e escreve esse nome na peça certa da estampa (FRENTE E COSTA, 2 MANGA, 1 MANGA, COSTA, FRENTE). Vai junto com o número do tamanho em cada arquivo gerado.
- A tabela da aba Grade mostra o "Nome no molde". Nome escrito à mão (dois cliques) não é trocado.

## v18 (11/11) — a matemática da modelista
- **Estampa acompanha a graduação** (regra nova, padrão): cada elemento da estampa (vaso, flor, faixa) muda de lugar proporcional ao molde novo e **diminui/aumenta junto com a graduação, sem deformar**. O que está perto da barra mantém a distância proporcional até ela; faixas largas (linha, barrado) seguem a curva da barra. As regras antigas continuam na aba Peças.
- **Tabela de graduação da modelista (DX/DY)** na aba Grade: marque os pontos da peça (botão "Pontos nos cantos" ou clique no contorno) e digite DX/DY de cada tamanho, igual ao caderno dela (DX + direita, DY + para cima; cada valor = do tamanho vizinho mais perto do base até ele). O contorno entre os pontos acompanha. Linha vermelha/verde mostra o menor e o maior tamanho na hora. Peça espelhada (short esquerdo/direito) usa a mesma tabela com DX invertido. Fica salva junto com a "Grade salva".
- **dpi**: o motor agora lê a resolução gravada no PNG/JPG; com o PDF do tamanho base, corrige o dpi sozinho quando todas as peças estão na mesma proporção errada.

## v19 (11/11) — automático da casa (aprende sozinho)
- Toda peça sem PDF e sem tabela agora gradua pelo **jeito da modelista de vocês**, não pelo mercado: corpo, short/calça, manga, saia e acabamentos (viés, gola, cós), reconhecidos pelo nome da peça.
- Começa com a tabela do caderno dela (blusa e short) e **aprende sozinho** a cada modelo em que vocês colocam os PDFs (uma vez por modelo). A aba Grade → "🤖 Automático da casa" mostra quanto cada família cresce/diminui por tamanho e de quantos modelos aprendeu.
- O aprendizado fica no navegador do computador onde foi feito.
- **Peças iguais em posições diferentes** (ex.: duas costas, uma de cabeça para baixo ou deitada): o motor reconhece pelo contorno que é a mesma peça, gradua as duas igual e o molde de cada uma acompanha a posição dela — o desenho segue a modelagem de cada peça.

## v23 (11/11) — nome rente à borda
- O lugar do nome/número agora é calculado pelo formato real das letras (antes era um círculo em volta do texto, que empurrava nomes compridos para o meio da estampa). Dá para deixar o nome no pezinho da peça, quase colado na borda preta (o laser corta e a bainha/overlock cobre), em qualquer giro.
- Na tela, o nome não tem mais a barra grossa de cor: só um contorno fino, para ver exatamente onde ele fica.

## v24 (11/11) — compactar o encaixe
- **🗜️ Compactar o encaixe** (aba Gerar, já vem marcado): além de testar várias ordens de entrada, o motor testa dois jeitos de colocar as peças (fundo mais baixo / mais para cima e à esquerda) e depois "aperta o rolo": tira as peças do fim, recoloca nos vãos que sobraram e tenta um rolo cada vez mais curto. Vale para o TIFF de cada tamanho, o arquivo do Corel e o encaixe automático da grade completa (que também passa a usar células de ~2 mm em vez de 5 mm, para as peças chegarem mais perto). Demora alguns segundos a mais.
- **Outros giros autorizados**: campo ao lado de "Permitir girar 180°". Escreva os ângulos que vocês liberam, separados por vírgula (ex.: `90, 270`, ou pequenos giros como `5, 355`). O motor só usa os giros marcados/escritos. Giros fora de 0°/180° mudam o sentido do fio do tecido na peça.
- O Corel e o TIFF de cada tamanho usam **o mesmo encaixe** montado no "Gerar grade" (antes o Corel montava outro encaixe e podia sair diferente).
- O encaixe ficou mais rápido para achar lugar (pula as linhas do rolo que não têm vão do tamanho da peça).
- Dica: o espaço entre peças pesa muito no gasto de tecido. De 5 mm para 3 mm, o mesmo encaixe de teste ficou ~4% mais curto.

## v25 (11/11) — manter o encaixe original
- **📐 Manter o encaixe original do arquivo (só muda a altura)** — aba Gerar, já vem marcado. Cada peça sai no mesmo lugar e no mesmo sentido do arquivo base montado pela equipe (mesma coluna da largura, mesma ordem de cima para baixo). A largura do rolo não muda; a peça que cresceu empurra as de baixo e a que diminuiu sobe até encostar. Só quando não cabe mais na coluna ela anda para o lado (fica o jeito mais fiel, a não ser que outro gaste pelo menos 2% menos tecido). Vale para o TIFF e o Corel. Desmarcado, volta o encaixe automático da v24.

## v26 (12/11) — nome na pontinha
- Nome/número colocado à mão (arrastado na aba Peças) agora fica **ali**: se o texto não cabe no lugar escolhido (ex.: pontinha da peça), a letra diminui e, se precisar, fica só o número — antes ele empurrava o texto inteiro para o meio da peça. Vale para o TIFF e para o Corel (mesma regra).
- **Trocar a cor do fundo sem contorno nos desenhos**: na beira de cada desenho (margaridas, vasos, letras), o pixel é uma mistura do desenho com o fundo antigo. Ao trocar o fundo (ex.: azul-marinho → verde) essa mistura ficava com o azul e aparecia um contorno azul em volta das flores (e um "quadrado" do fundo antigo em volta de alguns desenhos). Agora o motor calcula quanto de desenho tem em cada pixel da beira e troca só a parte do fundo pela cor nova. Teste: círculo branco em azul-marinho trocado para verde — antes a beira saía até 74 tons fora, agora 1. Com a cor original do fundo nada muda.
- **Tamanho base em cima do molde da modelista**: o tamanho base (o do arquivo da estampa) agora também sai com o contorno do PDF da modelista daquele tamanho, quando ele foi enviado. Antes o base saía com a peça desenhada no arquivo; se ela estava um pouco menor que o molde da Gaby (diferença abaixo de 4%, que o motor não corrigia), a peça ficava menor que o molde.
- **Medida exata do molde do PDF**: a borda do molde agora vai exatamente até o meio da linha do PDF, com a espessura da linha medida no próprio PDF. Antes o motor supunha linha de 1,6 mm e, com linha fina, cada molde saía ~1,2 mm menor (teste: retângulo de 20 × 30 cm saía 19,88 × 29,88; agora 20,00 × 30,00).

## v27 (12/11) — cores da estampa e molde repetido
- **🎨 Cores da estampa** (aba Estampa): aparecem todas as cores dos desenhos (as parecidas viram uma só, com a % de cada uma). Clique numa cor para trocar **em todas as peças**; para trocar **só uma parte** (uma listra, uma flor, um vaso), clique nela na imagem e escolha a cor nova — a parte é a área daquela cor ligada ao ponto clicado. Cada troca aparece numerada na lista e dá para tirar (✕) ou voltar tudo (↺). A troca mantém sombra e beira macia (mesmo cálculo da troca do fundo). Vale para o TIFF e o Corel.
- **Mesmo molde para duas peças**: quando o PDF da modelista tem um molde só para duas peças do arquivo (ex.: "FRENTE E COSTA", cortar 2) e o arquivo tem as duas desenhadas separadas, as duas agora usam o molde (vale para qualquer pedaço repetido no arquivo — manga 2×, frente e costas… — de pé ou deitado: o motor faz no repetido exatamente o que fez no que casou com o PDF; só repete quando é o mesmo pedaço, com até ~6% de diferença de medida, para não pôr molde errado numa peça que não tem PDF). Antes só uma casava com o molde e a outra saía pela graduação automática — com outra medida e outra abertura das costas (foto 12/11).

## v28 (12/11) — testado com o Vestido Antonella (arquivo 12 + PDFs 2 a 14)
Gerado aqui com os arquivos reais da equipe. Três coisas estavam erradas e foram corrigidas:
- **Peça torta no arquivo** (uma COSTAS desenhada girada uns 34°): o motor não reconhecia, ela ficava sem molde e saía com outra medida e outra abertura. Agora a peça torta é endireitada na leitura (o motor acha o menor retângulo em volta dela) e casa com o molde certo — sai igual à outra COSTAS.
- **Frente e costas trocando de molde entre os tamanhos**: os dois moldes têm quase a mesma medida (20,1 × 41,4 e 19,4 × 41,4 no 12). Como o motor ligava os moldes de um tamanho para o outro só pela medida, nos tamanhos 2 a 10 e 14 a FRENTE pegava o molde da COSTAS (com a abertura) e vice-versa. Agora ele compara também o desenho do molde (a costas tem a abertura) e escolhe o molde de cada peça pelo formato; e cada peça fica com o molde do grupo, a não ser que outro coincida claramente melhor.
- Conferido: nos tamanhos 2, 12 e 14 todas as 10 peças saem em cima do molde da modelista, as duas FRENTES iguais (sem abertura), as duas COSTAS iguais (com abertura), as mangas e a frente-e-costa repetidas iguais, na medida do PDF.

## v29 (12/11) — borda para fora da risca e nome no canto
- **Borda preta (contorno de corte) da risca da modelagem para FORA**: quando a peça vem do PDF da modelista, a borda (ex.: 3 mm) agora é acrescentada do lado de fora da risca — a peça fica com a medida do molde + a borda de cada lado, e o laser corta no lado de dentro da borda, exatamente na risca. Antes a borda era desenhada para dentro e a peça ficava ~6 mm menor que o molde. Conferido no Vestido Antonella 12: molde 70,74 × 58,23 cm → peça 71,35 × 58,84 cm (borda de 3,05 mm de cada lado), igual ao arquivo montado pela equipe (71,4 × 58,8). A borda é feita pela distância exata até a risca (fica redonda nas curvas, sem engordar nas diagonais).
- No **Corel**, a linha de corte ("Corte_") passa na risca da modelagem (lado de dentro da borda preta).
- **Nome no canto**: o nome continua inteiro no canto escolhido; se não couber exatamente ali, escorrega um pouco ao longo da beira (até meia palavra) em vez de diminuir para só o número ou ir para o meio. Teste com "FRENTE E COSTA" no canto, tamanhos 2 e 12: fica no canto, inteiro, no tamanho de letra escolhido, girado como foi posto.

## v30 (12/11) — nomes e números acompanham a graduação e mudam de cor
- **Letra acompanha a graduação**: o tamanho da letra de cada nome/número cresce e diminui junto com a peça (ex.: 4 mm no 12 → 3,4 mm no 2, 4,1 mm no 14 no Vestido Antonella).
- **Lugar preso ao canto escolhido**: o texto fica preso à beira/canto mais perto de onde foi posto; se a peça cresceu para aquele lado, o texto anda junto o mesmo tanto (e a distância até a beira cresce na mesma proporção), sem sair do lugar escolhido.
- **Cor dos nomes e números** (aba Gerar, ao lado de "Altura do número"): escolha a cor; com "automática" marcada continua preto no fundo claro e branco no escuro. Vale no TIFF e no Corel.
- O texto continua girando junto com a peça no encaixe (no TIFF ele é desenhado na peça; no Corel fica dentro do grupo da peça).

## v31 (12/11) — salvar o lugar dos nomes
- Embaixo da imagem da aba Peças: **💾 Salvar o lugar dos nomes** grava, para este arquivo da estampa, o lugar, o giro, o tamanho da letra, o nome e o "escrever na peça" de cada peça (fica neste computador). Quando o mesmo arquivo for aberto de novo, os nomes **voltam sozinhos** para os lugares salvos. **📌 Colar o lugar salvo** põe de volta na hora (por exemplo, depois de mexer e querer voltar). Cada peça é achada pelo número e pela medida (vale mesmo se a ordem mudar).

## v32 (12/11) — Corel mais leve
- O arquivo editável do Corel ficou bem mais leve: a estampa de cada peça vai em **JPG recortado pelo contorno da peça** (em vez de PNG) e, no modo **leve** (padrão), a 150 dpi. Vestido Antonella tamanho 12: **14,6 MB → 3,5 MB** (4 vezes menor). Escolha ao lado do botão do Corel (aba Gerar): **leve** (recomendado, para conferir e editar), **médio** (JPG na resolução do arquivo) ou **original** (PNG cheio, o pesado de antes). Peças, linha de corte, nomes e números continuam separados e editáveis. O TIFF de impressão continua sempre na resolução cheia.

## v33 (12/11) — Corel sem perda (padrão)
- Novo modo **sem perda** (padrão) no arquivo do Corel: a estampa vai pixel a pixel igual ao TIFF (conferido: 0 pixels diferentes em 23 milhões), num PNG compactado pelo próprio motor — sem canal de transparência (a peça é recortada pela linha dela) e com o melhor filtro escolhido linha a linha. Vestido Antonella 12: **14,6 MB → 9,6 MB** sem perder nada. Demora uns segundos a mais para montar. Os modos leve/médio (JPG, menores, com pequena perda) e original continuam na lista.

## v34 (12/11) — nome colado no contorno
- O nome posto rente à beira continua **colado na beira** em todos os tamanhos, também nas beiras inclinadas (ex.: "COSTA" deitado ao longo da lateral da costas). O motor mede, no arquivo base, a distância do nome até a beira mais perto e põe o nome na mesma beira da peça nova, à mesma distância (acompanhando a graduação). Antes ele usava a caixa reta em volta da peça e, numa beira inclinada, o nome entrava para o meio. Teste com "COSTA" a 6,4 mm da beira no 12: 4,8 mm no 2, 5,3 mm no 6, 6,4 mm no 12, 6,6 mm no 14 — sempre na mesma altura da peça.

## v35 (12/11) — caixa e nomes seguem a peça torta
- Peça que no arquivo está girada (ex.: a COSTA nº 8 da Antonella) é endireitada para casar com o molde. A caixa pontilhada e os nomes eram desenhados retos, como se a peça não estivesse girada, e os nomes iam para onde a caixa mandava (até em cima de outra peça).
- Agora a caixa pontilhada gira junto com a peça, e o nome aparece em cima da peça, girado junto. Ao arrastar o nome, ele vai exatamente para o ponto da peça onde você soltou, e esse ponto vale para a grade toda.
- O clique para trocar cor de uma parte também acha o lugar certo nessas peças.
- Na grade, o nome procura a mesma beira do contorno (com a mesma inclinação), não o lado da caixa.

## v36 (12/11) — nome preso ao contorno, como o Digiflash do Confex Molde
- O motor agora reconhece o contorno de cada peça do mesmo jeito que a parte Digiflash do Confex Molde: segue a beira da peça, simplifica a linha e acha os cantos. Cada trecho entre dois cantos é um lado da modelagem.
- O nome fica preso a um lado: em que ponto do lado ele está e a que distância da beira. Nos outros tamanhos, o motor acha o mesmo lado (mesma direção e mesmo lugar da peça) e põe o nome no mesmo ponto, à mesma distância, crescendo junto com a graduação.
- A caixa pontilhada não decide mais o lugar do nome.

## v37 (12/11) — Montar a arte nos moldes (igual ao ClickMoldes do Corel)
- Na aba Arquivo tem a caixa nova **🎨 Montar a arte nos moldes**: não precisa mais do arquivo já estampado.
- **📐 Pegar os moldes do tamanho base**: usa o PDF da modelista do tamanho escolhido em "Este arquivo é o tamanho" (os do 2️⃣) ou um PDF escolhido ali. Cada molde vira um cartão com o nome e a quantidade lidos do molde (ex.: MANGA 2X).
- **🖼️ Artes**: uma ou várias imagens (PNG, JPG, TIFF). Em cada peça você escolhe a arte, o encaixe (cobrir a peça toda, caber inteira, esticar até a beira ou só a cor de fundo), a posição (centro, em cima, embaixo, esquerda, direita), a margem (sangria) e a cor de fundo. **⧉ Igual em todas** copia os ajustes de uma peça para as outras; "em todas" na arte põe aquela arte em todas as peças.
- **＋ Nome / número** e **＋ Logo / imagem**: texto (tamanho da letra em cm, cor, giro) ou imagem (largura em cm, giro). Clique em 📍 e depois na miniatura para pôr no lugar.
- **⟳ girar o molde** 90° (a arte continua em pé). Peça com quantidade 2 sai em par, com o molde do par espelhado (a arte e os textos não espelham).
- **✨ Montar e ler**: o motor monta o arquivo base (com a risca preta em volta de cada peça) e lê como se fosse o TIFF do Corel. Daí em diante é igual: Peças, Grade, Gerar, cada tamanho no molde da modelista. **⬇ Baixar o arquivo montado** salva o PNG.

## v38 (12/11) — pedaço branco por cima da peça vizinha no Corel
- No arquivo do Corel "sem perda" (v33), a imagem de cada peça era um retângulo sem transparência: o que ficava fora da peça saía BRANCO. Com as peças encaixadas, o canto desse retângulo passava por cima da peça vizinha e aparecia como um pedaço branco em cima dela.
- Agora a imagem sai com transparência (PNG RGBA, continua sem perder nada de qualidade) e cada peça é recortada pelo próprio contorno (também quando tem sangria). Nada de fora da peça cobre a vizinha.

## v39 (12/11) — Uniforme: nomes e números (simples)
- Fluxo de sempre: lê o arquivo base já estampado. Na aba **Peças** tem o quadro **👕 Uniforme: nomes e números**.
- **＋ Número nas costas**, **＋ Nome nas costas**, **＋ Número na frente**: aparecem na imagem; arraste para o lugar (rodinha do mouse muda o tamanho). Em cada um: peça, tamanho da letra (mm), fonte, cor e contorno. Por padrão o número tem **o mesmo tamanho em toda a grade** (como no uniforme); desmarcando, ele cresce com a peça.
- **Lista de jogadores**: uma linha por jogador — NOME; NÚMERO; TAMANHO (cola do Excel/WhatsApp). Mostra quantos por tamanho e avisa tamanho que não está na grade.
- Ao gerar, cada tamanho que tem jogador sai num arquivo só, com o jogo completo de peças de cada jogador (nome e número dele) encaixado. Sem lista, sai um jogo de exemplo.
- A caixa "Montar a arte nos moldes" (v37) continua lá, fechada, como opção avançada.

## v42 (13/11) — bordado e consumo diferente em cada cor (vídeos dos designers, estampa da Milena)
- **Trocar a cor com os tons (bordado, degradê):** na aba Estampa → Cores, marque "trocar a cor com os tons" e clique
  no bordado. O motor pega todos os tons da mesma cor (luz e sombra da linha) e leva para a cor nova mantendo a sombra.
  "quanto pegar" aumenta ou diminui os tons que entram; "em todas as peças" troca em todo o arquivo.
  (Antes, no bordado, só mudava um pontinho: no teste, 1 pixel com a cor exata contra 9.842 com os tons.)
- **Outra cor da mesma estampa (aba Arquivo):** quando a cor for trocada no Photoshop, envie o arquivo novo na caixa
  "Outra cor da mesma estampa". O motor troca só a arte e mantém as peças, a grade, os nomes, o encaixe e o dpi do
  arquivo base — o consumo fica igual em todas as cores. Arquivo salvo com outra resolução (ex.: 72 dpi do Photoshop)
  é ajustado sozinho. "↺ Voltar para a arte do arquivo base" desfaz.
- Por que mudava o consumo: ao reler o arquivo do Photoshop, ele vinha com outro dpi ou com o contorno mexido, e o motor
  media as peças de novo. Agora a medida vem sempre do arquivo base.
- Nada da v41, v40 e anteriores foi mexido (a troca de cor exata e por parte continua igual).

## v41 (13/11) — "Faltam medidas válidas: Peito G1, G2, G3" (blusa nova)
- Os tamanhos plus size G1, G2, G3, G4 e G5 não estavam na tabela de medidas de mercado. A tela criava a linha deles vazia
  e o vazio era lido como medida 0, então a grade travava dizendo que faltava medida (só a modelagem nova da blusa tinha G1 a G3).
- Agora G1 a G5 têm busto e estatura de mercado, e qualquer medida vazia, zero ou inválida passa para o próximo jeito de
  calcular (casa da modelista → mercado → automático), em vez de travar.
- Se mesmo assim faltar, a mensagem diz o que fazer: digitar a medida na aba 4 · Grade ou tirar o tamanho da grade.
- Nada da v40 (cores e tamanho dos nomes) nem das anteriores foi mexido.

## v40 (13/11) — cor e tamanho dos nomes (vídeo)
- Escolheu a cor dos nomes e números no Gerar → vale a cor escolhida: a caixinha "automática" desmarca sozinha (antes ela continuava marcada e mandava no lugar da cor escolhida).
- Corel com a cor automática agora sai igual ao TIFF: branco no fundo escuro, preto no claro (antes o Corel saía sempre preto).
- "Altura do número" do Gerar vale para todas as peças, e o botão **🔠 Mesma letra em todas** tira a letra própria que alguma peça tenha guardado (a manga estava saindo com a letra bem maior). Depois clique em 💾 Salvar para guardar.

## v43 (14/11) — digitar o código da cor sem o seletor fechar
- Designer: em **Estampa → Cores da estampa**, ao digitar o código no seletor de cor (ex.: #04244C) ele fechava a cada tecla e a cor ia para preto.
- Agora o seletor não fecha enquanto escolhe ou digita; a lista de cores só se redesenha quando o seletor fecha.
- Ao lado de cada cor nova tem uma **caixinha com o código**: digite (ex.: `#04244C`) e aperte **Enter**. Vale para "Cores da estampa", "trocar com os tons" e "só esta parte". Nada do que existia mudou.
