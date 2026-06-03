import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialSchema1780444800000 implements MigrationInterface {
  name = 'CreateInitialSchema1780444800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "meta_credentials" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" character varying(100) NOT NULL,
        "phone_number_id" character varying(50) NOT NULL,
        "access_token" text NOT NULL,
        "waba_id" character varying(50) NOT NULL,
        "verify_token" character varying(100) NOT NULL,
        "display_name" character varying(100),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meta_credentials" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_meta_credentials_tenant_id" UNIQUE ("tenant_id"),
        CONSTRAINT "UQ_meta_credentials_phone_number_id" UNIQUE ("phone_number_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_meta_credentials_phone_number_id"
      ON "meta_credentials" ("phone_number_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_meta_credentials_verify_token"
      ON "meta_credentials" ("verify_token")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "message_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" character varying(100) NOT NULL,
        "contact_phone" character varying(20) NOT NULL,
        "message_id" character varying(100),
        "direction" character varying(20) NOT NULL,
        "type" character varying(20) NOT NULL,
        "content" text,
        "media_url" character varying(500),
        "quoted_message_id" character varying(100),
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "ai_processed" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_history" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_message_history_message_id"
      ON "message_history" ("message_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_message_history_tenant_contact"
      ON "message_history" ("tenant_id", "contact_phone")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_message_history_tenant_created"
      ON "message_history" ("tenant_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" character varying(100) NOT NULL,
        "url" character varying(500) NOT NULL,
        "events" text NOT NULL,
        "secret" character varying(200),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhook_subscriptions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_subscriptions_tenant_id"
      ON "webhook_subscriptions" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_providers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" character varying(100) NOT NULL,
        "provider" character varying(20) NOT NULL,
        "api_key" text,
        "model" character varying(100),
        "system_prompt" text,
        "base_url" character varying(500),
        "is_active" boolean NOT NULL DEFAULT true,
        "auto_reply" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_providers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ai_providers_tenant_id" UNIQUE ("tenant_id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_providers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "message_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "meta_credentials"`);
  }
}
