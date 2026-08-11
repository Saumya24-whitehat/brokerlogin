import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  brokerId: string;
  brokerName: string;
  brokerLogo: string;
  onLoginSuccess: (userName?: string, accountName?: string) => void;
}

const LoginModal = ({ isOpen, onClose, brokerId, brokerName, brokerLogo, onLoginSuccess }: LoginModalProps) => {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [vendorCode, setVendorCode] = useState("");
  const [imei, setImei] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const isAngelOne = brokerId === "angelone";
  const isShoonya = brokerId === "shoonya";
  const isUpstox = brokerId === "upstox";
  const isSamco = brokerId === "samco";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation for Upstox (OAuth flow)
    if (isUpstox) {
      if (!apiKey.trim()) {
        setError("Please enter your API Key");
        return;
      }
      if (!apiSecret.trim()) {
        setError("Please enter your API Secret");
        return;
      }
      if (!redirectUri.trim()) {
        setError("Please enter your Redirect URI");
        return;
      }

      setIsLoading(true);

      try {
        // Get authorization URL
        const response = await supabase.functions.invoke('upstox-auth', {
          body: { apiKey, redirectUri }
        });

        if (response.error || !response.data.success) {
          setError(response.data?.error || "Failed to start authorization");
          setIsLoading(false);
          return;
        }

        const authUrl = response.data.authUrl;
        
        // Open popup for OAuth
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          authUrl,
          'upstox-auth',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        if (!popup) {
          setError("Popup blocked. Please allow popups for this site.");
          setIsLoading(false);
          return;
        }

        // Listen for the redirect with auth code
        const checkPopup = setInterval(async () => {
          try {
            if (popup.closed) {
              clearInterval(checkPopup);
              setIsLoading(false);
              return;
            }

            // Try to get the URL from the popup
            const popupUrl = popup.location.href;
            
            if (popupUrl.startsWith(redirectUri)) {
              clearInterval(checkPopup);
              popup.close();
              
              // Extract auth code from URL
              const urlParams = new URLSearchParams(new URL(popupUrl).search);
              const code = urlParams.get('code');
              
              if (!code) {
                setError("Authorization failed. No code received.");
                setIsLoading(false);
                return;
              }

              // Exchange code for token
              const tokenResponse = await supabase.functions.invoke('upstox-auth', {
                body: { apiKey, apiSecret, redirectUri, code }
              });

              if (tokenResponse.error || !tokenResponse.data.success) {
                setError(tokenResponse.data?.error || "Failed to complete authorization");
                setIsLoading(false);
                return;
              }

              toast({
                title: "Login Successful!",
                description: `Connected to ${brokerName} as ${tokenResponse.data.accountName || tokenResponse.data.userId}.`,
              });
              
              onLoginSuccess(tokenResponse.data.userId, tokenResponse.data.accountName);
              handleClose();
            }
          } catch {
            // Cross-origin error - popup is still on external site
          }
        }, 500);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(checkPopup);
          if (!popup.closed) {
            popup.close();
          }
          setIsLoading(false);
        }, 300000);

      } catch (err) {
        console.error('Upstox auth error:', err);
        setError("An error occurred. Please try again.");
        setIsLoading(false);
      }
      return;
    }

    // Validation for other brokers
    if (!loginId.trim()) {
      setError(isAngelOne ? "Please enter your Client Code" : isShoonya ? "Please enter your User ID" : "Please enter your Login ID");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your Password");
      return;
    }
    if ((isAngelOne || isShoonya) && !totpToken.trim()) {
      setError("Please enter your TOTP Token");
      return;
    }
    if ((isAngelOne || isShoonya || isSamco) && !apiKey.trim()) {
      setError(isSamco ? "Please enter your Samco API Key (Access Token)" : "Please enter your API Key");
      return;
    }
    if (isShoonya && !vendorCode.trim()) {
      setError("Please enter your Vendor Code");
      return;
    }

    setIsLoading(true);

    try {
      let data, error;

      if (isAngelOne) {
        // Call Angel One login edge function
        const response = await supabase.functions.invoke('angelone-login', {
          body: { clientCode: loginId, password: password, totpToken: totpToken, apiKey: apiKey }
        });
        data = response.data;
        error = response.error;
      } else if (isShoonya) {
        // Call Shoonya login edge function
        const response = await supabase.functions.invoke('shoonya-login', {
          body: { userId: loginId, password: password, totpToken: totpToken, vendorCode: vendorCode, apiKey: apiKey, imei: imei || 'abcd1234' }
        });
        data = response.data;
        error = response.error;
      } else {
        // Call Samco login edge function
        const response = await supabase.functions.invoke('samco-login', {
          body: { userId: loginId, password: password, accessToken: apiKey }
        });
        data = response.data;
        error = response.error;
      }

      if (error) {
        console.error('Edge function error:', error);
        setError("Connection error. Please try again.");
        setIsLoading(false);
        return;
      }

      if (data.success) {
        toast({
          title: "Login Successful!",
          description: `Connected to ${brokerName} as ${data.accountName || loginId}.`,
        });
        onLoginSuccess(loginId, data.accountName || loginId);
        handleClose();
      } else {
        setError(data.error || "Invalid credentials. Please try again.");
      }
    } catch (err) {
      console.error('Login error:', err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setLoginId("");
    setPassword("");
    setTotpToken("");
    setApiKey("");
    setApiSecret("");
    setVendorCode("");
    setImei("");
    setRedirectUri("");
    setError("");
    setShowPassword(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border animate-scale-in">
        <DialogHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4 border border-border">
            <img 
              src={brokerLogo} 
              alt={brokerName} 
              className="w-10 h-10 object-contain"
            />
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Login to {brokerName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your broker credentials to connect
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isUpstox ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-foreground font-medium">
                  API Key
                </Label>
                <Input
                  id="apiKey"
                  type="text"
                  placeholder="Enter your Upstox API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isLoading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiSecret" className="text-foreground font-medium">
                  API Secret
                </Label>
                <div className="relative">
                  <Input
                    id="apiSecret"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your Upstox API Secret"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    disabled={isLoading}
                    className="h-11 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="redirectUri" className="text-foreground font-medium">
                  Redirect URI
                </Label>
                <Input
                  id="redirectUri"
                  type="text"
                  placeholder="https://your-domain.com/callback"
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                  disabled={isLoading}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Must match the Redirect URI in your Upstox Developer App
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="loginId" className="text-foreground font-medium">
                  {isAngelOne ? "Client Code" : isShoonya ? "User ID" : "Login ID"}
                </Label>
                <Input
                  id="loginId"
                  type="text"
                  placeholder={isAngelOne ? "Enter your Client Code" : isShoonya ? "Enter your User ID" : "Enter your Login ID"}
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  disabled={isLoading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-11 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {isSamco && (
                <div className="space-y-2">
                  <Label htmlFor="samcoApiKey" className="text-foreground font-medium">
                    API Key (Access Token)
                  </Label>
                  <Input
                    id="samcoApiKey"
                    type="text"
                    placeholder="Enter your Samco API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={isLoading}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Samco now requires an API access token from the Samco developer portal.
                  </p>
                </div>
              )}

              {(isAngelOne || isShoonya) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="totpToken" className="text-foreground font-medium">
                      TOTP Token
                    </Label>
                    <Input
                      id="totpToken"
                      type="text"
                      placeholder="Enter your TOTP secret key"
                      value={totpToken}
                      onChange={(e) => setTotpToken(e.target.value)}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>

                  {isShoonya && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="vendorCode" className="text-foreground font-medium">
                          Vendor Code
                        </Label>
                        <Input
                          id="vendorCode"
                          type="text"
                          placeholder="Enter your Vendor Code"
                          value={vendorCode}
                          onChange={(e) => setVendorCode(e.target.value)}
                          disabled={isLoading}
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="imei" className="text-foreground font-medium">
                          IMEI Code <span className="text-muted-foreground font-normal">(Optional)</span>
                        </Label>
                        <Input
                          id="imei"
                          type="text"
                          placeholder="Enter your IMEI Code (default: abcd1234)"
                          value={imei}
                          onChange={(e) => setImei(e.target.value)}
                          disabled={isLoading}
                          className="h-11"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="apiKey" className="text-foreground font-medium">
                      API Key
                    </Label>
                    <Input
                      id="apiKey"
                      type="text"
                      placeholder={isAngelOne ? "Enter your Angel One API Key" : "Enter your Shoonya API Key"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>
                </>
              )}
            </>
          )}

          <Button
            type="submit"
            variant="glow"
            size="lg"
            className="w-full mt-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isUpstox ? "Authorizing..." : "Verifying..."}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                {isUpstox ? "Authorize with Upstox" : "Verify & Connect"}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {isUpstox 
              ? "You'll be redirected to Upstox for secure authorization."
              : "Your credentials are securely transmitted and not stored."}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
