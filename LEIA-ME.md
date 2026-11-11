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
