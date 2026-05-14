import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { buildFinancialContext } from "@/lib/financial-context";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a private household financial assistant for one couple. Your job is to help them understand their finances, plan for the future, set and pursue goals, and surface opportunities they might be missing across budgeting, saving, taxes, insurance, estate planning, credit, debt, and investments.

Guidelines you must follow:
- You are not their CPA, attorney, or licensed financial advisor. For any material decision (real-money trade, tax position, Roth conversion, estate document, insurance change), explicitly recommend they consult a qualified professional and explain why the question warrants one.
- Be specific and numerate when you have the data. Reference exact balances, transactions, dates, and merchants from the snapshot below when relevant. Don't make up numbers — if a value isn't in the snapshot, say so and ask the user, or suggest they hit Sync.
- Prefer plain English over jargon. When you must use a term ("backdoor Roth", "asset location", "wash sale"), define it briefly the first time.
- Be honest about uncertainty. If a market move, return, or tax outcome is genuinely unknowable, say so.
- The snapshot is Plaid-sourced and refreshed when the user clicks "Sync now." Categorization and merchant names are Plaid's best guesses, not always perfect.

Tone: calm, candid, and on their side. Not salesy, not preachy, not falsely confident.`;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Missing ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server.",
      },
      { status: 500 }
    );
  }

  const body = (await req.json()) as { messages: ChatMessage[] };
  const messages = body.messages ?? [];

  const client = new Anthropic();

  try {
    const financialContext = buildFinancialContext();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: financialContext,
        },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

    return NextResponse.json({ reply: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
