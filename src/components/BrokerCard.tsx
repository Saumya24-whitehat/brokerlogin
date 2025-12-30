import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

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
        "broker-card w-full text-left group cursor-pointer relative",
        isConnected && "border-primary/50 ring-2 ring-primary/20"
      )}
    >
      {/* Connected Badge */}
      {isConnected && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Connected
        </div>
      )}
      
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="relative">
          <div className={cn(
            "w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center overflow-hidden border transition-colors duration-300",
            isConnected ? "border-primary/50" : "border-border group-hover:border-primary/30"
          )}>
            <img 
              src={logo} 
              alt={name} 
              className="w-14 h-14 object-contain"
            />
          </div>
          {isConnected && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <svg className="w-3.5 h-3.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        
        <div className="text-center">
          <h3 className={cn(
            "font-semibold text-lg mb-1 transition-colors duration-200",
            isConnected ? "text-primary" : "text-foreground group-hover:text-primary"
          )}>
            {name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        
        <div className={cn(
          "mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          isConnected 
            ? "bg-primary/10 text-primary border border-primary/20" 
            : "bg-secondary text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground"
        )}>
          {isConnected ? "Manage Connection" : "Connect"}
        </div>
      </div>
    </button>
  );
};

export default BrokerCard;
