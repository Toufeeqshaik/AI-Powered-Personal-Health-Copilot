# Estimated Monthly Cost (INR)

This is a planning estimate for the HacXLerate prototype, not an invoice or a price guarantee. Rates change by region, model, taxes, quota, storage, and traffic. The calculations below use **₹97 = US$1** as a rounded planning exchange rate on 2026-10-08.

## Scenarios

| Scenario | Vercel | Supabase | Gemini | Estimated total |
| --- | ---: | ---: | ---: | ---: |
| Hackathon demo / synthetic data | ₹0 Hobby | ₹0 Free | ₹0 while within free quota | **₹0/month** |
| Small pilot, 1,000 chats/month | ₹1,940 Pro | ₹2,425 Pro | ~₹328 | **~₹4,700/month** |
| Small pilot, 10,000 chats/month | ₹1,940 Pro | ₹2,425 Pro | ~₹3,274 | **~₹7,640/month** |

## Gemini example calculation

The 10,000-chat example assumes 2,000 input tokens and 500 output tokens per chat: 20M input tokens and 5M output tokens. Using the introductory Gemini 3.8 Flash rates of US$0.75/M input and US$3.75/M output gives US$33.75, or about ₹3,274 at ₹97/US$. Image/PDF usage can cost more and should be measured separately.

The 1,000-chat example is one tenth of that usage: about ₹328.

## Assumptions and exclusions

- Vercel Hobby is sufficient for a judging demo; Pro is a planning baseline for a small pilot.
- Supabase Free is sufficient for a demo. Pro is a planning baseline for one production project; extra compute, storage, egress, backups, and support can add cost.
- A `vercel.app` domain is free. A custom domain, email, monitoring, and paid OCR/storage are excluded.
- Set provider budgets and alerts before inviting external users. Gemini free-tier availability and quotas are not guaranteed.

## Official rate pages

- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Vercel pricing](https://vercel.com/pricing)
- [Vercel Hobby limits](https://vercel.com/docs/limits)
- [Supabase pricing](https://supabase.com/pricing)
