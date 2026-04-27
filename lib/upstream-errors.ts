export class GenerationError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable = false,
    public upstreamStatus?: number,
    public upstreamRequestId?: string | null,
    public refundQuota = false
  ) {
    super(message);
  }
}

export function classifyUpstreamError(status: number, body: string, requestId: string | null) {
  const snippet = body.slice(0, 1000);
  if (status === 401 || status === 403) {
    return new GenerationError("AUTH_FAILED", `Sub2API auth failed: ${snippet}`, false, status, requestId);
  }
  if (status === 400) {
    return new GenerationError("INVALID_REQUEST", `Sub2API rejected request: ${snippet}`, false, status, requestId);
  }
  if (status === 413) {
    return new GenerationError("UPSTREAM_PAYLOAD_TOO_LARGE", "参考图请求体过大，请减少图片数量或降低图片分辨率", false, status, requestId, true);
  }
  if (status === 429) {
    return new GenerationError("UPSTREAM_429", `Sub2API rate limited: ${snippet}`, true, status, requestId, true);
  }
  if (status >= 500) {
    return new GenerationError("UPSTREAM_5XX", `Sub2API unavailable: ${snippet}`, true, status, requestId, true);
  }
  return new GenerationError("GENERATION_FAILED", `Sub2API error ${status}: ${snippet}`, false, status, requestId);
}
