CREATE TABLE "analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"title" text NOT NULL,
	"duration_sec" double precision NOT NULL,
	"options_hash" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expiry_date" timestamp (3) with time zone,
	"scope" text,
	"channel_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caption_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"style" jsonb NOT NULL,
	"position" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"handle" text,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"chunk" jsonb NOT NULL,
	"analysis" jsonb,
	"score" double precision,
	"start" double precision NOT NULL,
	"end" double precision NOT NULL,
	"rank" integer,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clips" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"analysis_id" text,
	"segmentation_id" text,
	"segment_rank" integer NOT NULL,
	"filename" text NOT NULL,
	"path" text NOT NULL,
	"edited_path" text,
	"edits_json" jsonb,
	"current_edits_hash" text,
	"last_rendered_hash" text,
	"start_sec" double precision NOT NULL,
	"end_sec" double precision NOT NULL,
	"duration_sec" double precision NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"avatar_url" text,
	"role_id" text DEFAULT 'customer' NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_videos" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"video_id" text NOT NULL,
	"saved_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publish_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"video_id" text NOT NULL,
	"title" text NOT NULL,
	"items_json" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "publish_drafts_analysis_id_unique" UNIQUE("analysis_id")
);
--> statement-breakpoint
CREATE TABLE "qa_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"rank" integer NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segmentations" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"rank" integer NOT NULL,
	"start_sec" double precision NOT NULL,
	"end_sec" double precision NOT NULL,
	"score" double precision NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"audio_event" text,
	"options_hash" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"video_id" text NOT NULL,
	"clip_artifact_id" text NOT NULL,
	"title" text NOT NULL,
	"privacy_status" text NOT NULL,
	"status" text NOT NULL,
	"youtube_video_id" text,
	"youtube_url" text,
	"error" text,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"channel_title" text DEFAULT '' NOT NULL,
	"published_at" timestamp (3) with time zone,
	"duration_sec" double precision DEFAULT 0 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"thumbnail_url" text,
	"transcript_lines" jsonb,
	"transcript_fetched_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_segmentation_id_segmentations_id_fk" FOREIGN KEY ("segmentation_id") REFERENCES "segmentations"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "library_videos" ADD CONSTRAINT "library_videos_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "library_videos" ADD CONSTRAINT "library_videos_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "publish_drafts" ADD CONSTRAINT "publish_drafts_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "publish_drafts" ADD CONSTRAINT "publish_drafts_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qa_messages" ADD CONSTRAINT "qa_messages_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "segmentations" ADD CONSTRAINT "segmentations_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "upload_artifacts" ADD CONSTRAINT "upload_artifacts_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "upload_artifacts" ADD CONSTRAINT "upload_artifacts_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "analyses_video_created_idx" ON "analyses" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE INDEX "analyses_created_at_idx" ON "analyses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auth_identities_customer_id_idx" ON "auth_identities" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "auth_identities_channel_id_idx" ON "auth_identities" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_account_uq" ON "auth_identities" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_channel_uq" ON "auth_identities" USING btree ("provider","channel_id") WHERE "auth_identities"."channel_id" is not null;--> statement-breakpoint
CREATE INDEX "chunks_video_range_idx" ON "chunks" USING btree ("video_id","start","end");--> statement-breakpoint
CREATE INDEX "clips_analysis_id_idx" ON "clips" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "clips_video_id_idx" ON "clips" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "library_videos_customer_saved_idx" ON "library_videos" USING btree ("customer_id","saved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "library_videos_customer_video_uq" ON "library_videos" USING btree ("customer_id","video_id");--> statement-breakpoint
CREATE INDEX "qa_messages_video_created_idx" ON "qa_messages" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE INDEX "segmentations_cache_idx" ON "segmentations" USING btree ("video_id","options_hash","completed","rank");--> statement-breakpoint
CREATE INDEX "sessions_customer_id_idx" ON "sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "upload_artifacts_analysis_id_idx" ON "upload_artifacts" USING btree ("analysis_id");
--> statement-breakpoint
INSERT INTO "roles" ("id", "rank", "permissions", "created_at", "updated_at") VALUES
	('customer', 0, '[]'::jsonb, now(), now()),
	('admin', 100, '["settings:write"]'::jsonb, now(), now());
