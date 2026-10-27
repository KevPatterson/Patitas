-- 0027_alert_notification_type.sql
-- Nuevo tipo de notificación para las alertas por municipio.
--
-- Va en una migración separada a propósito: PostgreSQL no permite usar un valor
-- de enum recién añadido dentro de la misma transacción que lo crea. La 0028
-- ya puede referenciar 'ALERT' sin problemas.

alter type public.notification_type add value if not exists 'ALERT';
