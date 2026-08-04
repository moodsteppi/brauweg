CREATE TYPE "public"."club_message_kind" AS ENUM('text', 'system');--> statement-breakpoint
CREATE TYPE "public"."club_war_status" AS ENUM('suche', 'angefragt', 'laeuft', 'beendet', 'abgesagt');--> statement-breakpoint
CREATE TABLE "club_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"account_id" uuid,
	"kind" "club_message_kind" DEFAULT 'text' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "club_war" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_a_id" uuid NOT NULL,
	"club_b_id" uuid,
	"status" "club_war_status" DEFAULT 'suche' NOT NULL,
	"score_a" integer DEFAULT 0 NOT NULL,
	"score_b" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_war_score" (
	"war_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"games" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "club_war_score_war_id_account_id_pk" PRIMARY KEY("war_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "club_message" ADD CONSTRAINT "club_message_club_id_club_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_message" ADD CONSTRAINT "club_message_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_war" ADD CONSTRAINT "club_war_club_a_id_club_id_fk" FOREIGN KEY ("club_a_id") REFERENCES "public"."club"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_war" ADD CONSTRAINT "club_war_club_b_id_club_id_fk" FOREIGN KEY ("club_b_id") REFERENCES "public"."club"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_war_score" ADD CONSTRAINT "club_war_score_war_id_club_war_id_fk" FOREIGN KEY ("war_id") REFERENCES "public"."club_war"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_war_score" ADD CONSTRAINT "club_war_score_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_war_score" ADD CONSTRAINT "club_war_score_club_id_club_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_message_club_idx" ON "club_message" USING btree ("club_id","created_at");--> statement-breakpoint
CREATE INDEX "club_war_a_idx" ON "club_war" USING btree ("club_a_id","status");--> statement-breakpoint
CREATE INDEX "club_war_b_idx" ON "club_war" USING btree ("club_b_id","status");
