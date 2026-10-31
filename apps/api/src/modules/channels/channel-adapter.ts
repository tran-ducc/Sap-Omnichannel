import type { ChannelType } from "@omni/shared";

/**
 * Contract every marketplace integration implements. Real adapters
 * (Shopee Open Platform, Lazada, TikTok Shop, Facebook Commerce) will replace
 * the mock below without touching the sync pipeline.
 */
export interface ChannelAdapter {
  pushStock(input: { channelType: ChannelType; externalId: string; quantity: number; credentials: unknown }): Promise<void>;
}

/** Simulates a marketplace API: small latency, optional failure rate for testing retries. */
export class MockChannelAdapter implements ChannelAdapter {
  constructor(private readonly failureRate = Number(process.env.MOCK_CHANNEL_FAILURE_RATE ?? 0)) {}

  async pushStock({ channelType }: { channelType: ChannelType; externalId: string; quantity: number }): Promise<void> {
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 380));
    if (Math.random() < this.failureRate) throw new Error(`${channelType} trả về lỗi tạm thời, sẽ thử lại`);
  }
}
