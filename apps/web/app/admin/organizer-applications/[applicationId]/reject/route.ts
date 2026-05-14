import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/backendProxy";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
) {
  const { applicationId } = await context.params;
  return proxyBackendRequest(
    request,
    `/admin/organizer-applications/${encodeURIComponent(applicationId)}/reject`
  );
}
