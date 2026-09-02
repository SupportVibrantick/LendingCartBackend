import ClientChatPanel from "../../components/chat/ClientChatPanel";

type ChatProps = {
  applicationId?: string | null;
  applicationNumber?: string | null;
  onBack: () => void;
};

const Chat = ({ applicationId, applicationNumber, onBack }: ChatProps) => (
  <ClientChatPanel
    applicationId={applicationId}
    applicationNumber={applicationNumber}
    onBack={onBack}
  />
);

export default Chat;
