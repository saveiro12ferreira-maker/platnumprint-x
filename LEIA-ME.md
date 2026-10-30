# platnumprint-x

Motor de grade: lê o encaixe de um tamanho pronto e refaz a modelagem completa nos outros tamanhos, com a estampa no lugar certo, já encaixada no rolo.

## Como abrir

Dê dois cliques em `index.html`. Abre no Edge ou no Chrome. Não precisa instalar nada, mas precisa de internet na primeira vez, porque os leitores de TIFF e de PDF vêm da internet.

## Passo a passo

1. **Arquivo**: exporte o encaixe do Corel em TIFF (como o `Azul Petróleo Ryan.tif`), com o contorno das peças e o fundo do papel branco ou transparente. Informe de que tamanho ele é e quais tamanhos fazem parte da grade.
2. **Peças**: o motor numera cada peça e diz o tipo e a regra da estampa. A conferência no topo refaz o tamanho base e compara com o original: precisa dar perto de 100%. Se alguma peça estiver errada, corrija o tipo ou a regra ali mesmo.
3. **Estampa**: mostra a cor de fundo e o contorno de corte que o motor leu.
4. **Grade**:
   - *Automática*: um percentual por tamanho para cada tipo de peça.
   - *Grade da modelista (PDF)*: envie o PDF com a tabela de medidas. O motor lê a tabela, você confere os números e escolhe qual medida comanda cada peça.
   - Qualquer medida pode ser corrigida na mão na tabela final.
5. **Gerar**: monta todos os tamanhos, mostra uma prévia com avisos e baixa um TIFF por tamanho, em 200 dpi, pronto para o RIP.

## Regras da estampa

- **Segue a barra**: flores presas na borda (barra da saia). Elas acompanham a curva nova e mantêm a altura; a largura acompanha a peça, e o aviso diz quanto.
- **Estampa fixa**: a estampa não muda de tamanho, fica no mesmo lado da peça, e o fundo cresce em volta.
- **Estica com a peça**: a estampa aumenta ou diminui junto com a peça.
- **Só fundo**: só a cor de fundo (viés).

## Limites

- O PDF precisa ter texto (uma tabela de medidas). PDF que é só desenho do molde ou imagem escaneada não é lido: nesse caso, digite as medidas na tabela.
- Tamanhos com número (36, 38…) não são reconhecidos sozinhos no PDF. Digite-os no campo de tamanhos e preencha as medidas.
- A grade automática aumenta a peça por proporção. Ela não substitui a graduação da modelista em peças que mudam de formato entre os tamanhos.
