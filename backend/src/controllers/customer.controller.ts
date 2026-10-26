function validCustomer(b:any):boolean {
 if(!b || typeof b!=="object") return false;
 const limits:Record<string,number>={full_name:120,email:150,phone_number:30,company:120,country:80,address:180};
 return Object.entries(limits).every(([k,max])=>typeof b[k]==='string' && b[k].trim().length>0 && b[k].trim().length<=max) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim()) && /^[0-9]{7,15}$/.test(b.phone_number) && ['active','inactive','pending'].includes(b.status);
}
import { Request, Response } from "express";
import { CustomerService } from "../services/customer.service";
import type { CustomerStatus } from "../models/customer.model";

type AuthRequest = Request & {
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
};

export const CustomerController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const ownerUserId = req.user?.id;

      if (!ownerUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const customers = await CustomerService.getAllByOwner(ownerUserId);
      return res.status(200).json(customers);
    } catch (error) {
      console.error("Error getting customers:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async update(req: AuthRequest, res: Response) {
    const id=String(req.params.id), b=req.body || {};
    if (!/^[0-9a-f-]{36}$/i.test(id) || !req.user?.id || !validCustomer(b)) return res.status(400).json({message:"Invalid customer data"});
    try {
      const result=await CustomerService.update(id,req.user.id,b);
      return result ? res.json(result) : res.status(404).json({message:"Customer not found"});
    } catch(e:any) { if(e.code==='23505') return res.status(409).json({message:"Customer email already exists"}); return res.status(500).json({message:"Unable to save customer"}); }
  },
  async create(req: AuthRequest, res: Response) {
    try {
      const ownerUserId = req.user?.id;

      if (!ownerUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const {
        full_name,
        email,
        phone_number,
        company,
        status,
        country,
        address,
      } = req.body;

      if (!validCustomer(req.body) ||
        !full_name ||
        !email ||
        !phone_number ||
        !company ||
        !status ||
        !country ||
        !address
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const newCustomer = await CustomerService.create({
        owner_user_id: ownerUserId,
        full_name,
        email,
        phone_number,
        company,
        status,
        country,
        address,
      });

      return res.status(201).json(newCustomer);
    } catch (error) {
      if ((error as any)?.code === "23505") return res.status(409).json({message:"Customer email already exists"});
      console.error("Error creating customer:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const ownerUserId = req.user?.id;
      const id = String(req.params.id);

      if (!ownerUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const deletedCustomer = await CustomerService.delete(id, ownerUserId);

      if (!deletedCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      return res.status(200).json({ message: "Customer deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async updateStatus(req: AuthRequest, res: Response) {
    try {
      const ownerUserId = req.user?.id;
      const id = String(req.params.id);
      const { status } = req.body as { status: CustomerStatus };

      if (!ownerUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!["active", "pending", "inactive"].includes(status)) {
        return res.status(400).json({ message: "Status is required" });
      }

      const updatedCustomer = await CustomerService.updateStatus(
        id,
        ownerUserId,
        status
      );

      if (!updatedCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      return res.status(200).json(updatedCustomer);
    } catch (error) {
      console.error("Error updating customer status:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};