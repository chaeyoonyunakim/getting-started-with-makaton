import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";

const Header = ({ profileChip }: { profileChip?: ReactNode }) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-extrabold tracking-tight text-foreground">
            Choice Board
          </span>
          {profileChip}
        </div>
        <Link
          to="/settings"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full px-3 py-2 focus:outline-none focus:ring-4 focus:ring-ring/50"
          aria-label="SENCo settings"
          title="SENCo settings"
        >
          <Settings className="w-5 h-5" />
          <span className="hidden sm:inline">Settings</span>
        </Link>
      </div>
    </header>
  );
};

export default Header;
