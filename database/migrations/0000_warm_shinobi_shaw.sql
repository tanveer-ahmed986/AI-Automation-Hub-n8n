CREATE TYPE "public"."follow_up_status" AS ENUM('scheduled', 'pending_approval', 'approved', 'sent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('pending_review', 'approved', 'sent', 'closed', 'spam');--> statement-breakpoint
CREATE TYPE "public"."lead_budget_band" AS ENUM('unknown', 'under_100', '100_499', '500_999', '1000_plus');--> statement-breakpoint
CREATE TYPE "public"."lead_category" AS ENUM('website_development', 'ai_automation', 'consulting', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."lead_intent" AS ENUM('new_project', 'support', 'partnership', 'spam', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."lead_recommended_next_action" AS ENUM('approve_reply', 'request_clarification', 'manual_review', 'mark_spam');--> statement-breakpoint
CREATE TYPE "public"."lead_urgency" AS ENUM('low', 'medium', 'high', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."reply_draft_status" AS ENUM('pending_approval', 'approved', 'rejected', 'sent');--> statement-breakpoint
CREATE TYPE "public"."workflow_event_classification" AS ENUM('validation', 'ai_provider', 'persistence', 'approval', 'email_delivery', 'unexpected');--> statement-breakpoint
CREATE TYPE "public"."workflow_event_status" AS ENUM('success', 'failed', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."workflow_event_type" AS ENUM('intake', 'analysis', 'approval', 'delivery', 'follow_up', 'error');--> statement-breakpoint
CREATE TABLE "business_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" varchar(200) NOT NULL,
	"services_offered" text[] DEFAULT '{}'::text[] NOT NULL,
	"contact_details" text NOT NULL,
	"reply_tone" varchar(50) DEFAULT 'professional' NOT NULL,
	"signature" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_up" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"attempt_number" smallint NOT NULL,
	"status" "follow_up_status" DEFAULT 'scheduled' NOT NULL,
	"sent_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_attempt_number_positive" CHECK ("follow_up"."attempt_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"email_normalized" varchar(320) NOT NULL,
	"company" varchar(200),
	"message" varchar(5000) NOT NULL,
	"service" varchar(100),
	"budget_original" varchar(100),
	"timeline" varchar(100),
	"source" varchar(50),
	"consent_to_follow_up" boolean NOT NULL,
	"idempotency_key" varchar(200),
	"message_fingerprint" varchar(64) NOT NULL,
	"status" "lead_status" DEFAULT 'pending_review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"model_provider" varchar(50) NOT NULL,
	"model_name" varchar(100),
	"category" "lead_category" NOT NULL,
	"intent" "lead_intent" NOT NULL,
	"urgency" "lead_urgency" NOT NULL,
	"budget_band" "lead_budget_band" NOT NULL,
	"lead_score" smallint NOT NULL,
	"score_factors" text[] DEFAULT '{}'::text[] NOT NULL,
	"missing_information" text[] DEFAULT '{}'::text[] NOT NULL,
	"recommended_next_action" "lead_recommended_next_action" NOT NULL,
	"summary" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_analysis_lead_score_range" CHECK ("lead_analysis"."lead_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "reply_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"version" smallint NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"status" "reply_draft_status" DEFAULT 'pending_approval' NOT NULL,
	"approved_by" varchar(200),
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"workflow_name" varchar(100) NOT NULL,
	"execution_reference" varchar(200),
	"event_type" "workflow_event_type" NOT NULL,
	"status" "workflow_event_status" NOT NULL,
	"classification" "workflow_event_classification",
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_analysis" ADD CONSTRAINT "lead_analysis_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_draft" ADD CONSTRAINT "reply_draft_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_event" ADD CONSTRAINT "workflow_event_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "follow_up_lead_id_attempt_number_unique_idx" ON "follow_up" USING btree ("lead_id","attempt_number");--> statement-breakpoint
CREATE INDEX "follow_up_status_scheduled_at_idx" ON "follow_up" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_idempotency_key_unique_idx" ON "lead" USING btree ("idempotency_key") WHERE "lead"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "lead_dedup_idx" ON "lead" USING btree ("email_normalized","message_fingerprint","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_analysis_lead_id_unique_idx" ON "lead_analysis" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reply_draft_lead_id_version_unique_idx" ON "reply_draft" USING btree ("lead_id","version");--> statement-breakpoint
CREATE INDEX "workflow_event_lead_created_idx" ON "workflow_event" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "workflow_event_status_classification_idx" ON "workflow_event" USING btree ("status","classification");