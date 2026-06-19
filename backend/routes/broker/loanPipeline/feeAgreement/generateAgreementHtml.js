const { isPlaceholderName } = require("../../../../services/resolveClientDisplayName");

function formatIssuerPartyName(clientName, clientEntityName) {
  const name = clientName || "___";
  if (!clientEntityName || isPlaceholderName(clientEntityName)) {
    return name;
  }
  return `${name} (${clientEntityName})`;
}

module.exports = function generateAgreementHtml(data) {
  const today = new Date().toLocaleDateString();
  const logoBlock = data.brokerLogoUrl
    ? `<div style="text-align:center;margin-bottom:16px;">
        <img src="${data.brokerLogoUrl}" alt="${data.brokerBrandName || "Broker Logo"}" style="max-height:96px;max-width:220px;object-fit:contain;" />
      </div>`
    : "";

  const issuerParty = formatIssuerPartyName(data.clientName, data.clientEntityName);

  return `
    ${logoBlock}
    <h2 style="text-align:center;">FINDER & FINANCIAL AGREEMENT</h2>

    <p>
      This Finder & Financial Agreement is made and entered into this Date: <b>${today}</b> 
      by and between <b>${issuerParty}</b>, 
      whose address is: <b>${data.clientAddress || "___"}</b> ("Issuer"),
      and <b>${data.brokerName || "___"} (${data.brokerCompany || "___"})</b>, 
      whose address is: <b>${data.brokerAddress || "___"}</b> ("Finder").
    </p>

    <p><b>Subject Property / Business Address:</b> ${data.subjectAddress || "___"}</p>

    <h3>1. THE AGREEMENT</h3>
    <p>Issuer is to be part of any loan, equity investment, lease, asset based line of credit, etc.</p>

    <h3>2. THE FEE</h3>
    <p>
      Broker Fee: <b>${data.brokerPoints || "___"} %</b><br/>
      Upfront Fee: <b>${data.upfrontFee || "___"}</b>
    </p>

    <h3>3. GOVERNING LAW</h3>
    <p>
      State: <b>${data.brokerState || "___"}</b><br/>
      County: <b>${data.brokerCounty || "___"}</b>
    </p>

    <h3>4. EXCLUSIVITY</h3>
    <p>
      Exclusivity Period: <b>${data.exclusivityMonths || "___"} Months</b>
    </p>

    <br/><br/>

    <h3>Broker Details</h3>
    <p>
      Name: ${data.brokerName || "___"}<br/>
      Email: ${data.brokerEmail || "___"}<br/>
      Phone: ${data.brokerPhone || "___"}
    </p>

    <h3>Client Details</h3>
    <p>
      Name: ${data.clientName || "___"}<br/>
      Email: ${data.clientEmail || "___"}<br/>
      Phone: ${data.clientPhone || "___"}
    </p>

    ${
      data.clientSignature
        ? `
        <h3>Signature</h3>
        <img src="${data.clientSignature}" width="200"/>
        <p>Signed At: ${data.signedAt}</p>
      `
        : ""
    }
  `;
};