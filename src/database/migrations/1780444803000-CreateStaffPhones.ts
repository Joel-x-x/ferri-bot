import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStaffPhones1780444803000 implements MigrationInterface {
  name = 'CreateStaffPhones1780444803000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "staff_phones" (
        "id"        uuid         NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" varchar(100) NOT NULL,
        "phone"     varchar(20)  NOT NULL,
        "name"      varchar(100),
        "is_active" boolean      NOT NULL DEFAULT true,
        "created_at" TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_staff_phones" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_staff_phones_tenant_phone" UNIQUE ("tenant_id", "phone")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_staff_phones_tenant_id"
      ON "staff_phones" ("tenant_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "staff_phones"`);
  }
}
