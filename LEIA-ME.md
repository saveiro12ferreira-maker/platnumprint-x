# platnumprint-x

Motor de grade: lê o encaixe de um tamanho pronto e refaz a modelagem completa nos outros tamanhos, com a estampa no lugar certo, já encaixada no rolo.

## Como abrir

Dê dois cliques em `index.html`. Abre no Edge ou no Chrome. Não precisa instalar nada, mas precisa de internet na primeira vez, porque os leitores de TIFF e de PDF vêm da internet.

## Passo a passo

1. **Arquivo**: com "Gerar a grade completa logo depois de ler" marcado, um clique em Ler já entrega todos os tamanhos prontos na aba Gerar. Exporte o encaixe do Corel em TIFF (como o `Azul Petróleo Ryan.tif`), com o contorno das peças e o fundo do papel branco ou transparente. Informe de que tamanho ele é e quais tamanhos fazem parte da grade.
2. **Peças**: o motor numera cada peça e diz o tipo e a regra da estampa. A conferência no topo refaz o tamanho base e compara com o original: precisa dar perto de 100%. Se alguma peça estiver errada, corrija o tipo ou a regra ali mesmo.
3. **Estampa**: mostra a cor de fundo e o contorno de corte que o motor leu.
4. **Grade**:
   - *Automática*: um percentual por tamanho para cada tipo de peça.
   - *Grade da modelista (PDF)*: envie o PDF com a tabela de medidas. O motor lê a tabela, você confere os números e escolhe qual medida comanda cada peça.
   - Qualquer medida pode ser corrigida na mão na tabela final.
5. **Gerar**: monta todos os tamanhos, mostra uma prévia com avisos e baixa um TIFF por tamanho, em 200 dpi, pronto para o RIP.

## Provador (aba 6)

1. **Modelo**: a modelo padrão já vem carregada nas três poses (frente, costas e lado). Dá para enviar outras modelos e remover as que você enviou.
2. **Manequim**: as três fotos são obrigatórias — frente, lateral e costas —, com o manequim vestido com a roupa impressa a partir do arquivo lido na aba Arquivo. Tire as três da mesma distância. O ✕ remove a foto.
3. **Ler manequim**: o motor procura cada peça do arquivo nas fotos. Primeiro mede a escala da foto pelas medidas reais das peças (frente e costas; a lateral usa a mesma escala), depois acha o lugar exato de cada peça e mostra a confiança. O que ele não achar, avisa para você colocar à mão.
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
