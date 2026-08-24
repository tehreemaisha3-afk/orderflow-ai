# OrderFlow AI 2.0 — Phase 0 Audit (analysis only, no changes made)

## 1. Executive summary

OrderFlow AI is further along than a typical prototype: auth, multi-tenant data, manual order entry, a real AI assistant backed by Gemini, real order creation from AI confirmations, inventory reservation, and a live Twilio WhatsApp webhook are all wired to Postgres. Three things are not real: the Messages screen (hardcoded demo chat), AI follow-ups on the order page (disabled button), and anything related to expenses, voice, images, or explicit multilingual handling — none of that exists in code.

The biggest 2.0 gap is not model capability, it is workflow. Today the AI decides and writes an order in one step. The vision's chain (receive → understand → clarify → verify → approve → execute → communicate → learn) has no human approval stage and no confidence gate. That, plus making Messages real, is where the hackathon value is.

## 2. Current feature inventory

| Area | State | Notes |
|---|---|---|
| Landing page `/` | A | Static marketing page |
| Auth `/auth`, `/reset-password` | A | Email+password, Google OAuth, auto-confirm on |
| Route guard `_authenticated` | A | `supabase.auth.getUser()` in `beforeLoad`, redirects to `/auth` |
| Business setup onboarding | A | Forced when no business row |
| Dashboard | A | 6 live counters, recent orders, Recharts status pie — all from `orders` |
| Orders list + filters | A | Search, status/payment filters |
| Order detail | B | Real data + real WhatsApp thread; "Generate follow-up" is a disabled placeholder |
| New Order dialog | A | Zod validated, customer match-by-phone, `ORD-XXXX` numbering, items insert |
| Customers list + detail | A | Live, with order history |
| Products catalogue + aliases | A | CRUD, stock, active flag, image URL field (no upload) |
| Settings (business, delivery, payment, AI tone/instructions) | A | Persists to `businesses` / `business_settings` |
| Assistant console | A | Real Gemini turn, analysis panel, persists conversation |
| AI order execution | A | Idempotent per conversation, inventory reserved, logged |
| WhatsApp webhook | B | Signature-verified, AI-routed, replies via TwiML. Multi-tenant routing falls back to "only business in workspace" — fragile with the shared sandbox number |
| Messages screen | C | 100% hardcoded contacts and thread; input does nothing |
| Expense tracking | E | Does not exist (no table, no UI) |
| Voice / image / OCR orders | E | Does not exist |
| Explicit Urdu / Roman Urdu handling | E | No language logic, no test coverage, no language field |
| Storage buckets | E | None created |
| Realtime / websockets | E | Not used; all polling via React Query |

## 3. Current architecture

```text
Browser (React 19 + TanStack Router, React Query)
  ├─ supabase-js direct reads/writes  ──► Postgres (RLS via user_owns_business)
  └─ server fn sendAssistantMessage ──► conversation.server.ts
Twilio WhatsApp ──► /api/public/whatsapp/twilio (HMAC-SHA1 verified)
                     └─ inbound.server.ts (service role) ──► conversation.server.ts
conversation.server.ts
  └─ context.server (business + settings + products + aliases)
     └─ prompt.server (system prompt built from live DB rows)
        └─ gateway.server → Lovable AI Gateway → google/gemini-3.6-flash (JSON mode)
           └─ engine.server (defensive JSON parse)
              └─ orders.server (customer upsert → order → items → reserve_order_inventory)
                 └─ ai_processing_logs
```

Tables: `businesses`, `business_settings`, `customers`, `products`, `product_aliases`, `orders`, `order_items`, `whatsapp_messages`, `ai_conversations`, `ai_conversation_messages`, `ai_processing_logs`. Functions: `user_owns_business`, `reserve_order_inventory`, `apply_order_inventory`, `tg_orders_inventory_on_status`, `tg_set_updated_at`.

Weak points (not fixed in this phase): the whole catalogue is pushed into every prompt (breaks past a few hundred products); dashboard pulls all orders client-side and counts in JS; product matching is duplicated between the AI path and the manual dialog; the webhook's single-business fallback is a multi-tenant hazard; `any` typing in several route files; no retry/timeout on the gateway call.

## 4. Current AI capabilities — verified vs. assumed

CURRENTLY WORKING (in code, exercised end to end):
- Intent classification across 13 intents, confidence score, escalation flag.
- Product extraction with alias matching, quantity, unit price, notes.
- Customer name / phone / city / address extraction into structured JSON.
- Missing-field detection (`missing_fields`) and a `next_action` string.
- Order confirmation detection → real order + items + stock reservation, idempotent.
- Customer-facing reply generation grounded strictly in the business's own data.
- Same engine reused by the web console and WhatsApp.

POSSIBLE BUT NOT IMPLEMENTED:
- Urdu / Roman Urdu / mixed-language. Gemini handles these natively, so it will likely respond sensibly, but there is zero language detection, no language-specific prompt guidance, no reply-language rule, and no test evidence. Treat as unverified, not a feature.
- Voice, image/screenshot orders, price validation against catalogue before write, stock validation before confirming, human approval, learning from corrections, natural-language business queries.

## 5–8. Broken areas, risks

- Broken/unfinished: Messages screen (mock), AI follow-up button (disabled), single-business WhatsApp fallback, no confirmation-to-owner step before an AI-created order hits inventory.
- Technical risks: prompt size growth; AI can invent a `unit_price` that overrides the catalogue price (order total trusts the model); no stock check before reserving (stock clamps at 0 silently); no gateway timeout/retry; 402/429 surface as a plain reply failure.
- Security: keys are server-only and never in the bundle; webhook signature is verified with a timing-safe compare; RLS covers every tenant table; `SECURITY DEFINER` functions were locked down previously. Remaining concerns for a public demo: email auto-confirm is on (fine for demo, must be off for production), the webhook is public by design (signature is the only gate — correct), and real customer phone numbers will be visible on screen during the demo, so use fake data.
- UI/UX: Messages must become real or be removed before a demo; dashboard has six equal-weight cards and no "what needs attention" hierarchy; order detail is dense on mobile; assistant analysis panel is developer-oriented; no empty-state guidance for a brand-new business.

## 9–11. Preserve / remove / improve

Preserve untouched: auth + guard, business setup, orders (manual and AI), customers, products/aliases, settings, dashboard, the AI engine and prompt builder, the fulfillment/inventory path, the WhatsApp webhook and signature verification, all existing schema and RLS.

Remove: only the hardcoded contacts/thread in `messages.tsx` (replaced, not deleted, by real data) and the disabled follow-up button (replaced by a working one).

Improve: approval gate before AI writes an order; validate AI prices and stock against the catalogue server-side; real Messages inbox; language-aware replies; dashboard attention hierarchy.

## 12. Proposed 2.0 architecture (additive)

Insert a **draft order** stage between UNDERSTAND and EXECUTE. The AI turn produces an extraction record with per-field confidence; low confidence or failed validation parks it as a draft for owner approval; approval runs the existing `createOrderFromAnalysis`. Nothing in the current execution path is rewritten — a gate is placed in front of it. Add a `pending_orders` (draft) table and an `expenses` table; keep everything else. Business-query answers reuse `gateway.server` with aggregated DB summaries, not raw rows.

## 13. Prioritized roadmap

**P0 — protect/fix**
- Keep every A-rated feature working; regression-check orders and WhatsApp after each change.
- Validate AI-extracted prices and quantities against the catalogue before creating an order.
- Fix the WhatsApp single-business fallback before any public multi-tenant demo.

**P1 — highest value for the hackathon**
1. *Approval workflow (AI draft → owner review → execute).* Why: it is the vision's spine and the honest answer to "would you let an AI touch my inventory?". User value: safety. AI value: confidence-aware extraction surfaced in UI. Needs: one new table, one review screen, reuse of existing fulfillment. Depends on: nothing new. Difficulty: medium. Risk: low (additive). Demo impact: very high.
2. *Multilingual order understanding (English / Urdu / Roman Urdu / mixed).* Prompt-level language rule + detected-language field + reply in the customer's language. Difficulty: low. Risk: low. Demo impact: very high for this audience.
3. *Real Messages inbox from `whatsapp_messages`.* Removes the only fake screen; lets the demo show a live WhatsApp order landing in the app. Difficulty: low-medium. Risk: low.
4. *Daily Business Pulse + natural-language business queries.* One server function that aggregates orders/stock/payments and asks the model to summarise. Difficulty: medium. Demo impact: high.

**P2** — voice orders (browser `MediaRecorder` → Gemini audio via the gateway), expense tracking, customer intelligence, AI follow-up generation on the order page.

**P3** — image/screenshot order extraction, learning from owner corrections, inventory forecasting, realtime push.

## 14. Recommended demo flow

Send a Roman Urdu WhatsApp message ("2 chai patti aur 1 cheeni, DHA phase 5 deliver kar dein") → it appears in the live Messages inbox → assistant extracts products, quantities, address with confidence → a low-confidence field triggers a draft awaiting approval → owner approves in one click → order created, stock decremented, confirmation sent back to WhatsApp in the same language → Business Pulse answers "what needs my attention today?".

## 15. Zero-cost strategy

Everything above runs on what you already pay nothing for: Lovable Cloud Postgres/auth, the Lovable AI Gateway (Gemini, workspace credits — no card), and the Twilio WhatsApp Sandbox (free). No new paid dependency is proposed. Cost warnings: Twilio charges once you leave the sandbox for a production WhatsApp sender; gateway credits are finite, so cache the Business Pulse per day and avoid one inference per keystroke; Alibaba Cloud is not currently wired in and would only be worth adding if the hackathon grants free quota — I would keep the gateway call behind `gateway.server.ts` so a provider swap is a one-file change.

## 16. Exact next step

Approve this audit, then I implement P1.1 (the approval workflow) first, as an additive layer with the existing order path untouched. If you would rather lead with the multilingual win, say so and I will start there instead.
