import { seedTransactions } from "@/actions/seed";

export async function GET() {
  const result = await seedTransactions();
  return Response.json(result); // http://localhost:3000/api/seed  // then u will get success message {"success":true,"message":"Created 171 transactions"}
}
