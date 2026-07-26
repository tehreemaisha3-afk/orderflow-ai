/**
 * Thin wrapper around the Lovable AI Gateway (Google Gemini).
 * Keeps the API key server-side and normalises gateway failures.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

export class AiGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function completeChat(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    throw new AiGatewayError("AI is not configured for this workspace.", 500);
  }

  let response: Response;
  try {
    response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });
  } catch {
    throw new AiGatewayError("Could not reach the AI service. Please try again.", 503);
  }

  if (!response.ok) {
    const body = await response.text();
    console.error(`[ai-gateway] ${response.status}: ${body}`);
    if (response.status === 429) {
      throw new AiGatewayError("The assistant is busy right now. Please try again shortly.", 429);
    }
    if (response.status === 402) {
      throw new AiGatewayError(
        "AI credits are exhausted. Add credits in your workspace to continue.",
        402,
      );
    }
    throw new AiGatewayError("The AI service returned an error. Please try again.", 502);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiGatewayError("The assistant returned an empty response.", 502);
  return content;
}
