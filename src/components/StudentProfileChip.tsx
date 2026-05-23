import { useState } from "react";
import { UserRound, Pencil, LogOut } from "lucide-react";
import { useStudent } from "@/contexts/StudentContext";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const StudentProfileChip = () => {
  const { currentStudent, setCurrentStudent, isProfileSet } = useStudent();
  const { user, signOut } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");

  if (!isProfileSet) return null;

  const handleOpen = () => {
    setName(currentStudent);
    setEditOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      setCurrentStudent(name);
      setEditOpen(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 bg-primary/10 text-foreground rounded-full px-4 py-2 text-sm font-medium hover:bg-primary/20 transition-colors focus:outline-none focus:ring-4 focus:ring-ring/50"
          aria-label="Change student"
        >
          <UserRound className="w-5 h-5 text-primary" />
          <span className="max-w-[120px] truncate">{currentStudent}</span>
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        {user && (
          <button
            onClick={signOut}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-full"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>


      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm flex flex-col items-center gap-6 py-8">
          <DialogTitle className="text-2xl font-bold text-center">
            Switch Student
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Enter a different student's name.
          </DialogDescription>
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            <label htmlFor="switch-student-name" className="sr-only">Student name</label>
            <input
              id="switch-student-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Student name"
              aria-label="Student name"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-ring/50"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full bg-primary text-primary-foreground rounded-xl px-6 py-3 text-xl font-bold shadow-md transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-ring/50 disabled:opacity-50 disabled:pointer-events-none"
            >
              Switch
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentProfileChip;
