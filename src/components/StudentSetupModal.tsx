import { useState } from "react";
import { UserRound } from "lucide-react";
import { useStudent } from "@/contexts/StudentContext";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const StudentSetupModal = () => {
  const { isProfileSet, setCurrentStudent } = useStudent();
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) setCurrentStudent(name);
  };

  return (
    <Dialog open={!isProfileSet}>
      <DialogContent
        className="sm:max-w-sm flex flex-col items-center gap-6 py-8"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <UserRound className="w-9 h-9 text-primary" />
        </div>
        <DialogTitle className="text-2xl font-bold text-center">
          Who is using the board today?
        </DialogTitle>
        <DialogDescription className="text-center text-muted-foreground">
          Enter the student's name to get started.
        </DialogDescription>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <label htmlFor="student-name" className="sr-only">Student name</label>
          <input
            id="student-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sam"
            aria-label="Student name"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-ring/50"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full bg-primary text-primary-foreground rounded-xl px-6 py-3 text-xl font-bold shadow-md transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-ring/50 disabled:opacity-50 disabled:pointer-events-none"
          >
            Let's Go!
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StudentSetupModal;
