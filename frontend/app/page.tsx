import DashboardLayout from "./(dashboard)/layout";
import { ChatArea } from "@/components/chat/chat-area";

export default function RootPage() {
  return (
    <DashboardLayout>
      <ChatArea />
    </DashboardLayout>
  );
}
