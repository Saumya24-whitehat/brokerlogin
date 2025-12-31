import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Shield, CheckCircle2 } from "lucide-react";

interface ConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  brokerName: string;
}

const ConsentModal = ({ isOpen, onClose, onAccept, brokerName }: ConsentModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-6 w-6 text-primary" />
            <DialogTitle className="text-xl">Authorization & Consent</DialogTitle>
          </div>
          <DialogDescription className="text-left space-y-3">
            <p className="font-medium text-foreground">
              Before connecting to {brokerName}, please read and accept the following:
            </p>
            <div className="bg-muted/50 p-4 rounded-lg border space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>RunAlgo will login and logout on your behalf to collect market data using your broker API.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>We use this data to provide trading analysis and insights through our platform.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Your credentials are securely encrypted and never shared with any third party.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>We comply with SEBI guidelines for accessing live market data through authorized broker partnerships.</span>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <h4 className="font-semibold mb-3 text-sm text-muted-foreground">Frequently Asked Questions</h4>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="password">
              <AccordionTrigger className="text-sm text-left">
                Does RunAlgo get access to my broker account password?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Your credentials are encrypted using industry-standard encryption before being stored.</li>
                  <li>We only use your credentials to maintain your session and provide you uninterrupted service.</li>
                  <li>Your password is never stored in plain text or shared with anyone.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="charges">
              <AccordionTrigger className="text-sm text-left">
                Will I be charged anything if I login with my broker?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <ul className="list-disc pl-4 space-y-1">
                  <li>No, we will not charge you anything for logging in with broker.</li>
                  <li>We don't make any automatic/hidden charges/deductions.</li>
                  <li>Many features in RunAlgo are 100% free to use forever.</li>
                  <li>You will be charged ONLY if you explicitly choose to buy a plan.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="trust">
              <AccordionTrigger className="text-sm text-left">
                Why trust RunAlgo?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Your broker is on the login because we have partnered with them and follow their security guidelines.</li>
                  <li>We do not monetize you through third parties or distribute your personal information or trading data to any third parties in any form whatsoever.</li>
                  <li>We do not store any of your trading data in any manner unless you require it for your personal trading analysis.</li>
                  <li>Your credentials are used solely for session management and are never used for any other purpose.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="orders">
              <AccordionTrigger className="text-sm text-left">
                Do you place any orders from my account?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <ul className="list-disc pl-4 space-y-1">
                  <li>We will place, modify, or cancel orders only when you do it manually.</li>
                  <li>No order will be placed, modified, or cancelled automatically or otherwise by the app or anyone else without your explicit authorization.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="data">
              <AccordionTrigger className="text-sm text-left">
                What data do you collect and why?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <ul className="list-disc pl-4 space-y-1">
                  <li>We access live market data through your broker's API to provide you with real-time analysis.</li>
                  <li>This is in compliance with SEBI regulations that require live data access through authorized broker partnerships.</li>
                  <li>We do not store your trading history unless explicitly needed for features you use.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <DialogFooter className="mt-6 flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onAccept} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            I Understand & Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConsentModal;
