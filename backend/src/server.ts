import dotenv from "dotenv";

dotenv.config({ path: "src/.env" });

import app from "./app";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Auth endpoint available at: http://localhost:${PORT}/api/auth/register`);
  console.log(`Customers endpoint available at: http://localhost:${PORT}/api/customers`);
});