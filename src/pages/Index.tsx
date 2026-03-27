import { useState } from "react";
import { useGitHub } from "@/lib/useGitHub";
import { TokenSetup } from "@/components/TokenSetup";
import { BottomTabs, type TabId } from "@/components/BottomTabs";
import { DashboardTab } from "@/components/DashboardTab";
import { ReposTab } from "@/components/ReposTab";
import { CreateRepoTab } from "@/components/CreateRepoTab";
import { GuideTab } from "@/components/GuideTab";
import { SettingsTab } from "@/components/SettingsTab";

const Index = () => {
  const { token, user, loading, error, connect, disconnect, isConnected } = useGitHub();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  if (!isConnected) {
    return <TokenSetup onConnect={connect} loading={loading} error={error} />;
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto">
      {activeTab === "dashboard" && (
        <DashboardTab token={token!} user={user!} onNavigate={setActiveTab} />
      )}
      {activeTab === "repos" && <ReposTab token={token!} user={user!} />}
      {activeTab === "create" && <CreateRepoTab token={token!} onNavigate={setActiveTab} />}
      {activeTab === "guide" && <GuideTab />}
      {activeTab === "settings" && (
        <SettingsTab token={token!} user={user!} onUpdateToken={connect} onDisconnect={disconnect} />
      )}
      <BottomTabs active={activeTab} onChange={setActiveTab} />
    </div>
  );
};

export default Index;
