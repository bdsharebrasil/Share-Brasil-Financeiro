# Camadas da Agenda de Voos

A agenda e o rastreio usam MapLibre. Terrestre (OpenStreetMap) e satélite (Esri) têm fontes distintas. A seleção preserva rota e marcadores.

As cartas brasileiras de rota são publicadas no GeoAISWEB/DECEA: https://geoaisweb.decea.mil.br/ (ENRC-H, espaço aéreo superior; ENRC-L, espaço aéreo inferior).

Configure duas fontes georreferenciadas separadas no ambiente de build do frontend:
- VITE_MAPA_ENRC_ALTA_TILES
- VITE_MAPA_ENRC_BAIXA_TILES

Cada fonte aceita HTTPS XYZ com {z}/{x}/{y} ou uma URL de GetMap WMS com CRS EPSG:3857, formato de imagem, WIDTH=256, HEIGHT=256 e BBOX={bbox-epsg-3857}, com acesso/CORS permitidos. A URL deve apontar à camada correta, vigente e licenciada. O acesso público ao catálogo de geosserviços não pôde ser validado nesta implementação; não há endereço WMS oficial presumido. Sem fonte ou em erro de carregamento, o mapa mostra aviso e link oficial, nunca uma base terrestre chamada de carta.

Configure as variáveis no Cloudflare Pages e gere um novo build. Não inserir credenciais privadas em variáveis VITE_ (expostas ao navegador). Verificar cobertura, ciclo AIRAC, vigência e NOTAM antes de uso. O painel é de referência operacional e não substitui publicações oficiais ou autorização ATC.
