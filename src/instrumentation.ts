export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrapEnabledBots } = await import("@/lib/bot/manager");
    await bootstrapEnabledBots();
    const { startStatsCollector } = await import("@/lib/stats/collector");
    startStatsCollector();
  }
}
