import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalesPhoneToMetaCredentials1780444801000 implements MigrationInterface {
  name = 'AddSalesPhoneToMetaCredentials1780444801000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "meta_credentials"
      ADD COLUMN IF NOT EXISTS "sales_phone" character varying(20)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "meta_credentials"
      DROP COLUMN IF EXISTS "sales_phone"
    `);
  }
}
