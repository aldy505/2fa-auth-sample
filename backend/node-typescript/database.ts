import { knex, Knex } from "knex"

export const db = knex({
  client: 'mysql2',
  connection: 'mysql://root:password@localhost:3306/2fa_auth_sample'
} as Knex.Config)

export async function initializeDatabase() {
  try {
    const isTableExist = await db.schema.hasTable('users')
    if (!isTableExist) {
      await db.transaction(trx => {
        trx
          .schema
          .createTable('users', (table) => {
            table.increments('id').primary();
            table.string('email').unique();
            table.string('passphrase');
            table.string('expiry');
          })
          .transacting(trx)
          .then(trx.commit)
          .catch(trx.rollback)
      })
    }
  } catch (error) {
    throw new Error(error)
  }
}