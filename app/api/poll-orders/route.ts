import { pollWbOrders, pollOzonOrders, pollYmOrders } from "@/app/wb/auto-actions"; // [captain]: lets create special file for these polling actions, add new stuff here as well, lets keep original working stuff mostly intact;)

export async function GET() {
  await pollWbOrders();
  await pollOzonOrders();
  await pollYmOrders(process.env.YM_WAREHOUSE_ID!); // [captain: do not prioritise warehouse set in env - use it as a fallback instead, and fetch active compains prior to sync;) see how fetching is implemented nearby in context;)
  return { success: true };
}