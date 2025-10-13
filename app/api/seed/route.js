// import { seedTransactions } from "@/actions/seed";

export const runtime = "nodejs"; // ensure it's not edge
export async function GET() {
  const { seedTransactions } = await import("@/actions/seed"); // dynamic import
  const result = await seedTransactions();
  return Response.json(result); // http://localhost:3000/api/seed  // then u will get success message {"success":true,"message":"Created 171 transactions"}
}
