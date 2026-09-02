import LoanChatPanel from "../../components/chat/LoanChatPanel";
import { brokerChatPortalConfig } from "../../lib/chatPortalConfig";

type LoanPreviewChatProps = {
  applicationId?: string | null;
  initialConversationId?: string | null;
};

const LoanPreviewChat = ({
  applicationId,
  initialConversationId,
}: LoanPreviewChatProps) => (
  <LoanChatPanel
    applicationId={applicationId}
    initialConversationId={initialConversationId}
    config={brokerChatPortalConfig}
  />
);

export default LoanPreviewChat;
