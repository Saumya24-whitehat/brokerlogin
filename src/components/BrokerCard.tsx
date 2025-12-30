import { cn } from "@/lib/utils";

interface BrokerCardProps {
  name: string;
  logo: string;
  description: string;
  onClick: () => void;
  isConnected?: boolean;
}

const BrokerCard = ({ name, logo, description, onClick, isConnected }: BrokerCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "broker-card w-full text-left group cursor-pointer",
        isConnected && "border-primary/50"
      )}
    >
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center overflow-hidden border border-border group-hover:border-primary/30 transition-colors duration-300">
            <img 
              src={logo} 
              alt={name} 
              className="w-14 h-14 object-contain"
            />
          </div>
          {isConnected && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        
        <div className="text-center">
          <h3 className="font-semibold text-foreground text-lg mb-1 group-hover:text-primary transition-colors duration-200">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        
        <div className="mt-2 px-4 py-2 rounded-lg bg-secondary text-sm font-medium text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
          {isConnected ? "Connected" : "Connect"}
        </div>
      </div>
    </button>
  );
};

export default BrokerCard;
