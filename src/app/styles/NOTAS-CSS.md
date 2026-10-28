# Reglas sospechosas del CSS

Lista armada el 2026-10-26, al separar `globals.css` en varios archivos.

Es una lista para que decidas qué sacar: cada cosa que se saque hace la hoja
más corta y más fácil de entender, pero conviene sacarlas de a poco y mirando
la pantalla que toca.

Los números de línea son los de este commit. Si editás los archivos, se corren.

## Lo que ya se borró

**2026-10-26 — las 58 clases muertas de `checkout.css`** (punto 1, primera
tanda). Eran los restos del checkout viejo: el QR de Mercado Pago, el selector
de cuotas, elegir la app del banco, la transferencia manual. `checkout.css`
pasó de 1.954 líneas a 1.337.

Se fueron 87 reglas enteras, 2 bloques `@media` que quedaron sin nada adentro,
8 encabezados de sección que quedaron sin reglas debajo, y de una sola lista de
selectores se sacó la pieza muerta (`.cf-guest-btn` salió de
`.cf-btn-primary, .cf-google-btn, .cf-guest-btn`, que siguen ahí).

**2026-10-26 — las 27 clases muertas de `shared.css`** (punto 1, segunda
tanda). La "cinta de servicios" vieja de la home (`.service-ribbon`,
`.service-pill`), las tarjetas que ya no se dibujan (`.info-card`,
`.contact-box`, `.trust-strip`, `.trust-card`, `.catalog-hero`,
`.product-header`) y restos del editor (`.editor-grid`, `.editor-actions`,
`.dimension-row`, `.login-form`, `.modal-card`). `shared.css` pasó de 355
líneas a 285.

Acá casi todo el trabajo fue recortar listas: estas clases viajaban dentro de
12 listas largas de selectores compartidas con cosas que sí se usan, así que
de cada lista se sacaron sólo las piezas muertas. Además se fueron 5 reglas
enteras y un `@media (max-width: 760px)` que quedó sin nada adentro.

Ojo: varias de esas clases también tienen reglas en `layout.css`, `home.css`
y `catalog.css`. Esas siguen ahí (ver más abajo), así que `.service-ribbon` y
compañía todavía aparecen en la hoja, aunque ya no puedan pintar nada.

**2026-10-28 — las clases muertas de `layout.css`, `home.css` y
`catalog.css`** (punto 1, tercera tanda). Acá terminaron de irse las reglas de
la cinta de servicios y de la franja de confianza, que vivían repartidas entre
varios archivos, más restos de `catalog.css`: el marco de foto cuando era un
`<button>` (hoy es un `div`), el resumen de catálogo, los badges de producto y
`.neutral`, un tercer estado de stock que nunca se usó.

- `layout.css` 1.239 → 1.162 líneas
- `home.css` 1.942 → 1.809
- `catalog.css` 2.686 → 2.585

Con esto no queda nada muerto en esos archivos. Siguen en pie `admin.css` (8),
`cart.css` (3) y `skeletons.css` (3).

**2026-10-28 — `admin.css`, `cart.css`, `skeletons.css` y lo último de
`globals.css`** (punto 1, cuarta y última tanda). El pill de login del admin,
el badge de "sin foto", los botones de reordenar destacados, el pie del
carrito, tres variantes de placeholder de carga que nunca se usaron y, en
`globals.css`, el último resto de `.image-frame-btn` (el efecto al tocarlo en
el celular).

- `admin.css` 1.248 → 1.188 líneas
- `cart.css` 498 → 479
- `skeletons.css` 97 → 94
- `globals.css` 90 → 85

**Con esto no queda ninguna clase muerta en toda la hoja.**

### Las dos que NO se borraron, y por qué importa

`.aop-avisos--activado` y `.aop-avisos--apagado` figuraban en esta lista y
**están vivas**. Estuve a punto de borrarlas. El motivo es que
`AvisosCelular.jsx` arma la clase pegando una variable:

```jsx
<section className={`aop-avisos aop-avisos--${estado}`}>
```

donde `estado` vale `activado`, `apagado`, `iphone`, `bloqueado` o
`no-soportado`. El texto `aop-avisos--activado` no está escrito en ningún
lado, así que buscar el nombre no lo encuentra. Son las que le dan el verde
al panel cuando los avisos están prendidos y el ámbar cuando están apagados.

Se revisó el proyecto entero: hay 40 lugares donde una clase se arma con
`${...}`, y **sólo dos** pegan una variable a un prefijo, los dos en
`AvisosCelular.jsx` (`aop-avisos--` e `is-`). En los otros 38 lo que se pega
son textos fijos, que la búsqueda sí ve. También se revisaron los cinco
commits anteriores: ninguno tocó una clase con esos prefijos.

La herramienta ahora saca sola esa lista de prefijos y no toca ninguna clase
que empiece con uno. Si algún día se agrega otro `className={`x-${algo}`}`,
queda cubierto sin tener que acordarse.

Todo lo demás de esta lista sigue en su lugar y la web se ve exactamente igual
que antes. Cómo se comprobó, al final del archivo.

---

## 1. Clases que no existen en ninguna pantalla (122, quedan 2 — a propósito)

Estas clases están escritas en el CSS pero no aparecen en ningún archivo
`.jsx`/`.js` del proyecto. O sea: el navegador lee esas reglas y nunca
encuentra a quién aplicárselas. Son candidatas directas a borrar.

La búsqueda es deliberadamente generosa (alcanza con que el nombre aparezca
en cualquier parte de cualquier archivo del front), así que si una clase está
en esta lista es porque realmente no se usa.

### ~~`src/app/styles/checkout.css` — 58~~ — BORRADAS el 2026-10-26

Quedan listadas como registro de lo que se sacó. Las líneas son las que tenían
antes de borrarlas.

- `.cf-transfer-submethod-btn` — 5 regla(s), línea(s) 1358, 1372, 1382, 1389, 1394
- `.cf-transfer-manual-toggle` — 4 regla(s), línea(s) 1102, 1114, 1115, 1120
- `.cf-transfer-method` — 4 regla(s), línea(s) 1138, 1152, 1157, 1162
- `.cf-app-btn` — 3 regla(s), línea(s) 1059, 1072
- `.cf-guest-btn` — 3 regla(s), línea(s) 1784, 1804, 1811
- `.cf-installment-btn` — 3 regla(s), línea(s) 801, 815, 819
- `.cf-mp-open-btn` — 3 regla(s), línea(s) 1465, 1484, 1489
- `.cf-app-grid` — 2 regla(s), línea(s) 1048, 1054
- `.cf-boleta-link` — 2 regla(s), línea(s) 1217, 1235
- `.cf-mp-browser-link` — 2 regla(s), línea(s) 1445, 1452
- `.cf-mp-secondary-btn` — 2 regla(s), línea(s) 1019, 1032
- `.cf-surcharge-breakdown` — 2 regla(s), línea(s) 842, 853
- `.cf-surcharge-total` — 2 regla(s), línea(s) 865, 872
- `.cf-transfer-alt-back` — 2 regla(s), línea(s) 1532, 1543
- `.cf-transfer-alt-toggle` — 2 regla(s), línea(s) 1499, 1515
- `.cf-transfer-confirm-note` — 2 regla(s), línea(s) 1547, 1558
- `.cf-transfer-fallback-note` — 2 regla(s), línea(s) 1245, 1258
- `.cf-transfer-manual` — 2 regla(s), línea(s) 1097, 1123
- `.cf-transfer-submethod-arrow` — 2 regla(s), línea(s) 1389, 1398
- `.cf-transfer-submethod-icon` — 2 regla(s), línea(s) 1377, 1389
- `.cf-transfer-total` — 2 regla(s), línea(s) 1188, 1198
- `.qr-frame` — 2 regla(s), línea(s) 10, 285
- `.cf-app-chooser` — 1 regla(s), línea(s) 1037
- `.cf-app-chooser-title` — 1 regla(s), línea(s) 1042
- `.cf-app-emoji` — 1 regla(s), línea(s) 1078
- `.cf-app-hint` — 1 regla(s), línea(s) 1089
- `.cf-app-name` — 1 regla(s), línea(s) 1082
- `.cf-inst-desc` — 1 regla(s), línea(s) 830
- `.cf-inst-label` — 1 regla(s), línea(s) 824
- `.cf-inst-total` — 1 regla(s), línea(s) 835
- `.cf-installment-label` — 1 regla(s), línea(s) 786
- `.cf-installment-options` — 1 regla(s), línea(s) 795
- `.cf-installment-selector` — 1 regla(s), línea(s) 782
- `.cf-mp-desktop` — 1 regla(s), línea(s) 1417
- `.cf-mp-instruction` — 1 regla(s), línea(s) 1409
- `.cf-mp-mobile` — 1 regla(s), línea(s) 1457
- `.cf-mp-note` — 1 regla(s), línea(s) 1438
- `.cf-mp-pay-panel` — 1 regla(s), línea(s) 1405
- `.cf-qr-img` — 1 regla(s), línea(s) 1433
- `.cf-qr-wrapper` — 1 regla(s), línea(s) 1425
- `.cf-surcharge-plus` — 1 regla(s), línea(s) 860
- `.cf-transfer-alias` — 1 regla(s), línea(s) 1182
- `.cf-transfer-alt` — 1 regla(s), línea(s) 1494
- `.cf-transfer-alt-arrow` — 1 regla(s), línea(s) 1521
- `.cf-transfer-apps-hint` — 1 regla(s), línea(s) 951
- `.cf-transfer-code` — 1 regla(s), línea(s) 1168
- `.cf-transfer-grid` — 1 regla(s), línea(s) 1133
- `.cf-transfer-icon` — 1 regla(s), línea(s) 1147
- `.cf-transfer-instruction` — 1 regla(s), línea(s) 945
- `.cf-transfer-note` — 1 regla(s), línea(s) 1203
- `.cf-transfer-panel--compact` — 1 regla(s), línea(s) 1526
- `.cf-transfer-submethods` — 1 regla(s), línea(s) 1344
- `.cf-transfer-subtitle` — 1 regla(s), línea(s) 1351
- `.cf-transfer-title` — 1 regla(s), línea(s) 1127
- `.cf-transfer-total-top` — 1 regla(s), línea(s) 1241
- `.qr-desktop-only` — 1 regla(s), línea(s) 1778
- `.qr-image` — 1 regla(s), línea(s) 19
- `.qr-modal` — 1 regla(s), línea(s) 6

### ~~`src/app/styles/shared.css` — 27~~ — BORRADAS el 2026-10-26

Igual que arriba: quedan como registro, con las líneas que tenían antes.
Varias de estas clases **siguen teniendo reglas en otros archivos**, que no se
tocaron: están más abajo, en las secciones de `layout.css`, `home.css`,
`catalog.css`, `admin.css`, `cart.css` y `skeletons.css`.

- `.info-card` — 9 regla(s), línea(s) 9, 32, 155, 171, 197, 280, 287, 292, 591
- `.service-ribbon` — 8 regla(s), línea(s) 9, 554, 559, 566, 576, 581, 720, 1053
- `.contact-box` — 7 regla(s), línea(s) 9, 32, 155, 171, 197, 280, 591
- `.service-pill` — 7 regla(s), línea(s) 155, 171, 617, 623, 1059, 1064, 1068
- `.trust-strip` — 6 regla(s), línea(s) 9, 116, 563, 826, 990, 994
- `.catalog-hero` — 5 regla(s), línea(s) 9, 116, 129, 670, 677
- `.header-brand-copy` — 4 regla(s), línea(s) 32, 190, 195, 572
- `.product-header` — 4 regla(s), línea(s) 197, 305, 312, 686
- `.trust-card` — 4 regla(s), línea(s) 35, 106, 155, 171
- `.trust-grid` — 4 regla(s), línea(s) 101, 141, 512, 642
- `.about-grid` — 3 regla(s), línea(s) 141, 274, 512
- `.cart-checkout` — 3 regla(s), línea(s) 99, 131, 348
- `.catalog-summary` — 3 regla(s), línea(s) 32, 255, 1416
- `.contact-grid` — 3 regla(s), línea(s) 141, 274, 512
- `.dimension-row` — 3 regla(s), línea(s) 141, 233, 274
- `.editor-actions` — 3 regla(s), línea(s) 141, 237, 274
- `.hero-home-text` — 3 regla(s), línea(s) 24, 32, 1068
- `.product-meta-row` — 3 regla(s), línea(s) 32, 50, 371
- `.big-action` — 2 regla(s), línea(s) 99, 348
- `.header-link` — 2 regla(s), línea(s) 32, 63
- `.modal-card` — 2 regla(s), línea(s) 9, 251
- `.product-badges` — 2 regla(s), línea(s) 50, 322
- `.upload-button` — 2 regla(s), línea(s) 99, 348
- `.visual-caption` — 2 regla(s), línea(s) 32, 249
- `.editor-grid` — 1 regla(s), línea(s) 227
- `.login-form` — 1 regla(s), línea(s) 227
- `.product-description-preview` — 1 regla(s), línea(s) 32

### ~~`src/app/styles/home.css` — 11~~ — BORRADAS el 2026-10-28

- `.trust-item` — 4 regla(s), línea(s) 836, 844, 845, 995
- `.dark` — 2 regla(s), línea(s) 287, 292
- `.welcome-location-item` — 2 regla(s), línea(s) 1359, 1371
- `.contact-link` — 1 regla(s), línea(s) 269
- `.feature-list` — 1 regla(s), línea(s) 296
- `.inline-link` — 1 regla(s), línea(s) 269
- `.trust-icon` — 1 regla(s), línea(s) 843
- `.visual-footer` — 1 regla(s), línea(s) 255
- `.welcome-location-address` — 1 regla(s), línea(s) 1375
- `.welcome-location-cta` — 1 regla(s), línea(s) 1380
- `.welcome-locations-list` — 1 regla(s), línea(s) 1345

### ~~`src/app/styles/catalog.css` — 9~~ — BORRADAS el 2026-10-28

- `.card-free-shipping` — 4 regla(s), línea(s) 2509, 2520, 2564, 2568
- `.image-frame-btn` — 3 regla(s), línea(s) 40, 962, 971
- `.card-actions-split` — 2 regla(s), línea(s) 402, 681
- `.catalog-summary-filter` — 1 regla(s), línea(s) 1144
- `.catalog-toolbar` — 1 regla(s), línea(s) 681
- `.modal-color-swatches` — 1 regla(s), línea(s) 957
- `.neutral` — 1 regla(s), línea(s) 349
- `.product-badge` — 1 regla(s), línea(s) 326
- `.related-price` — 1 regla(s), línea(s) 875

### ~~`src/app/styles/admin.css` — 8~~ — BORRADAS 6 el 2026-10-28 (ver abajo)

- `.featured-reorder-btn` — 3 regla(s), línea(s) 1053, 1066, 1067
- `.admin-login-pill` — 2 regla(s), línea(s) 13, 18
- `.admin-no-photo-badge` — 1 regla(s), línea(s) 86
- `.aop-avisos--activado` — 1 regla(s), línea(s) 1181
- `.aop-avisos--apagado` — 1 regla(s), línea(s) 1176
- `.editor-branch-stock-title` — 1 regla(s), línea(s) 171
- `.feat-order` — 1 regla(s), línea(s) 1048
- `.stock-btn-load` — 1 regla(s), línea(s) 151

### ~~`src/app/styles/layout.css` — 3~~ — BORRADAS el 2026-10-28

- `.footer-contact-link` — 2 regla(s), línea(s) 310, 315
- `.service-pill-branches` — 1 regla(s), línea(s) 721
- `.service-pill-desktop` — 1 regla(s), línea(s) 719

### ~~`src/app/styles/cart.css` — 3~~ — BORRADAS el 2026-10-28

- `.cart-checkout-actions` — 1 regla(s), línea(s) 125
- `.cart-footer-note` — 1 regla(s), línea(s) 367
- `.cart-price` — 1 regla(s), línea(s) 12

### ~~`src/app/styles/skeletons.css` — 3~~ — BORRADAS el 2026-10-28

- `.skeleton-card` — 1 regla(s), línea(s) 16
- `.skeleton-text` — 1 regla(s), línea(s) 13
- `.skeleton-title` — 1 regla(s), línea(s) 14

### Lo más gordo de todo esto

La mitad de `checkout.css` que no se usaba (`.cf-transfer-method`,
`.cf-installment-*`, `.cf-app-*`, `.cf-mp-*`, `.cf-qr-*`,
`.cf-surcharge-*`, `.cf-boleta-link`, `.cf-guest-btn`…) eran restos de
versiones anteriores del checkout: el pago con QR de Mercado Pago, el
selector de cuotas, el elegir la app del banco, la transferencia manual.
Nada de eso está hoy en `checkout-flow.jsx`. **Ya se borraron.**

`.service-ribbon` y `.service-pill*` son la "cinta de servicios" vieja de
la home, reemplazada por el banner informativo. Son ~15 reglas repartidas
entre `layout.css` y `shared.css`.

`.trust-strip`/`.trust-item`/`.trust-card`, `.info-card`,
`.contact-box`, `.catalog-hero` y `.product-header` son secciones de
inicio y catálogo que ya no se dibujan.

---

## 2. Declaraciones que nunca llegan a verse (266)

Acá el selector sí existe, pero la declaración la pisa otra igual que viene
después (mismo selector, mismo `@media`, misma propiedad). El navegador se
queda siempre con la última, así que la primera es peso muerto.

Muchas son a propósito: la hoja se fue armando por capas y cada arreglo
pisaba al anterior. Pero ahora que están una al lado de la otra se puede
juntar las dos en una sola regla.

### 2a. Con valores distintos (192) — gana la de abajo

#### `src/app/styles/catalog.css` — 76

```
L 177  .category-rail
        gap: 8px
        gana L2025: 7px
L1688  .related-visual
        background: radial-gradient(118% 86% at 50% 2%, #fffefa 0…
        gana L2220: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L  26  .product-category
        font-size: 0.76rem
        gana L319: 0.7rem
L 107  .search-wrapper
        min-width: 0
        gana L1110: 220px
L 112  .search-icon
        left: 18px
        gana L1431: 16px
L1114  .search-icon
        left: 14px
        gana L1431: 16px
L 113  .search-icon
        color: rgba(210, 162, 62, 0.65)
        gana L1432: var(--muted)
L 134  .search-input::placeholder
        color: rgba(245, 222, 185, 0.38)
        gana L144: rgba(120, 90, 40, 0.45)
L 139  .search-input:focus
        border-color: rgba(210, 162, 62, 0.6)
        gana L897: rgba(210, 162, 62, 0.5)
L 140  .search-input:focus
        box-shadow: 0 0 0 4px rgba(210, 162, 62, 0.1), 0 2px 10px…
        gana L898: 0 0 0 3px rgba(210, 162, 62, 0.12)
L 149  .search-clear
        right: 14px
        gana L1444: 12px
L1127  .search-clear
        right: 10px
        gana L1444: 12px
L 153  .search-clear
        width: 30px
        gana L1455: 24px
L 154  .search-clear
        height: 30px
        gana L1456: 24px
L 157  .search-clear
        background: rgba(210, 162, 62, 0.12)
        gana L1445: none
L 158  .search-clear
        color: #9a6e28
        gana L1447: var(--muted)
L1136  .search-clear
        transition: color 0.15s, background 0.15s
        gana L1457: background 0.15s
L 164  .search-clear:hover
        background: rgba(210, 162, 62, 0.25)
        gana L1461: rgba(88,61,28,0.08)
L1140  .search-clear:hover
        background: var(--gold-soft)
        gana L1461: rgba(88,61,28,0.08)
L 171  .catalog-filter-row
        gap: 12px
        gana L2612: 14px
L2013  .catalog-filter-row
        gap: 10px
        gana L2612: 14px
L 172  .catalog-filter-row
        overflow: hidden
        gana L2014: visible
L 262  .catalog-grid
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))
        gana L1630: repeat(auto-fill, minmax(268px, 1fr))
L 362  .price-tag
        font-weight: 800
        gana L887: 700
L 363  .price-tag
        letter-spacing: -0.04em
        gana L888: -0.03em
L 787  .product-card
        background: linear-gradient(160deg, #fffaf0 0%, #f8ecd6 1…
        gana L1657: linear-gradient(168deg, #fffdf6 0%, #fdf6e8 4…
L 788  .product-card
        border: 1.5px solid rgba(181, 133, 68, 0.32)
        gana L1656: 1.5px solid var(--vitrina-borde)
L 792  .product-card:hover
        border-color: rgba(210, 162, 62, 0.65)
        gana L1678: var(--vitrina-borde-hover)
L1518  .product-card:hover
        border-color: rgba(210, 162, 62, 0.28)
        gana L1678: var(--vitrina-borde-hover)
L 793  .product-card:hover
        box-shadow: 0 20px 44px rgba(120, 80, 40, 0.2)
        gana L1679: var(--vitrina-sombra-hover), 0 0 0 1px rgba(2…
L1517  .product-card:hover
        box-shadow: 0 16px 48px rgba(60, 30, 5, 0.16), 0 4px 12px…
        gana L1679: var(--vitrina-sombra-hover), 0 0 0 1px rgba(2…
L 798  .product-card .product-category
        color: var(--gold-strong)
        gana L2343: #8a5c14
L1778  .product-card .product-category
        color: var(--gold-strong)
        gana L2343: #8a5c14
L 846  .product-card .color-swatch
        background: rgba(255, 255, 255, 0.85)
        gana L1816: rgba(255, 255, 255, 0.82)
L 945  .color-swatch-dot
        width: 12px
        gana L1832: 13px
L 946  .color-swatch-dot
        height: 12px
        gana L1833: 13px
L 949  .color-swatch-dot
        border: 1px solid rgba(88, 61, 28, 0.15)
        gana L1834: 1px solid rgba(60, 40, 18, 0.28)
L 991  .catalog-grid .image-frame
        background: linear-gradient(160deg, #f6efe0 0%, #fbf6ea 5…
        gana L2220: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L1688  .catalog-grid .image-frame
        background: radial-gradient(118% 86% at 50% 2%, #fffefa 0…
        gana L2220: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L 992  .catalog-grid .image-frame
        border-bottom: 1px solid rgba(181, 133, 68, 0.16)
        gana L2623: 1px solid rgba(181, 133, 68, 0.24)
L1692  .catalog-grid .image-frame
        border-bottom: 1px solid rgba(181, 133, 68, 0.18)
        gana L2623: 1px solid rgba(181, 133, 68, 0.24)
L2224  .catalog-grid .image-frame
        border-bottom: 1px solid rgba(181, 133, 68, 0.2)
        gana L2623: 1px solid rgba(181, 133, 68, 0.24)
L1015  .card-carousel-dots
        z-index: 2
        gana L1697: 3
L1023  .card-carousel-dot
        background: rgba(255, 255, 255, 0.45)
        gana L1710: rgba(120, 84, 38, 0.28)
L1029  .card-carousel-dot.active
        background: rgba(255, 255, 255, 0.95)
        gana L1713: var(--gold-strong)
L1038  .product-card .card-actions
        margin-top: 10px
        gana L1844: auto
L1045  .product-card .card-actions .ghost-button
        font-size: 0.88rem
        gana L1888: 0.83rem
L1045  .product-card .card-actions .primary-button
        font-size: 0.88rem
        gana L1853: 0.92rem
L1130  .search-clear
        font-size: 1rem
        gana L1449: 0.9rem
L1134  .search-clear
        padding: 2px 4px
        gana L1450: 4px
L1163  .product-name
        transition: color 0.15s
        gana L1495: color 0.18s
L1212  .card-badge
        padding: 3px 9px
        gana L1718: 4px 10px
L1213  .card-badge
        border-radius: 20px
        gana L1719: 999px
L1214  .card-badge
        font-size: 0.7rem
        gana L1720: 0.68rem
L1216  .card-badge
        letter-spacing: 0.02em
        gana L1721: 0.03em
L1221  .card-badge-featured
        background: linear-gradient(90deg, #d4a017, #e8c547)
        gana L1726: linear-gradient(100deg, #e8bb4a 0%, #f5da8e 4…
L1222  .card-badge-featured
        color: #4a2e00
        gana L1727: #46280a
L1225  .card-badge-soldout
        background: rgba(60, 40, 20, 0.75)
        gana L1732: rgba(43, 29, 19, 0.82)
L1226  .card-badge-soldout
        color: #f5e8d0
        gana L1733: #f3e6cf
L1240  .sold-out-card
        opacity: 0.62
        gana L1903: 0.72
L1243  .sold-out-card .image-frame
        filter: grayscale(40%)
        gana L1909: grayscale(55%)
L1468  .category-pill
        font-weight: 500
        gana L2044: 600
L1513  .product-card
        transition: transform 0.22s ease, box-shadow 0.22s ease, …
        gana L1659: transform 0.26s cubic-bezier(0.22, 0.9, 0.3, …
L1519  .product-card:hover
        transform: translateY(-4px)
        gana L1677: translateY(-6px)
L1586  .catalog-grid--admin .admin-panel @@media (max-width: 768px)
        border-top: 1px solid rgba(255,248,228,0.12)
        gana L1985: 1px solid rgba(181, 133, 68, 0.22)
L1610  .catalog-grid--admin .admin-featured-btn @@media (max-width: 768px)
        background: rgba(255,248,228,0.06)
        gana L1988: rgba(255, 255, 255, 0.7)
L1611  .catalog-grid--admin .admin-featured-btn @@media (max-width: 768px)
        border-color: rgba(255,248,228,0.15)
        gana L1989: rgba(181, 133, 68, 0.35)
L1612  .catalog-grid--admin .admin-featured-btn @@media (max-width: 768px)
        color: rgba(245,222,185,0.65)
        gana L1990: var(--muted)
L1616  .catalog-grid--admin .admin-featured-btn.ac… @@media (max-width: 768px)
        background: linear-gradient(135deg, rgba(245,208,96,0.2),…
        gana L1993: var(--gold-soft)
L1617  .catalog-grid--admin .admin-featured-btn.ac… @@media (max-width: 768px)
        border-color: rgba(210,162,62,0.5)
        gana L1994: var(--gold)
L1618  .catalog-grid--admin .admin-featured-btn.ac… @@media (max-width: 768px)
        color: #f5d060
        gana L1995: var(--gold-strong)
L1758  .card-stock--low
        color: var(--ambar-stock)
        gana L2348: #945c0e
L2033  .category-rail
        -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 16…
        gana L2616: linear-gradient(90deg, transparent 0, #000 14…
L2034  .category-rail
        mask-image: linear-gradient(90deg, transparent 0, #000 16…
        gana L2617: linear-gradient(90deg, transparent 0, #000 14…
L2188  .catalog-active-result
        color: var(--gold-strong)
        gana L2353: #8a5c14
L2367  .measure-chips
        flex-wrap: wrap
        gana L2595: nowrap
```

#### `src/app/styles/shared.css` — 53

```
L  28  .site-header
        box-shadow: var(--shadow)
        gana layout.css:611: 0 8px 32px rgba(89, 58, 24, 0.1), 0 1px 0 rgb…
L  27  .hero-home
        background: var(--surface)
        gana home.css:662: linear-gradient(160deg, rgba(255, 252, 243, 0…
L  27  .trust-strip
        background: var(--surface)
        gana home.css:830: var(--line)
L  26  .catalog-tools
        border: 1px solid var(--line)
        gana catalog.css:51: none
L  27  .catalog-tools
        background: var(--surface)
        gana catalog.css:50: transparent
L  28  .catalog-tools
        box-shadow: var(--shadow)
        gana catalog.css:52: none
L  27  .product-card
        background: var(--surface)
        gana catalog.css:269: linear-gradient(160deg, #241508 0%, #2e1a09 5…
L  28  .product-card
        box-shadow: var(--shadow)
        gana catalog.css:789: 0 8px 24px rgba(120, 80, 40, 0.12)
L  47  .header-link
        color: var(--muted)
        gana L78: var(--text)
L  47  .showcase-overlay p
        color: var(--muted)
        gana home.css:204: rgba(245, 222, 185, 0.72)
L  47  .showcase-mini-copy p
        color: var(--muted)
        gana home.css:204: rgba(245, 222, 185, 0.72)
L  59  .main-nav
        flex-wrap: wrap
        gana layout.css:203: nowrap
L  60  .main-nav
        gap: 10px
        gana layout.css:1128: 2px
L  59  .header-actions
        flex-wrap: wrap
        gana layout.css:212: nowrap
L  60  .header-actions
        gap: 10px
        gana layout.css:214: 8px
L  60  .category-rail
        gap: 10px
        gana catalog.css:2025: 7px
L  74  .category-pill
        padding: 7px 15px
        gana catalog.css:1469: 7px 16px
L  77  .category-pill
        background: rgba(255, 251, 243, 0.72)
        gana catalog.css:1471: rgba(255, 248, 228, 0.55)
L  78  .category-pill
        color: var(--text)
        gana catalog.css:1473: #4a2f10
L  74  .sort-select
        padding: 7px 15px
        gana catalog.css:213: 0
L  75  .sort-select
        border: 1px solid rgba(88, 61, 28, 0.1)
        gana catalog.css:205: none
L  77  .sort-select
        background: rgba(255, 251, 243, 0.72)
        gana catalog.css:206: transparent
L  78  .sort-select
        color: var(--text)
        gana catalog.css:207: rgba(245, 222, 185, 0.85)
L 112  .primary-button
        color: #fff9f0
        gana L353: var(--text)
L 112  .hero-buy-button
        color: #fff9f0
        gana L353: var(--text)
L 112  .upload-button
        color: #fff9f0
        gana L353: var(--text)
L 112  .big-action
        color: #fff9f0
        gana L353: var(--text)
L 112  .cart-checkout
        color: #fff9f0
        gana L353: var(--text)
L 126  .trust-strip
        border-radius: 30px
        gana home.css:832: 18px
L 125  .catalog-tools
        padding: 30px
        gana catalog.css:49: 12px 4px 20px
L 136  .showcase-heading h2
        font-size: clamp(2.1rem, 4vw, 4.2rem)
        gana home.css:143: clamp(1.8rem, 3vw, 3rem)
L 152  .catalog-grid
        gap: 18px
        gana catalog.css:1631: 20px
L 165  .showcase-mini-card
        transition: transform 0.22s ease, box-shadow 0.22s ease, …
        gana L323: transform 0.26s cubic-bezier(0.22, 0.9, 0.3, …
L 165  .showcase-main-card
        transition: transform 0.22s ease, box-shadow 0.22s ease, …
        gana home.css:1597: box-shadow 0.3s ease, border-color 0.3s ease
L 165  .service-pill
        transition: transform 0.22s ease, box-shadow 0.22s ease, …
        gana layout.css:620: all 0.22s ease
L 165  .related-card
        transition: transform 0.22s ease, box-shadow 0.22s ease, …
        gana L323: transform 0.26s cubic-bezier(0.22, 0.9, 0.3, …
L 181  .showcase-mini-card:hover
        transform: translateY(-4px)
        gana home.css:1582: translateY(-5px)
L 183  .service-pill:hover
        border-color: rgba(169, 115, 30, 0.22)
        gana layout.css:625: rgba(210, 162, 62, 0.3)
L 181  .related-card:hover
        transform: translateY(-4px)
        gana catalog.css:1912: translateY(-5px)
L 194  .brand-panel.editorial
        background: linear-gradient(135deg, #f0dfba 0%, #f9f2e2 1…
        gana home.css:1615: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L 194  .showcase-main-visual
        background: linear-gradient(135deg, #f0dfba 0%, #f9f2e2 1…
        gana home.css:1615: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L 299  .showcase-main-visual
        background: linear-gradient(160deg, #f6efe0 0%, #fbf6ea 5…
        gana home.css:1615: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L 194  .showcase-mini-visual
        background: linear-gradient(135deg, #f0dfba 0%, #f9f2e2 1…
        gana home.css:1615: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L 299  .showcase-mini-visual
        background: linear-gradient(160deg, #f6efe0 0%, #fbf6ea 5…
        gana home.css:1615: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L 194  .related-visual
        background: linear-gradient(135deg, #f0dfba 0%, #f9f2e2 1…
        gana catalog.css:2220: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L 299  .related-visual
        background: linear-gradient(160deg, #f6efe0 0%, #fbf6ea 5…
        gana catalog.css:2220: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L 224  .product-card:hover .product-image
        transform: scale(1.04)
        gana L316: scale(1.065)
L 224  .showcase-mini-card:hover .product-image
        transform: scale(1.04)
        gana L316: scale(1.065)
L 224  .related-card:hover .product-image
        transform: scale(1.04)
        gana L316: scale(1.065)
L 308  .catalog-grid .image-frame::after
        background: radial-gradient(112% 88% at 50% 36%, transpar…
        gana L330: radial-gradient(114% 90% at 50% 34%, transpar…
L 308  .showcase-mini-visual::after
        background: radial-gradient(112% 88% at 50% 36%, transpar…
        gana L330: radial-gradient(114% 90% at 50% 34%, transpar…
L 308  .related-visual::after
        background: radial-gradient(112% 88% at 50% 36%, transpar…
        gana L330: radial-gradient(114% 90% at 50% 34%, transpar…
L 354  .cart-checkout
        font-weight: 700
        gana cart.css:133: 600
```

#### `src/app/styles/admin.css` — 16

```
L 108  .branch-stock-row
        color: rgba(255, 255, 255, 0.9)
        gana L1116: var(--text)
L 113  .branch-stock-label
        color: rgba(255, 255, 255, 0.55)
        gana L1119: var(--muted)
L 122  .branch-stock-count
        color: #fff
        gana L1122: var(--text)
L 848  .admin-featured-btn
        border-radius: 20px
        gana L1004: 50%
L 849  .admin-featured-btn
        border: 1.5px solid var(--line)
        gana L1003: 1.5px solid var(--gold)
L 850  .admin-featured-btn
        background: var(--surface)
        gana L1002: rgba(255,255,255,0.88)
L 852  .admin-featured-btn
        font-size: 0.8rem
        gana L1010: 1rem
L 855  .admin-featured-btn
        transition: all 0.15s
        gana L1013: background 0.15s, transform 0.12s
L 859  .admin-featured-btn.active
        background: #fffbf0
        gana L1021: linear-gradient(135deg, #f5d060, #d4a017)
L 860  .admin-featured-btn.active
        border-color: var(--gold)
        gana L1022: #b8860b
L 873  .featured-list-item
        gap: 12px
        gana L1037: 10px
L 944  .featured-remove-btn
        border: 1px solid #fca5a5
        gana L1070: none
L 945  .featured-remove-btn
        background: #fff5f5
        gana L1069: none
L 946  .featured-remove-btn
        color: #dc2626
        gana L1071: var(--danger)
L 948  .featured-remove-btn
        font-size: 0.75rem
        gana L1072: 1rem
L 955  .featured-remove-btn:hover
        background: #fee2e2
        gana L1078: rgba(171,84,67,0.1)
```

#### `src/app/styles/layout.css` — 14

```
L 204  .main-nav
        gap: 4px
        gana L1128: 2px
L 173  .site-header
        padding: 10px 16px
        gana L1111: 8px 10px 8px 22px
L 205  .main-nav
        flex: 1
        gana L1129: 0 1 auto
L 245  .cart-button.pop
        animation: cartPop 0.3s cubic-bezier(0.36, 0.07, 0.19, 0…
        gana L975: cartPop 0.38s ease
L 291  .site-footer
        box-shadow: var(--shadow)
        gana L630: 0 -4px 0 rgba(169, 115, 30, 0.08) inset, 0 32…
L 537  .site-header @@media (max-width: 1100px)
        padding: 10px 14px
        gana L1189: 8px 10px 8px 18px
L 543  .main-nav @@media (max-width: 1100px)
        width: 100%
        gana L1190: auto
L 556  .service-ribbon @@media (max-width: 1100px)
        grid-template-columns: 1fr
        gana L560: repeat(2, minmax(0, 1fr))
L 568  .service-ribbon @@media (max-width: 760px)
        padding: 20px
        gana L584: 12px
L 577  .service-ribbon @@media (max-width: 760px)
        grid-template-columns: 1fr
        gana L582: 1fr 1fr
L 855  .mobile-nav-link.active
        color: #7a4f10
        gana L858: #c9a040
L1074  .site-header
        background: linear-gradient(135deg, rgba(250,244,232,0.95…
        gana L1209: repeating-linear-gradient( 3deg, rgba(255, 25…
L1087  .site-header
        background: radial-gradient(11px 17px at 76% 55%, #8a5322…
        gana L1209: repeating-linear-gradient( 3deg, rgba(255, 25…
L1120  .header-brand .brand-logo-img.compact
        filter: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.5…
        gana L1230: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.9…
```

#### `src/app/styles/home.css` — 14

```
L  60  .brand-panel.editorial
        background: linear-gradient(160deg, #f6efe0 0%, #fbf6ea 5…
        gana L1615: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L1579  .brand-panel.editorial
        background: radial-gradient(118% 86% at 50% 2%, #fffefa 0…
        gana L1615: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L1579  .showcase-main-visual
        background: radial-gradient(118% 86% at 50% 2%, #fffefa 0…
        gana L1615: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L1579  .showcase-mini-visual
        background: radial-gradient(118% 86% at 50% 2%, #fffefa 0…
        gana L1615: radial-gradient(120% 88% at 50% 0%, #ffffff 0…
L 392  .help-card p
        color: rgba(210, 162, 62, 0.62)
        gana L1631: #d2c0a4
L 570  .hero-home @@media (max-width: 760px)
        padding: 20px
        gana L610: 0 0 26px
L 857  .cat-card-cta
        color: var(--gold-strong)
        gana L1620: #7d5310
L 964  .home-branch-address
        color: rgba(210, 162, 62, 0.65)
        gana L1625: #d6c2a2
L1238  .welcome-actions
        flex-direction: column
        gana L1753: row
L1239  .welcome-actions
        gap: 13px
        gana L1755: 10px
L1241  .welcome-actions
        max-width: 420px
        gana L1756: 620px
L1301  .welcome-branches
        margin-top: 32px
        gana L1766: 12px
L1469  .showcase-section
        background: linear-gradient(160deg, rgba(255, 252, 245, 0…
        gana L1531: linear-gradient(160deg, #241508 0%, #2e1a09 5…
L1514  .showcase-mini-card:hover
        border-color: rgba(210, 162, 62, 0.45)
        gana L1583: var(--vitrina-borde-hover)
```

#### `src/app/styles/cart.css` — 14

```
L  15  .cart-extra
        margin: 0 0 6px
        gana L268: 0
L  15  .cart-name
        margin: 0 0 6px
        gana L260: 0
L  33  .cart-drawer
        background: linear-gradient(180deg, #fffdf7 0%, #fff8ea 1…
        gana L121: linear-gradient(180deg, #fffdf5, #fff8e8)
L  47  .cart-header
        align-items: start
        gana L140: center
L  47  .cart-item
        align-items: start
        gana L218: flex-start
L  49  .cart-footer
        gap: 12px
        gana L339: 10px
L  53  .cart-list
        display: grid
        gana L212: flex
L  54  .cart-list
        gap: 14px
        gana L214: 8px
L  66  .cart-quantity
        gap: 10px
        gana L289: 4px
L  70  .cart-quantity button
        width: 32px
        gana L293: 28px
L  71  .cart-quantity button
        height: 32px
        gana L294: 28px
L  72  .cart-quantity button
        border: 0
        gana L296: 1.5px solid var(--border)
L  73  .cart-quantity button
        border-radius: 999px
        gana L295: 8px
L  74  .cart-quantity button
        background: var(--gold-soft)
        gana L297: var(--surface)
```

#### `src/app/styles/base.css` — 2

```
L  23  body
        background: radial-gradient(circle at top center, rgba(25…
        gana L94: #f4ecdc
L  73  body
        background: radial-gradient(ellipse 80% 40% at 50% 0%, rg…
        gana L94: #f4ecdc
```

#### `src/app/styles/components/cart-checkout-panel.css` — 2

```
L  80  .checkout-total-strong
        background: rgba(210, 162, 62, 0.12)
        gana L137: linear-gradient(135deg, rgba(210, 162, 62, 0.…
L  84  .checkout-actions
        grid-template-columns: repeat(3, minmax(0, 1fr))
        gana L106: 1fr 1fr
```

#### `src/app/styles/checkout.css` — 1

```
L1773  .cf-heading @@media (max-width: 600px)
        font-size: 1.7rem
        gana L1841: 1.5rem
```

### 2b. Repitiendo el mismo valor (74) — se puede borrar sin pensar

Acá las dos declaraciones dicen lo mismo, así que borrar la de arriba no
cambia nada en ningún caso.

#### `src/app/styles/catalog.css` — 42

```
L 103  .search-wrapper  { position: relative }  = L1424
L1106  .search-wrapper  { position: relative }  = L1424
L 104  .search-wrapper  { display: flex }  = L1425
L1107  .search-wrapper  { display: flex }  = L1425
L 105  .search-wrapper  { align-items: center }  = L1426
L1108  .search-wrapper  { align-items: center }  = L1426
L 111  .search-icon  { position: absolute }  = L1430
L1113  .search-icon  { position: absolute }  = L1430
L1117  .search-icon  { color: var(--muted) }  = L1432
L 114  .search-icon  { pointer-events: none }  = L1433
L1116  .search-icon  { pointer-events: none }  = L1433
L 115  .search-icon  { flex-shrink: 0 }  = L1434
L 138  .search-input:focus  { outline: none }  = L896
L 148  .search-clear  { position: absolute }  = L1443
L1126  .search-clear  { position: absolute }  = L1443
L 150  .search-clear  { display: flex }  = L1452
L 151  .search-clear  { align-items: center }  = L1453
L 152  .search-clear  { justify-content: center }  = L1454
L 155  .search-clear  { border-radius: 50% }  = L1451
L1135  .search-clear  { border-radius: 50% }  = L1451
L 156  .search-clear  { border: none }  = L1446
L1129  .search-clear  { border: none }  = L1446
L1128  .search-clear  { background: none }  = L1445
L1131  .search-clear  { color: var(--muted) }  = L1447
L 159  .search-clear  { cursor: pointer }  = L1448
L1132  .search-clear  { cursor: pointer }  = L1448
L 160  .search-clear  { transition: background 0.15s }  = L1457
L 169  .catalog-filter-row  { display: flex }  = L2011
L 170  .catalog-filter-row  { align-items: center }  = L2012
L 178  .category-rail  { overflow-x: auto }  = L2026
L 218  .sort-select:focus  { outline: none }  = L896
L 361  .price-tag  { font-size: 1.9rem }  = L886
L 801  .product-card .product-name  { color: var(--text) }  = L1786
L 807  .product-card .price-tag  { color: var(--gold-strong) }  = L1799
L 812  .product-card .product-desc-preview  { color: var(--muted) }  = L1805
L 847  .product-card .color-swatch  { border-color: rgba(181, 133, 68, 0.3) }  = L1817
L 856  .product-card .color-swatch.active  { background: var(--gold-soft) }  = L1825
L 857  .product-card .color-swatch.active  { border-color: var(--gold) }  = L1824
L1037  .product-card .card-actions  { gap: 8px }  = L1843
L1139  .search-clear:hover  { color: var(--text) }  = L1462
L1165  .product-name:hover  { color: var(--gold-strong) }  = L1499
L1504  .sold-out-card  { opacity: 0.72 }  = L1903
```

#### `src/app/styles/admin.css` — 13

```
L 854  .admin-featured-btn  { cursor: pointer }  = L1011
L 866  .featured-list  { display: flex }  = L1030
L 867  .featured-list  { flex-direction: column }  = L1031
L 868  .featured-list  { gap: 8px }  = L1032
L 871  .featured-list-item  { display: flex }  = L1035
L 872  .featured-list-item  { align-items: center }  = L1036
L 874  .featured-list-item  { padding: 10px 14px }  = L1038
L 875  .featured-list-item  { background: var(--surface) }  = L1039
L 876  .featured-list-item  { border: 1px solid var(--line) }  = L1040
L 877  .featured-list-item  { border-radius: 12px }  = L1041
L 943  .featured-remove-btn  { border-radius: 6px }  = L1075
L 947  .featured-remove-btn  { cursor: pointer }  = L1073
L 953  .featured-remove-btn  { transition: background 0.12s }  = L1076
```

#### `src/app/styles/shared.css` — 10

```
L  26  .trust-strip  { border: 1px solid var(--line) }  = home.css:831
L  58  .main-nav  { display: flex }  = layout.css:200
L  58  .header-actions  { display: flex }  = layout.css:210
L  58  .category-rail  { display: flex }  = catalog.css:176
L  70  .category-pill  { display: inline-flex }  = catalog.css:2040
L  71  .category-pill  { align-items: center }  = catalog.css:2041
L  73  .category-pill  { min-height: 38px }  = catalog.css:2043
L 192  .image-frame  { position: relative }  = catalog.css:1248
L 193  .image-frame  { overflow: hidden }  = catalog.css:276
L 203  .help-card h3  { margin: 0 }  = home.css:387
```

#### `src/app/styles/cart.css` — 8

```
L  46  .cart-header  { display: flex }  = L139
L  48  .cart-header  { justify-content: space-between }  = L141
L  46  .cart-item  { display: flex }  = L217
L  49  .cart-item  { gap: 12px }  = L219
L  46  .cart-footer  { display: flex }  = L337
L  64  .cart-quantity  { display: flex }  = L287
L  65  .cart-quantity  { align-items: center }  = L288
L  81  .cart-footer  { border-top: 1px solid var(--line) }  = L335
```

#### `src/app/styles/home.css` — 1

```
L1237  .welcome-actions  { display: flex }  = L1752
```

---

## 3. Variables de color que no existen

Estas `var(--…)` apuntan a una variable que nunca se define en `:root`.
Cuando además no tienen valor de respaldo, la declaración entera se cae y
el texto termina con el color que herede del padre — que puede ser el que
se quería o no, pero por accidente.

### `--text-muted` — 7 uso(s) sin respaldo

- `src/app/styles/home.css:507`
- `src/app/styles/home.css:783`
- `src/app/styles/home.css:784`
- `src/app/styles/home.css:807`
- `src/app/styles/home.css:845`
- `src/app/styles/admin.css:851`
- `src/app/styles/admin.css:918`

### `--text-secondary` — 4 uso(s) sin respaldo

- `src/app/styles/home.css:445`
- `src/app/styles/home.css:705`
- `src/app/styles/home.css:782`
- `src/app/styles/home.css:818`

### Estas no son un problema

- `--primary` (4 usos): siempre se usa con valor de respaldo.
- `--app-color` (3 usos): siempre se usa con valor de respaldo.
- `--st-color` (4 usos): se la pasa el componente desde el JSX, con `style={{ "--st-color": … }}`.

Lo más probable es que `--text-secondary` y `--text-muted` quisieran ser
`--muted`, que sí existe. Pero cambiarlas **sí cambia cómo se ve**, así que
queda para decidir mirando cada pantalla.

---

## 4. Selectores que viven en más de un archivo (73)

No es un error: pasa cuando una pantalla pisa a propósito algo de
`shared.css`, o cuando la tarjeta de producto se ajusta desde `home.css`.
Va como mapa: si tocás uno de estos selectores, acordate de que la otra
mitad está en el otro archivo.

```
.product-card:hover                                    shared.css + catalog.css + globals.css
.showcase-mini-card:hover                              shared.css + home.css + globals.css
.related-card:hover                                    shared.css + catalog.css + globals.css
*                                                      base.css + globals.css
.site-header                                           shared.css + layout.css
.service-ribbon                                        shared.css + layout.css
.hero-home                                             shared.css + home.css
.trust-strip                                           shared.css + home.css
.home-invite                                           shared.css + home.css
.showcase-section                                      shared.css + home.css
.catalog-hero                                          shared.css + catalog.css
.catalog-tools                                         shared.css + catalog.css
.content-hero                                          shared.css + home.css
.info-card                                             shared.css + home.css
.contact-box                                           shared.css + home.css
.help-strip                                            shared.css + home.css
.help-card                                             shared.css + home.css
.product-card                                          shared.css + catalog.css
.warning-banner                                        shared.css + home.css
.detail-modal                                          shared.css + catalog.css
.product-meta-row                                      shared.css + catalog.css
.catalog-summary                                       shared.css + catalog.css
.meta-line                                             shared.css + catalog.css
.help-card p                                           shared.css + home.css
.hero-home-text                                        shared.css + home.css
.showcase-overlay p                                    shared.css + home.css
.showcase-mini-copy p                                  shared.css + home.css
.visual-caption                                        shared.css + home.css
.main-nav                                              shared.css + layout.css
.header-actions                                        shared.css + layout.css
.hero-home-actions                                     shared.css + home.css
.showcase-top                                          shared.css + home.css
.category-rail                                         shared.css + catalog.css
.product-badges                                        shared.css + catalog.css
.showcase-tab                                          shared.css + home.css
.category-pill                                         shared.css + catalog.css
.sort-select                                           shared.css + catalog.css
.cart-checkout                                         shared.css + cart.css
.hero-home h1                                          shared.css + home.css
.catalog-hero h2                                       shared.css + catalog.css
.content-hero h2                                       shared.css + home.css
.home-invite h2                                        shared.css + home.css
.showcase-heading h2                                   shared.css + home.css
.help-strip h2                                         shared.css + home.css
.hero-metrics                                          shared.css + home.css
.trust-grid                                            shared.css + home.css
.category-highlight-grid                               shared.css + home.css
.catalog-grid                                          shared.css + catalog.css
.about-grid                                            shared.css + home.css
.contact-grid                                          shared.css + home.css
.help-grid                                             shared.css + home.css
.related-grid                                          shared.css + catalog.css
.trust-card                                            shared.css + home.css
.showcase-mini-card                                    shared.css + home.css
.showcase-main-card                                    shared.css + home.css
.category-highlight-card                               shared.css + home.css
.service-pill                                          shared.css + layout.css
.related-card                                          shared.css + catalog.css
.showcase-main-card:hover                              shared.css + home.css
.category-highlight-card:hover                         shared.css + home.css
.service-pill:hover                                    shared.css + layout.css
.help-card:hover                                       shared.css + home.css
.brand-panel.editorial                                 shared.css + home.css
.showcase-main-visual                                  shared.css + home.css
.showcase-mini-visual                                  shared.css + home.css
.image-frame                                           shared.css + catalog.css
.detail-media                                          shared.css + catalog.css
.related-visual                                        shared.css + catalog.css
.showcase-overlay h3                                   shared.css + home.css
.showcase-mini-copy h4                                 shared.css + home.css
.help-card h3                                          shared.css + home.css
.product-header h2                                     shared.css + catalog.css
.modal-backdrop                                        shared.css + cart.css
```

---

## 5. Por qué el orden de los `@import` no se puede tocar

La hoja está armada por capas: las reglas de abajo pisan a las de arriba a
propósito, y muchas lo hacen con la misma "fuerza" (misma especificidad), así
que lo único que decide es el orden. Mover un `@import` de lugar cambia
cómo se ve el sitio aunque no se toque ni una línea de CSS.

El mismo motivo explica por qué las últimas reglas quedaron en
`globals.css` en vez de un archivo aparte: el anillo de foco del teclado, la
selección de texto y el modo "sin animaciones" ganan por ser lo último.

### La única diferencia buscada

El bloque de accesibilidad antes estaba a mitad de la hoja (línea ~8863 de
`globals.css`) y ahora está al final. Como esa regla también fija un
`border-radius: 6px`, hay nueve controles definidos en la última capa de la
hoja vieja que antes conservaban su propio redondeo al enfocarlos con el
teclado y ahora toman los 6px, igual que el resto de los botones del sitio:

`.category-all-btn`, `.category-panel-item`, `.catalog-clear-all`,
`.measure-chip`, `.welcome-social-btn`, `.pino-ver-todos`, `.pino-card`,
`.cf-dia-btn` y `.aop-avisos-btn`.

Sólo se ve mientras el control está enfocado con el teclado (no con el
mouse ni con el dedo) y no mueve nada de lugar. No había forma de dejarlo
exactamente como estaba sin partir en dos la mitad de los archivos: el
bloque necesita ir después de unas reglas y antes de otras que ahora viven
en el mismo archivo. Si preferís que quede clavado como antes, se puede, a
costa de varios archivos extra.

---

## Cómo se comprobó que la web no cambió

1. El conjunto de declaraciones de la hoja nueva es idéntico al de la vieja:
   ni una propiedad perdida, agregada ni con otro valor.
2. Se revisaron una por una las 6401 declaraciones buscando cambios de orden
   que pudieran cambiar quién gana la cascada.
3. Con el sitio andando, se comparó el estilo calculado (y el `::before`,
   el `::after` y la posición exacta) de cada elemento de cada pantalla,
   contra la hoja original: inicio, catálogo, ficha de producto, carrito,
   menú del celular, sobre nosotros, contacto, checkout, las tres páginas de
   resultado, arrepentimiento, privacidad y 404, en escritorio y en celular.
   25 pantallas, 9.924 elementos, cero diferencias.
4. Para el panel de pedidos y los placeholders de carga, que no se pueden
   abrir sin entrar como administrador, se dibujó el markup aparte y se
   comparó igual.
5. Lo mismo contra el sitio compilado para producción (`npm run build` +
   `npm run start`), que no es igual al de desarrollo: ahí el CSS sale
   minificado y partido en dos archivos. También da cero diferencias, y los
   dos archivos se cargan en el orden correcto.

### Lo que no se pudo probar en pantalla

- Los pasos del checkout posteriores a "Ingresá para continuar" (envío, forma
  de pago, transferencia): hay que entrar con una cuenta y no se quiso crear
  una contra la base de datos real. Esa parte quedó cubierta por el análisis
  del CSS, que no encontró ningún cambio de orden en `checkout.css`.
- El panel `/admin` de verdad, por lo mismo. Se probó con el markup copiado.

---

## Cómo se comprobó el borrado del 2026-10-26

Borrar es más fácil de comprobar que mover, porque una regla sólo puede pintar
algo si su selector le apunta a algún elemento:

1. **Ninguno de los 88 selectores que se fueron podía apuntar a nada.** Cada
   uno nombra al menos una clase que no aparece en ningún archivo del
   proyecto, buscando el nombre suelto en todo `src/` (no sólo en los
   `className`). Se comprobó dos veces, con dos programas distintos.
2. **Las clases que se arman en pedazos no esconden ninguna.** En el JSX hay
   clases escritas como `` `cf-dia-btn${activo ? " active" : ""}` ``, pero
   ninguna se arma pegando una variable: siempre son textos enteros, así que
   la búsqueda del punto 1 las ve.
3. **Una clase muerta dentro de un `:not()` no cuenta.** `.algo:not(.muerta)`
   sí le apunta a algo. Sólo se borró un selector cuando la clase muerta es
   obligatoria para que apunte.
4. **Lo que quedó está igual y en el mismo orden.** Las 773 declaraciones que
   siguen en `checkout.css` son, una por una y en el mismo orden, las mismas
   773 de antes: ni una cambió de valor ni de lugar. Eso es lo que decide
   quién gana cuando dos reglas pelean con la misma fuerza.
5. **En pantalla, contra la hoja de antes**, con el mismo método del punto 3
   de más arriba: inicio, catálogo, ficha de producto, carrito, checkout, las
   tres páginas de resultado, arrepentimiento y privacidad, en escritorio
   (1280px) y en celular (390px). Cero diferencias.
6. **Los pasos del checkout a los que no se llega sin cuenta** se cubrieron
   dibujando un elemento por cada uno de los 153 selectores que quedaron en
   `checkout.css` y comparando igual, en escritorio y en celular. Cero
   diferencias.
7. **Contra el build de producción**, comparando el CSS minificado de antes
   con el de ahora: de las 370 declaraciones que dejó de emitir, 369 son las
   borradas. La que sobra se explica abajo.

### La segunda tanda: `shared.css`

Mismo método, con dos cosas distintas por ser una hoja compartida:

- Casi todo fue **recortar listas, no borrar reglas**: 12 listas largas de
  selectores donde convivían clases vivas y muertas. De cada una se sacaron
  sólo las piezas muertas, dejando las demás con la misma sangría y en el
  mismo renglón que tenían. Las 329 declaraciones que quedan son, una por una
  y en el mismo orden, las mismas 329 de antes.
- En pantalla hubo que mirar más cosas, porque `shared.css` pinta todo el
  sitio: inicio, catálogo, ficha, carrito, el modal de "Iniciar sesión",
  checkout, páginas de resultado, arrepentimiento y privacidad, a 1280px,
  700px (el corte de 760) y 390px. Cero diferencias. Para lo del editor del
  admin, que no se puede abrir, se usó de nuevo un elemento por cada uno de
  los 77 selectores que quedaron. Cero diferencias.
- Contra el build de producción: las 138 declaraciones que dejó de emitir son
  todas de clases muertas, ninguna sin explicar.

Dos cosas que conviene saber:

- `.service-ribbon`, `.info-card`, `.contact-box` y varias más **también
  tienen reglas en `layout.css`, `home.css` y `catalog.css`**, que no se
  tocaron. Siguen sin poder pintar nada, pero siguen ocupando lugar.
- El encabezado grande de **CONTRASTE (WCAG AA)** casi se va de paseo: sus
  primeras reglas estaban muertas, pero el bloque explica decisiones de toda
  la hoja y abajo siguen las reglas vivas, cada una con su propio comentario.
  Un encabezado se borra sólo si se borraron todas las reglas que encabezaba,
  y nunca el comentario de arriba de todo del archivo.

### La tercera tanda: `layout.css`, `home.css` y `catalog.css`

Mismo método otra vez. Lo que apareció de nuevo:

- **Un encabezado que no se podía borrar aunque sus reglas estuvieran
  muertas.** El bloque de **ENVÍO Y ENTREGA** de `catalog.css` explica dos
  cosas: el renglón verde de "Envío gratis" en la tarjeta y el bloque de
  entrega del detalle. Lo primero ya no se dibuja desde acá (hoy es
  `.pino-card-envio`, en `home.css`), pero lo segundo sigue vivo justo abajo.
  Se conservó el comentario y se le agregó una línea diciendo dónde está
  ahora el renglón verde. Los otros nueve encabezados sí se fueron enteros,
  revisados uno por uno.
- **Dos nombres sospechosamente genéricos.** `.dark` resultó ser
  `.info-card.dark`, que depende de una clase ya muerta. `.neutral` era un
  tercer estado de stock al lado de `.in-stock` y `.sold-out`, que no se usa
  en ninguna parte.
- **Una trampa de la comparación en pantalla**, que no tiene que ver con el
  borrado pero conviene saberla para la próxima: el fondo del inicio va
  pasando fotos solo, y las dos fotos de la comparación se sacan con segundos
  de diferencia. Si la diapositiva cambia en el medio, la clase `.active` se
  mueve de un `div` a otro y eso se ve como una diferencia de estilo que la
  hoja no causó. Ahora la herramienta guarda también las clases de cada
  elemento, así que distingue sola "cambió la hoja" de "cambió la página".

En pantalla: inicio, catálogo, ficha con el bloque de entrega, carrito, menú
del celular, sobre nosotros, contacto, checkout, resultado, arrepentimiento y
privacidad, a 1280, 1100, 900, 760, 480 y 390 px. Cero diferencias. Más un
elemento por cada uno de los 584 selectores que quedaron en los tres
archivos, para cubrir lo que no se puede abrir: cero. Contra el build de
producción, las 191 declaraciones que dejó de emitir son todas de clases
muertas.

### La cuarta tanda: `admin.css`, `cart.css`, `skeletons.css`, `globals.css`

Lo importante de esta tanda no es lo que se borró, que es poco, sino el
agujero que apareció en el método y está contado arriba: una clase armada
con una variable no se encuentra buscando su nombre. Dos reglas vivas
estuvieron a punto de irse.

Cómo se comprobó que esas dos siguen enteras: se dibujó el panel de avisos
con las dos clases y se miró el color calculado. `--activado` sigue con el
fondo verde (`rgb(240, 248, 242)`) y `--apagado` con el ámbar
(`rgb(255, 247, 230)`), que es justo lo que se habría perdido.

El resto, como siempre: lo que queda está en el mismo orden; en pantalla se
comparó inicio, carrito con producto y checkout a 1280 y 390 px, más un
elemento por cada uno de los 251 selectores que quedaron en los tres
archivos, porque al `/admin` de verdad no se entra sin cuenta; y contra el
build de producción, las 61 declaraciones que dejó de emitir son todas de
clases muertas.

### La única diferencia en el archivo compilado

Hay dos bloques `@media (max-width: 600px)` distintos que le ponen tamaño al
mismo `.cf-heading`: uno 1.7rem y el otro, más abajo, 1.5rem. Gana siempre el
segundo, así que el primero nunca se vio. Al borrar las reglas que había en el
medio, los dos quedaron cerca y el minificador se dio cuenta: ahora emite uno
solo. En pantalla `.cf-heading` mide 1.5rem igual que antes. Las dos reglas
siguen las dos en el archivo fuente (está anotado en el punto 2a).
