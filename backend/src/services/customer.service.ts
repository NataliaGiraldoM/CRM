import { transaction } from "./access.service";
import { pool } from "../config/db";
import type { CreateCustomerDto, CustomerStatus } from "../models/customer.model";

export const CustomerService = {
  async getAllByOwner(_ownerUserId: string) {
    const query = `
      SELECT
        id,
        owner_user_id,
        full_name,
        email,
        phone_number,
        company,
        status,
        country,
        address,
        created_at,
        updated_at
      FROM customers
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  },

  async update(id:string,actor:string,data:CreateCustomerDto) {
    return transaction(actor, "Customer updated", async db=>{
      const result=await db.query(`UPDATE customers SET full_name=$1,email=$2,phone_number=$3,company=$4,status=$5,country=$6,address=$7,updated_at=now() WHERE id=$8 RETURNING *`,[data.full_name.trim(),data.email.trim().toLowerCase(),data.phone_number.trim(),data.company.trim(),data.status,data.country.trim(),data.address.trim(),id]);
      return result.rows[0];
    });
  },
  async create(data: CreateCustomerDto) {
    const query = `
      INSERT INTO customers (
        owner_user_id,
        full_name,
        email,
        phone_number,
        company,
        status,
        country,
        address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        owner_user_id,
        full_name,
        email,
        phone_number,
        company,
        status,
        country,
        address,
        created_at,
        updated_at
    `;

    const values = [
      data.owner_user_id,
      data.full_name,
      data.email.trim().toLowerCase(),
      data.phone_number,
      data.company,
      data.status,
      data.country,
      data.address,
    ];

    const result = await transaction(data.owner_user_id, "Customer created", db => db.query(query, values));
    return result.rows[0];
  },

  async delete(id: string, ownerUserId: string) {
    const query = `
      DELETE FROM customers
      WHERE id = $1
      RETURNING id
    `;

    const result = await transaction(ownerUserId, "Customer deleted", db => db.query(query, [id]));
    return result.rows[0];
  },

  async updateStatus(id: string, ownerUserId: string, status: CustomerStatus) {
    const query = `
      UPDATE customers
      SET
        status = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        owner_user_id,
        full_name,
        email,
        phone_number,
        company,
        status,
        country,
        address,
        created_at,
        updated_at
    `;

    const result = await transaction(ownerUserId, "Customer status changed", db => db.query(query, [status, id]));
    return result.rows[0];
  },
};