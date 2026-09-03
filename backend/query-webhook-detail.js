const prisma = require('./config/prisma');

async function main() {
  // Get the latest webhook event for the PAID invoice
  const webhookEvent = await prisma.ghlWebhookEvent.findFirst({
    where: { ghlInvoiceId: '6a82daa0305638179831b613' },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('=== Webhook Event for ghlInvoiceId: 6a82daa0305638179831b613 ===');
  if (webhookEvent) {
    console.log('ID:', webhookEvent.id);
    console.log('webhookId:', webhookEvent.webhookId);
    console.log('eventType:', webhookEvent.eventType);
    console.log('status:', webhookEvent.status);
    console.log('ghlInvoiceId:', webhookEvent.ghlInvoiceId);
    console.log('ghlContactId:', webhookEvent.ghlContactId);
    console.log('checkoutId:', webhookEvent.checkoutId);
    console.log('loanAiUserId:', webhookEvent.loanAiUserId);
    console.log('errorMessage:', webhookEvent.errorMessage);
    console.log('processedAt:', webhookEvent.processedAt);
    console.log('createdAt:', webhookEvent.createdAt);
    console.log('payloadSummary:', JSON.stringify(webhookEvent.payloadSummary, null, 2));
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);