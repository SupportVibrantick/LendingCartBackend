const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find SubscriptionInvoice with INV-000021
  const subInvoice = await prisma.subscriptionInvoice.findUnique({
    where: { invoiceNumber: 'INV-000021' },
    include: {
      organizationSubscription: {
        include: { package: true }
      },
      organization: true
    }
  });
  
  console.log('=== SubscriptionInvoice INV-000021 ===');
  if (subInvoice) {
    console.log('ID:', subInvoice.id);
    console.log('invoiceNumber:', subInvoice.invoiceNumber);
    console.log('status:', subInvoice.status);
    console.log('amount:', subInvoice.amount);
    console.log('organizationSubscriptionId:', subInvoice.organizationSubscriptionId);
    console.log('organizationId:', subInvoice.organizationId);
    console.log('ghlInvoiceId:', subInvoice.ghlInvoiceId);
    console.log('ghlSubscriptionId:', subInvoice.ghlSubscriptionId);
    console.log('externalPaymentRef:', subInvoice.externalPaymentRef);
    console.log('paidAt:', subInvoice.paidAt);
    console.log('dueDate:', subInvoice.dueDate);
    console.log('createdAt:', subInvoice.createdAt);
    
    if (subInvoice.organizationSubscription) {
      console.log('\n=== OrganizationSubscription ===');
      console.log('ID:', subInvoice.organizationSubscription.id);
      console.log('status:', subInvoice.organizationSubscription.status);
      console.log('packageId:', subInvoice.organizationSubscription.packageId);
      console.log('package:', subInvoice.organizationSubscription.package ? { id: subInvoice.organizationSubscription.package.id, code: subInvoice.organizationSubscription.package.code, name: subInvoice.organizationSubscription.package.name } : null);
      console.log('organizationId:', subInvoice.organizationSubscription.organizationId);
      console.log('ghlSubscriptionId:', subInvoice.organizationSubscription.ghlSubscriptionId);
      console.log('ghlInvoiceId:', subInvoice.organizationSubscription.ghlInvoiceId);
      console.log('createdAt:', subInvoice.organizationSubscription.createdAt);
      console.log('currentPeriodEnd:', subInvoice.organizationSubscription.currentPeriodEnd);
      
      // Get the organization
      const org = await prisma.organization.findUnique({
        where: { id: subInvoice.organizationSubscription.organizationId }
      });
      console.log('\n=== Organization ===');
      console.log('ID:', org?.id);
      console.log('name:', org?.name);
      console.log('type:', org?.type);
      
      // Find related webhook events
      const ghlInvoiceId = subInvoice.ghlInvoiceId || subInvoice.organizationSubscription.ghlInvoiceId;
      if (ghlInvoiceId) {
        const webhookEvents = await prisma.ghlWebhookEvent.findMany({
          where: { ghlInvoiceId },
          orderBy: { createdAt: 'desc' },
          take: 5
        });
        console.log('\n=== Related GHL Webhook Events ===');
        for (const event of webhookEvents) {
          console.log('---');
          console.log('ID:', event.id);
          console.log('webhookId:', event.webhookId);
          console.log('eventType:', event.eventType);
          console.log('status:', event.status);
          console.log('ghlInvoiceId:', event.ghlInvoiceId);
          console.log('ghlContactId:', event.ghlContactId);
          console.log('checkoutId:', event.checkoutId);
          console.log('loanAiUserId:', event.loanAiUserId);
          console.log('errorMessage:', event.errorMessage);
          console.log('processedAt:', event.processedAt);
          console.log('createdAt:', event.createdAt);
          console.log('payloadSummary:', JSON.stringify(event.payloadSummary, null, 2));
          
          // Find the checkout if any webhook has checkoutId
          if (event.checkoutId) {
            const checkout = await prisma.loanAiGhlCheckout.findUnique({
              where: { id: event.checkoutId },
              include: {
                package: true,
                loanAiUser: true,
                organizationSubscription: true
              }
            });
            console.log('\n=== Checkout Record ===');
            if (checkout) {
              console.log('ID:', checkout.id);
              console.log('status:', checkout.status);
              console.log('paymentStatus:', checkout.paymentStatus);
              console.log('organizationSubscriptionId:', checkout.organizationSubscriptionId);
              console.log('packageId:', checkout.packageId);
              console.log('package:', checkout.package ? { id: checkout.package.id, code: checkout.package.code, name: checkout.package.name } : null);
              console.log('loanAiUserId:', checkout.loanAiUserId);
              console.log('loanAiUser:', checkout.loanAiUser ? { id: checkout.loanAiUser.id, email: checkout.loanAiUser.email, brokerOrganizationId: checkout.loanAiUser.brokerOrganizationId } : null);
              console.log('ghlInvoiceId:', checkout.ghlInvoiceId);
              console.log('ghlContactId:', checkout.ghlContactId);
              console.log('createdAt:', checkout.createdAt);
              console.log('completedAt:', checkout.completedAt);
            }
          }
        }
      }
    }
  } else {
    console.log('SubscriptionInvoice INV-000021 NOT FOUND');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);