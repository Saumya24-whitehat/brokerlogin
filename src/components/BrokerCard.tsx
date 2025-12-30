import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Loader2, AlertTriangle, User } from "lucide-react";

interface BrokerCardProps {
  name: string;
  logo: string;
  description: string;
  onClick: () => void;
  isConnected?: boolean;
  lastCheckTime?: Date | null;
  sessionActive?: boolean;
  isChecking?: boolean;
  accountName?: string;
}

const formatLastCheck = (date: Date | null): string => {
  if (!date) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  
  if (diffSecs < 60) return "Just now";
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  return date.toLocaleDateString();
};

const BrokerCard = ({ 
  name, 
  logo, 
  description, 
  onClick, 
  isConnected,
  lastCheckTime,
  sessionActive = true,
  isChecking = false,
  accountName
}: BrokerCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "broker-card w-full text-left group cursor-pointer relative",
        isConnected && sessionActive && "border-primary/50 ring-2 ring-primary/20",
        isConnected && !sessionActive && "border-destructive/50 ring-2 ring-destructive/20"
      )}
    >
      {/* Connected Badge */}
      {isConnected && (
        <div className={cn(
          "absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
          sessionActive 
            ? "bg-primary text-primary-foreground" 
            : "bg-destructive text-destructive-foreground"
        )}>
          {sessionActive ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5" />
              Expired
            </>
          )}
        </div>
      )}
      
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="relative">
          <div className={cn(
            "w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center overflow-hidden border transition-colors duration-300",
            isConnected && sessionActive ? "border-primary/50" : 
            isConnected && !sessionActive ? "border-destructive/50" :
            "border-border group-hover:border-primary/30"
          )}>
            <img 
              src={logo} 
              alt={name} 
              className="w-14 h-14 object-contain"
            />
          </div>
          {isConnected && sessionActive && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <svg className="w-3.5 h-3.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {isConnected && !sessionActive && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-destructive flex items-center justify-center shadow-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive-foreground" />
            </div>
          )}
        </div>
        
        <div className="text-center">
          <h3 className={cn(
            "font-semibold text-lg mb-1 transition-colors duration-200",
            isConnected && sessionActive ? "text-primary" : 
            isConnected && !sessionActive ? "text-destructive" :
            "text-foreground group-hover:text-primary"
          )}>
            {name}
          </h3>
          {isConnected && accountName ? (
            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span>{accountName}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
          
          {/* Last Check Time */}
          {isConnected && lastCheckTime && (
            <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
              {isChecking ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3" />
                  <span>Last check: {formatLastCheck(lastCheckTime)}</span>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className={cn(
          "mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          isConnected && sessionActive
            ? "bg-primary/10 text-primary border border-primary/20" 
            : isConnected && !sessionActive
            ? "bg-destructive/10 text-destructive border border-destructive/20"
            : "bg-secondary text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground"
        )}>
          {isConnected && sessionActive ? "Manage Connection" : 
           isConnected && !sessionActive ? "Re-login Required" :
           "Connect"}
        </div>
      </div>
    </button>
  );
};

export default BrokerCard;
