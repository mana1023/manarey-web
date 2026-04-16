# Lanzamiento Manarey

## Ya implementado

- Checkout por WhatsApp con creación de orden.
- Checkout por tarjeta usando Mercado Pago Checkout Pro.
- Webhook de pago para actualizar estado de la orden.
- Cálculo de envío por zona.
- Páginas de resultado del checkout.
- `robots.txt`, `sitemap.xml` y metadata base.
- Rate limiting simple en login y expiración de sesión.

## Datos externos que faltan para salir a producción

1. Direcciones reales de los locales.
   - Cargar `NEXT_PUBLIC_BRANCH_ADDRESS_1`
   - Cargar `NEXT_PUBLIC_BRANCH_ADDRESS_2`

2. URL final del sitio.
   - Cargar `NEXT_PUBLIC_SITE_URL`

3. WhatsApp comercial real.
   - Cargar `NEXT_PUBLIC_WHATSAPP_NUMBER`

4. Mail comercial real.
   - Cargar `NEXT_PUBLIC_CONTACT_EMAIL`

5. Token real de Mercado Pago.
   - Cargar `MERCADO_PAGO_ACCESS_TOKEN`

6. Costos finales de envío por zona.
   - Cargar `NEXT_PUBLIC_SHIPPING_NEAR`
   - Cargar `NEXT_PUBLIC_SHIPPING_MEDIUM`
   - Cargar `NEXT_PUBLIC_SHIPPING_FAR`
   - Cargar `NEXT_PUBLIC_SHIPPING_NATIONAL`

7. Rotación de credenciales actuales.
   - Cambiar `DATABASE_URL` si la actual estuvo expuesta.
   - Cambiar `ADMIN_PASSWORD`
   - Cambiar `SESSION_SECRET`

## Recomendación antes de publicar

- Usar un dominio real con HTTPS.
- Probar una compra real o de sandbox en Mercado Pago.
- Verificar que el webhook de Mercado Pago apunte a `/api/payments/webhook`.
- Confirmar políticas comerciales: retiro, cambios, plazos de entrega y medios de pago.
