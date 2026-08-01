CREATE TYPE "public"."auth_token_purpose" AS ENUM('email_verify', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."club_join_mode" AS ENUM('open', 'on_request');--> statement-breakpoint
CREATE TYPE "public"."club_role" AS ENUM('admin', 'member', 'guest');--> statement-breakpoint
CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."party_status" AS ENUM('running', 'finished', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."purchase_provider" AS ENUM('stripe', 'apple');--> statement-breakpoint
CREATE TYPE "public"."table_status" AS ENUM('waiting', 'running', 'finished', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."table_visibility" AS ENUM('public', 'on_request', 'club_only');--> statement-breakpoint
CREATE TYPE "public"."trophy_reason" AS ENUM('party_result', 'leave_penalty', 'checkpoint_protection', 'manual_correction');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"premium_until" timestamp with time zone,
	"coins" integer DEFAULT 0 NOT NULL,
	"anonymized_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "account_game_stat" (
	"account_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"trophies" integer DEFAULT 0 NOT NULL,
	"highest_checkpoint" integer DEFAULT 0 NOT NULL,
	"parties" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "account_game_stat_account_id_game_id_pk" PRIMARY KEY("account_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "auth_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"purpose" "auth_token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "block" (
	"account_id" uuid NOT NULL,
	"blocked_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "block_account_id_blocked_account_id_pk" PRIMARY KEY("account_id","blocked_account_id")
);
--> statement-breakpoint
CREATE TABLE "club" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"admin_account_id" uuid NOT NULL,
	"default_rule_set_id" uuid,
	"join_mode" "club_join_mode" DEFAULT 'on_request' NOT NULL,
	"min_trophies" integer DEFAULT 0 NOT NULL,
	"max_members" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_member" (
	"club_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"role" "club_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_member_club_id_account_id_pk" PRIMARY KEY("club_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "friendship" (
	"account_a" uuid NOT NULL,
	"account_b" uuid NOT NULL,
	"status" "friendship_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendship_account_a_account_b_pk" PRIMARY KEY("account_a","account_b")
);
--> statement-breakpoint
CREATE TABLE "table_" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" text NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"rule_set_version" integer NOT NULL,
	"visibility" "table_visibility" DEFAULT 'public' NOT NULL,
	"club_id" uuid,
	"status" "table_status" DEFAULT 'waiting' NOT NULL,
	"seats" integer NOT NULL,
	"max_rounds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_vote" (
	"account_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_vote_account_id_game_id_pk" PRIMARY KEY("account_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "invite_code" (
	"code" text PRIMARY KEY NOT NULL,
	"max_uses" integer NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pairing_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_a" uuid NOT NULL,
	"account_b" uuid NOT NULL,
	"party_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"seed" bigint NOT NULL,
	"rounds" integer NOT NULL,
	"status" "party_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "party_snapshot" (
	"party_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"provider" "purchase_provider" NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"free_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_summary" (
	"party_id" uuid NOT NULL,
	"round_index" integer NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_summary_party_id_round_index_pk" PRIMARY KEY("party_id","round_index")
);
--> statement-breakpoint
CREATE TABLE "rule_set" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"game_id" text NOT NULL,
	"owner_account_id" uuid,
	"club_id" uuid,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rule_set_id_version_pk" PRIMARY KEY("id","version")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stat_counter" (
	"account_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"key" text NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "stat_counter_account_id_game_id_key_pk" PRIMARY KEY("account_id","game_id","key")
);
--> statement-breakpoint
CREATE TABLE "table_seat" (
	"table_id" uuid NOT NULL,
	"seat_index" integer NOT NULL,
	"account_id" uuid,
	"is_bot" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_seat_table_id_seat_index_pk" PRIMARY KEY("table_id","seat_index")
);
--> statement-breakpoint
CREATE TABLE "trophy_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"party_id" uuid,
	"delta" integer NOT NULL,
	"reason" "trophy_reason" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_game_stat" ADD CONSTRAINT "account_game_stat_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_token" ADD CONSTRAINT "auth_token_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_blocked_account_id_account_id_fk" FOREIGN KEY ("blocked_account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club" ADD CONSTRAINT "club_admin_account_id_account_id_fk" FOREIGN KEY ("admin_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_member" ADD CONSTRAINT "club_member_club_id_club_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_member" ADD CONSTRAINT "club_member_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_account_a_account_id_fk" FOREIGN KEY ("account_a") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_account_b_account_id_fk" FOREIGN KEY ("account_b") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_" ADD CONSTRAINT "table__club_id_club_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_" ADD CONSTRAINT "table_rule_set_fk" FOREIGN KEY ("rule_set_id","rule_set_version") REFERENCES "public"."rule_set"("id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_vote" ADD CONSTRAINT "game_vote_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_log" ADD CONSTRAINT "pairing_log_account_a_account_id_fk" FOREIGN KEY ("account_a") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_log" ADD CONSTRAINT "pairing_log_account_b_account_id_fk" FOREIGN KEY ("account_b") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_log" ADD CONSTRAINT "pairing_log_party_id_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party" ADD CONSTRAINT "party_table_id_table__id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."table_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_snapshot" ADD CONSTRAINT "party_snapshot_party_id_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_reporter_id_account_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_target_id_account_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_summary" ADD CONSTRAINT "round_summary_party_id_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set" ADD CONSTRAINT "rule_set_owner_account_id_account_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set" ADD CONSTRAINT "rule_set_club_id_club_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stat_counter" ADD CONSTRAINT "stat_counter_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_seat" ADD CONSTRAINT "table_seat_table_id_table__id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."table_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_seat" ADD CONSTRAINT "table_seat_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trophy_ledger" ADD CONSTRAINT "trophy_ledger_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trophy_ledger" ADD CONSTRAINT "trophy_ledger_party_id_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_email_key" ON "account" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "account_display_name_key" ON "account" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "account_game_stat_ranking_idx" ON "account_game_stat" USING btree ("game_id","trophies");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_token_hash_key" ON "auth_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_token_account_idx" ON "auth_token" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "club_name_key" ON "club" USING btree ("name");--> statement-breakpoint
CREATE INDEX "friendship_b_idx" ON "friendship" USING btree ("account_b");--> statement-breakpoint
CREATE INDEX "table_lobby_idx" ON "table_" USING btree ("game_id","status","visibility");--> statement-breakpoint
CREATE INDEX "table_activity_idx" ON "table_" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "pairing_log_pair_idx" ON "pairing_log" USING btree ("account_a","account_b","created_at");--> statement-breakpoint
CREATE INDEX "party_table_idx" ON "party" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "purchase_account_idx" ON "purchase" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "report_target_idx" ON "report" USING btree ("target_id","created_at");--> statement-breakpoint
CREATE INDEX "rule_set_owner_idx" ON "rule_set" USING btree ("owner_account_id","game_id");--> statement-breakpoint
CREATE INDEX "rule_set_club_idx" ON "rule_set" USING btree ("club_id","game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_key" ON "session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "session_account_idx" ON "session" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "table_seat_account_idx" ON "table_seat" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "trophy_ledger_account_idx" ON "trophy_ledger" USING btree ("account_id","game_id");