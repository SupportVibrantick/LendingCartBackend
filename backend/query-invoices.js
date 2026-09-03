const prisma = require('./config/prisma');

async function main() {
  const invoices = await prisma.subscriptionInvoice.findMany({
    where: { invoiceNumber: { contains: 'INV-' } },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log('=== Recent subscription invoices ===');
  for (const inv of invoices) {
    console.log(inv.invoiceNumber, inv.status, inv.ghlInvoiceId, inv.organizationSubscriptionId);
  }
  await prisma.$disconnect();
}

main().catch(console.error);