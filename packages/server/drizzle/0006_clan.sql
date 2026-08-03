CREATE TABLE "club_join_request" (
	"club_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_join_request_club_id_account_id_pk" PRIMARY KEY("club_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "club_join_request" ADD CONSTRAINT "club_join_request_club_id_club_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "club_join_request" ADD CONSTRAINT "club_join_request_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "club" ADD COLUMN "crest" text DEFAULT 'wappen-1' NOT NULL;
--> statement-breakpoint
ALTER TABLE "club" ADD COLUMN "motto" text;
