# Elemental

Mapa interativo para gerenciamento de spots elementais.

## Mapas
- Alkamar
- Ubaid
- Debenter
- Uruk
- Nars

## Servidores
1–12 e 14–18. Cada combinação de mapa e servidor possui spots independentes.

## Acesso
A senha configurada em `password.js` é `eofarmas`.

## Publicação no GitHub Pages
1. Crie um repositório novo e envie todos os arquivos desta pasta.
2. Abra **Settings > Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**.
4. Escolha a branch `main` e a pasta `/root`.

## Firebase
O projeto usa a configuração existente em `config.js`, porém grava os dados nas coleções exclusivas:
- `elemental_characters`
- `elemental_spots`

Assim, os dados do projeto original permanecem separados.
