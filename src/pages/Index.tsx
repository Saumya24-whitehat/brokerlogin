import { useState } from "react";
import { Shield, TrendingUp, Zap } from "lucide-react";
import BrokerCard from "@/components/BrokerCard";
import LoginModal from "@/components/LoginModal";
import samcoLogo from "@/assets/samco-logo.svg";
import angeloneLogo from "@/assets/angelone-logo.svg";

interface Broker {
  id: string;
  name: string;
  logo: string;
  description: string;
}

const brokers: Broker[] = [
  {
    id: "samco",
    name: "Samco",
    logo: samcoLogo,
    description: "Connect your Samco trading account",
  },
  {
    id: "angelone",
    name: "Angel One",
    logo: angeloneLogo,
    description: "Connect your Angel One trading account",
  },
];

const Index = () => {
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [connectedBrokers, setConnectedBrokers] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleBrokerClick = (broker: Broker) => {
    setSelectedBroker(broker);
    setIsModalOpen(true);
  };

  const handleLoginSuccess = () => {
    if (selectedBroker && !connectedBrokers.includes(selectedBroker.id)) {
      setConnectedBrokers([...connectedBrokers, selectedBroker.id]);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Gradient background effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            Secure Broker Connection
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Connect Your
            <span className="text-primary"> Broker</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Link your trading account securely to get started. Your credentials are encrypted and never stored.
          </p>
        </header>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground text-sm">Bank-Level Security</h3>
              <p className="text-xs text-muted-foreground">256-bit encryption</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground text-sm">Real-time Sync</h3>
              <p className="text-xs text-muted-foreground">Instant updates</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground text-sm">Quick Connect</h3>
              <p className="text-xs text-muted-foreground">Under 30 seconds</p>
            </div>
          </div>
        </div>

        {/* Broker Grid */}
        <section className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
            Available Brokers
            <span className="text-xs font-normal px-2 py-1 rounded-full bg-secondary text-muted-foreground">
              {brokers.length}
            </span>
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {brokers.map((broker) => (
              <BrokerCard
                key={broker.id}
                name={broker.name}
                logo={broker.logo}
                description={broker.description}
                onClick={() => handleBrokerClick(broker)}
                isConnected={connectedBrokers.includes(broker.id)}
              />
            ))}
            
            {/* Coming Soon Cards */}
            <div className="broker-card opacity-50 cursor-not-allowed">
              <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center border border-border">
                  <span className="text-3xl font-bold text-muted-foreground">+</span>
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-muted-foreground text-lg mb-1">
                    More Coming Soon
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Additional brokers
                  </p>
                </div>
                <div className="mt-2 px-4 py-2 rounded-lg bg-secondary text-sm font-medium text-muted-foreground">
                  Coming Soon
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Connected Status */}
        {connectedBrokers.length > 0 && (
          <div className="mt-12 p-6 rounded-xl bg-primary/5 border border-primary/20 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {connectedBrokers.length} Broker{connectedBrokers.length > 1 ? 's' : ''} Connected
                </h3>
                <p className="text-sm text-muted-foreground">
                  Your trading accounts are synced and ready
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            Your data is protected with industry-standard encryption
          </p>
        </footer>
      </div>

      {/* Login Modal */}
      {selectedBroker && (
        <LoginModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          brokerId={selectedBroker.id}
          brokerName={selectedBroker.name}
          brokerLogo={selectedBroker.logo}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
};

export default Index;
