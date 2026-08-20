const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Search all subscription invoices
  const invoices = await prisma.subscriptionInvoice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  console.log('=== All Subscription Invoices ===');
  for (const inv of invoices) {
    console.log(inv.invoiceNumber, inv.status, inv.ghlInvoiceId, inv.organizationSubscriptionId, inv.createdAt);
  }
  
  // Also check for any webhook with "000021" in payload
  const webhooks = await prisma.ghlWebhookEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  console.log('\n=== All Webhook Events ===');
  for (const wh of webhooks) {
    const payloadStr = JSON.stringify(wh.payloadSummary);
    if (payloadStr.includes('000021') || (wh.ghlInvoiceId && wh.ghlInvoiceId.includes('000021'))) {
      console.log('MATCH:', wh.id, wh.ghlInvoiceId, wh.eventType, wh.status);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);