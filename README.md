# Elemental

Mapa interativo para gerenciamento de spots elementais.

## Recursos

- Mapas Alkamar, Ubaid, Debenter, Uruk e Nars
- Servidores 1–12 e 14–18
- Spots independentes por mapa e servidor
- Busca global por personagem ou dono
- Seleção pesquisável de personagem ao criar ou editar um spot
- Nomes completos na barra lateral
- Compartilhamento por link

Senha configurada no projeto: `eofarmas`


## Separação do MegaHunt

Esta versão usa coleções próprias no Firestore:

- `elemental_characters`
- `elemental_spots`

Na primeira abertura, os documentos antigos do Elemental que estavam nas coleções `characters` e `spots` são migrados automaticamente e removidos dessas coleções. Isso impede que personagens e spots do Elemental apareçam no MegaHunt.

Caso o Firebase mostre `permission-denied`, permita leitura e gravação nessas duas coleções nas regras do Firestore.
