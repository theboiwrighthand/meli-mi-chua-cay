CREATE SEQUENCE IF NOT EXISTS "public"."meli_order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;
--> statement-breakpoint
REVOKE ALL ON SEQUENCE "public"."meli_order_number_seq" FROM PUBLIC, anon, authenticated;
