import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(
  __dirname,
  "../src/pages/submitedApplications/LoanPreview.tsx",
);
let c = fs.readFileSync(src, "utf8");

if (!c.includes("loanPreviewConfig")) {
  c = c.replace(
    'import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";',
    `import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";
import {
  getLoanPreviewConfig,
  type LoanPreviewPortal,
} from "../../lib/loanPreviewConfig";`,
  );
}

c = c.replace(/import LoanPreviewChat from "\.\/LoanPreviewChat";\r?\n/, "");
c = c.replace(/import FeeAgreement from "\.\/FeeAgreement";\r?\n/, "");
c = c.replace(
  /import LoanApplication from "\.\.\/LoanApplication\/LoanApplication";\r?\n/,
  "",
);

c = c.replace(
  /function getAuthHeaders\(\): HeadersInit \{[\s\S]*?\}\r?\n\r?\n/,
  "",
);

if (!c.includes("LoanPreviewProps")) {
  c = c.replace(
    "const LoanPreview = () => {",
    `type LoanPreviewProps = { portal?: LoanPreviewPortal };

const LoanPreview = ({ portal = "broker" }: LoanPreviewProps) => {`,
  );
}

if (!c.includes("previewConfig")) {
  c = c.replace(
    "  const navigate = useNavigate();",
    `  const navigate = useNavigate();
  const previewConfig = getLoanPreviewConfig(portal);
  const getAuthHeaders = previewConfig.getAuthHeaders;
  const pipelineApi = \`\${API_BASE}/\${previewConfig.pipelineApiRoot}/loan-pipeline\`;
  const lenderApi = \`\${API_BASE}/\${previewConfig.lenderDiscoveryApiRoot}/lender-discovery\`;
  const brokerPipelineApi = \`\${API_BASE}/\${previewConfig.brokerApiRoot}/loan-pipeline\`;
  const PreviewChat = previewConfig.Chat;
  const PreviewFeeAgreement = previewConfig.FeeAgreement;
  const PreviewLoanApplication = previewConfig.LoanApplication;`,
  );
}

c = c.replace(/\`\$\{API_BASE\}\/broker\/loan-pipeline/g, "`${pipelineApi}");
c = c.replace(/\`\$\{API_BASE\}\/broker\/lender-discovery/g, "`${lenderApi}");

c = c.replace(
  /\`\$\{pipelineApi\}\/\$\{applicationId\}\/mark-funded/g,
  "`${brokerPipelineApi}/${applicationId}/mark-funded",
);
c = c.replace(
  /\`\$\{pipelineApi\}\/submissions\/\$\{documentsData\.submissionId\}\/documents\/forward-to-client/g,
  "`${brokerPipelineApi}/submissions/${documentsData.submissionId}/documents/forward-to-client",
);
c = c.replace(
  /\`\$\{pipelineApi\}\/submissions\/\$\{submissionId\}\/documents\/auto-forward-to-client/g,
  "`${brokerPipelineApi}/submissions/${submissionId}/documents/auto-forward-to-client",
);
c = c.replace(
  /\`\$\{pipelineApi\}\/sub-broker-submissions/g,
  "`${brokerPipelineApi}/sub-broker-submissions",
);

c = c.replace(
  /\`\$\{API_BASE\}\/api\/public\/broker\/applications\/submissions\/\$\{id\}\`/g,
  "`${API_BASE}${previewConfig.submissionDetailUrl(id)}`",
);

c = c.replace(
  /const token = sessionStorage\.getItem\("broker_token"\);\r?\n\r?\n\s*const res = await fetch\(/g,
  "const res = await fetch(",
);
c = c.replace(
  /const token = sessionStorage\.getItem\("broker_token"\);\r?\n\r?\n\s*await fetch\(/g,
  "await fetch(",
);
c = c.replace(
  /headers: \{\r?\n\s*\.\.\.\(token && \{ Authorization: `Bearer \$\{token\}` \}\),\r?\n\s*\}/g,
  "headers: getAuthHeaders()",
);
c = c.replace(
  /headers: \{\r?\n\s*Authorization: `Bearer \$\{token\}`,\r?\n\s*\}/g,
  "headers: getAuthHeaders()",
);
c = c.replace(
  /headers: \{\r?\n\s*\.\.\.\(token \? \{ Authorization: `Bearer \$\{token\}` \} : \{\}\),\r?\n\s*\}/g,
  "headers: getAuthHeaders()",
);

c = c.replace(/navigate\("\/loan-preview"/g, "navigate(previewConfig.previewNavigatePath");
c = c.replace(/<LoanPreviewChat/g, "<PreviewChat");
c = c.replace(/<FeeAgreement/g, "<PreviewFeeAgreement");
c = c.replace(/<LoanApplication/g, "<PreviewLoanApplication");

if (!c.includes("portal={previewConfig.commissionPortal}")) {
  c = c.replace(
    /canMarkPaid=\{isBrokerAdmin\}/g,
    "canMarkPaid={previewConfig.canMarkPaidCommission && isBrokerAdmin}\n            portal={previewConfig.commissionPortal}",
  );
}

if (!c.includes("export { LoanPreview }")) {
  c = c.replace(
    "export default LoanPreview;",
    "export { LoanPreview };\nexport default LoanPreview;",
  );
}

fs.writeFileSync(src, c);
console.log("Transformed broker LoanPreview");
