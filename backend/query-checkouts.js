const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check checkouts
  const checkouts = await prisma.loanAiGhlCheckout.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      package: true,
      loanAiUser: true,
      organizationSubscription: true
    }
  });
  console.log('=== Recent Checkouts ===');
  for (const checkout of checkouts) {
    console.log('---');
    console.log('ID:', checkout.id);
    console.log('status:', checkout.status);
    console.log('paymentStatus:', checkout.paymentStatus);
    console.log('ghlInvoiceId:', checkout.ghlInvoiceId);
    console.log('ghlContactId:', checkout.ghlContactId);
    console.log('packageId:', checkout.packageId);
    console.log('package:', checkout.package ? { id: checkout.package.id, code: checkout.package.code, name: checkout.package.name } : null);
    console.log('loanAiUser:', checkout.loanAiUser ? { id: checkout.loanAiUser.id, email: checkout.loanAiUser.email, brokerOrganizationId: checkout.loanAiUser.brokerOrganizationId } : null);
    console.log('organizationSubscriptionId:', checkout.organizationSubscriptionId);
    console.log('createdAt:', checkout.createdAt);
    console.log('completedAt:', checkout.completedAt);
  }
  
  // Check organization subscriptions
  const orgSubs = await prisma.organizationSubscription.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { package: true }
  });
  console.log('\n=== Recent Organization Subscriptions ===');
  for (const sub of orgSubs) {
    console.log('---');
    console.log('ID:', sub.id);
    console.log('status:', sub.status);
    console.log('package:', sub.package ? { id: sub.package.id, code: sub.package.code, name: sub.package.name } : null);
    console.log('organizationId:', sub.organizationId);
    console.log('ghlSubscriptionId:', sub.ghlSubscriptionId);
    console.log('ghlInvoiceId:', sub.ghlInvoiceId);
    console.log('loanAiUserId:', sub.loanAiUserId);
    console.log('createdAt:', sub.createdAt);
    console.log('currentPeriodEnd:', sub.currentPeriodEnd);
  }
  
  // Check LoanAiUsers
  const users = await prisma.loanAiUser.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log('\n=== Recent LoanAiUsers ===');
  for (const user of users) {
    console.log('---');
    console.log('ID:', user.id);
    console.log('email:', user.email);
    console.log('brokerOrganizationId:', user.brokerOrganizationId);
    console.log('createdAt:', user.createdAt);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);