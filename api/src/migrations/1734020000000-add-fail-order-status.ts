import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFailOrderStatus1734020000000 implements MigrationInterface {
  name = 'AddFailOrderStatus1734020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."order_status_enum" ADD VALUE IF NOT EXISTS 'FAIL'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL does not support removing values from ENUM types easily.
    // Intentionally left empty.
  }
}
