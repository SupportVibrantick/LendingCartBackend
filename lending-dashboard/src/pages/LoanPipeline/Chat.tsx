import LoanChatPanel from "../../components/chat/LoanChatPanel";
import { lenderChatPortalConfig } from "../../lib/chatPortalConfig";

type LoanPreviewChatProps = {
  applicationId?: string | null;
};

const Chat = ({ applicationId }: LoanPreviewChatProps) => (
  <LoanChatPanel
    applicationId={applicationId}
    config={lenderChatPortalConfig}
  />
);

export default Chat;
