import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddErpCredentialsToMetaCredentials1780444802000 implements MigrationInterface {
  name = 'AddErpCredentialsToMetaCredentials1780444802000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "meta_credentials"
      ADD COLUMN IF NOT EXISTS "erp_base_url" character varying(500),
      ADD COLUMN IF NOT EXISTS "erp_api_key"  text
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "meta_credentials" DROP COLUMN IF EXISTS "erp_api_key"`);
    await queryRunner.query(`ALTER TABLE "meta_credentials" DROP COLUMN IF EXISTS "erp_base_url"`);
  }
}
